import React, { useEffect, useRef, useState } from "react";
import { VideoMoment } from "../../types";

export function VideoRenderer({
  moment,
  active,
  muted,
  paused,
  onEnded,
  onError,
  onQuartile,
}: {
  moment: VideoMoment;
  active: boolean;
  muted: boolean;
  paused: boolean;
  onEnded?: () => void;
  onError?: (e: { code: string; retryCount: number }) => void;
  onQuartile?: (q: { quartile: number; content_id: string }, watched: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastQuartile = useRef(0);
  const playAttempts = useRef(0);

  // Core play function with retry logic
  const attemptPlay = async () => {
    const video = videoRef.current;
    if (!video || !active || paused) return;

    playAttempts.current++;
    
    try {
      video.muted = muted;
      await video.play();
      setIsLoading(false);
    } catch {
      // Try muted if unmuted failed
      if (!muted) {
        try {
          video.muted = true;
          await video.play();
          setIsLoading(false);
        } catch {
          // Retry after a short delay if we haven't tried too many times
          if (playAttempts.current < 5) {
            setTimeout(attemptPlay, 100);
          }
        }
      } else if (playAttempts.current < 5) {
        setTimeout(attemptPlay, 100);
      }
    }
  };

  // Handle active state and play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active && !paused) {
      playAttempts.current = 0;
      
      // If video is ready, play immediately
      if (video.readyState >= 3) {
        attemptPlay();
      } else {
        // Wait for video to be ready
        setIsLoading(true);
        const onCanPlay = () => {
          attemptPlay();
          video.removeEventListener("canplaythrough", onCanPlay);
        };
        video.addEventListener("canplaythrough", onCanPlay);
        
        // Also try after a timeout in case canplaythrough doesn't fire
        const timeout = setTimeout(() => {
          if (video.readyState >= 2) {
            attemptPlay();
          }
        }, 300);
        
        return () => {
          video.removeEventListener("canplaythrough", onCanPlay);
          clearTimeout(timeout);
        };
      }
    } else {
      video.pause();
    }
  }, [active, paused, moment.src]);

  // Handle mute changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  // Load video when source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsLoading(true);
    lastQuartile.current = 0;
    playAttempts.current = 0;
    video.currentTime = 0;
  }, [moment.src]);

  // Quartile tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onQuartile || !active) return;

    const handleTimeUpdate = () => {
      if (!video.duration || !isFinite(video.duration)) return;
      const progress = video.currentTime / video.duration;
      const quartile = progress >= 1 ? 100 : progress >= 0.75 ? 75 : progress >= 0.5 ? 50 : progress >= 0.25 ? 25 : 0;
      
      if (quartile > lastQuartile.current) {
        lastQuartile.current = quartile;
        onQuartile({ quartile, content_id: moment.content_id }, video.currentTime);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [moment.content_id, onQuartile, active]);

  // Error handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleError = () => {
      onError?.({ code: "PLAYBACK_FAILED", retryCount: 0 });
    };

    video.addEventListener("error", handleError);
    return () => video.removeEventListener("error", handleError);
  }, [onError]);

  return (
    <div className="mmvp-video-container">
      <video
        ref={videoRef}
        className="mmvp-video"
        playsInline
        webkit-playsinline="true"
        preload="auto"
        src={moment.src}
        poster={moment.poster}
        onLoadedData={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={onEnded}
      />
      
      {isLoading && active && (
        <div className="mmvp-loader">
          <div className="mmvp-spinner" />
        </div>
      )}
    </div>
  );
}
