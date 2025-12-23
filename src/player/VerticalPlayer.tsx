import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PlaylistPayload, VideoMoment } from "../types";
import { track } from "../telemetry/track";
import { getSeen, markSeen } from "./seen";

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export function VerticalPlayer({
  payload,
  initialIndex = 0,
  onClose,
}: {
  payload: PlaylistPayload;
  initialIndex?: number;
  onClose?: () => void;
}) {
  const moments = useMemo(() => {
    const seen = getSeen();
    const filtered = payload.moments.filter((m) => !seen.has(m.content_id));
    return filtered.length ? filtered : payload.moments;
  }, [payload.moments]);

  const total = moments.length;
  const [index, setIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false); // Start unmuted
  const [hasInteracted, setHasInteracted] = useState(true); // Assume user clicked to open player
  const [progress, setProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  
  // Store refs to ALL video elements
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Swipe state
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const didSwipe = useRef(false);

  const current = moments[index];
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  // Preload ALL videos on mount
  useEffect(() => {
    moments.forEach((moment, i) => {
      if (moment.type === "video") {
        const video = videoRefs.current[i];
        if (video) {
          video.load();
        }
      }
    });
  }, [moments]);

  // Play current video, pause others
  useEffect(() => {
    moments.forEach((moment, i) => {
      if (moment.type !== "video") return;
      const video = videoRefs.current[i];
      if (!video) return;

      if (i === index) {
        // Current video - play it unmuted
        video.currentTime = 0;
        video.muted = muted;
        
        const playVideo = async () => {
          try {
            // Try playing with current muted state
            await video.play();
          } catch {
            // If unmuted failed, try muted then unmute after
            if (!muted) {
              video.muted = true;
              try {
                await video.play();
                // Successfully playing muted, try to unmute after short delay
                setTimeout(() => {
                  if (video && !video.paused) {
                    video.muted = false;
                  }
                }, 100);
              } catch (e) {
                console.error("Video play failed:", e);
              }
            }
          }
        };

        if (video.readyState >= 2) {
          playVideo();
        } else {
          video.addEventListener("canplay", playVideo, { once: true });
        }
      } else {
        // Other videos - pause them
        video.pause();
      }
    });
  }, [index, moments, muted]);

  // Sync mute state to current video
  useEffect(() => {
    const video = videoRefs.current[index];
    if (video && hasInteracted) {
      video.muted = muted;
    }
  }, [muted, index, hasInteracted]);

  // Track progress
  useEffect(() => {
    const video = videoRefs.current[index];
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress(video.currentTime / video.duration);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [index]);

  // Track moment
  useEffect(() => {
    if (!current) return;
    markSeen(current.content_id);
    track("moment_start", { content_id: current.content_id, position: index + 1 });
    setProgress(0);
  }, [index, current]);

  const goNext = useCallback(() => {
    if (index < total - 1) {
      setIndex(i => i + 1);
    } else {
      onClose?.();
    }
  }, [index, total, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex(i => i - 1);
  }, [index]);

  // Handle user interaction - unmute
  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setMuted(false);
      const video = videoRefs.current[index];
      if (video) {
        video.muted = false;
      }
    }
  }, [hasInteracted, index]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleFirstInteraction();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); }
      if (e.key === "m") setMuted(m => !m);
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose, handleFirstInteraction]);

  // Mouse wheel
  const wheelTimeout = useRef<number | null>(null);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    handleFirstInteraction();
    if (wheelTimeout.current) return;
    if (Math.abs(e.deltaY) > 30) {
      if (e.deltaY > 0) goNext();
      else goPrev();
      wheelTimeout.current = window.setTimeout(() => {
        wheelTimeout.current = null;
      }, 400);
    }
  }, [goNext, goPrev, handleFirstInteraction]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleFirstInteraction();
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    setDragging(true);
    setOffset(0);
    didSwipe.current = false;
  }, [handleFirstInteraction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dy) > 10) didSwipe.current = true;
    if ((dy > 0 && !hasPrev) || (dy < 0 && !hasNext)) {
      setOffset(dy * 0.15);
    } else {
      setOffset(dy);
    }
  }, [dragging, hasPrev, hasNext]);

  const handleTouchEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const velocity = Math.abs(offset) / (Date.now() - startTime.current);
    const threshold = velocity > 0.5 ? 30 : 80;
    if (offset < -threshold) goNext();
    else if (offset > threshold && hasPrev) goPrev();
    setOffset(0);
  }, [dragging, offset, hasPrev, goNext, goPrev]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    handleFirstInteraction();
    if (isMobile()) {
      if (!didSwipe.current) setMuted(m => !m);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) goPrev();
      else goNext();
    }
  }, [goPrev, goNext, handleFirstInteraction]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: current?.title, url: location.href }); } catch {}
    } else {
      navigator.clipboard?.writeText(location.href);
    }
  };

  const screenH = typeof window !== "undefined" ? window.innerHeight : 800;
  const mobile = isMobile();

  const getSlideTransform = (slideIndex: number) => {
    const diff = slideIndex - index;
    const baseY = diff * screenH;
    const y = baseY + offset;
    return {
      transform: `translateY(${y}px)`,
      transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    };
  };

  return (
    <div
      ref={rootRef}
      className="mmvp-player"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      onWheel={handleWheel}
    >
      {/* Background blur */}
      {current?.type === "video" && (
        <div className="mmvp-bg-blur">
          <video
            src={(current as VideoMoment).src}
            muted
            playsInline
            autoPlay
            loop
          />
        </div>
      )}

      {/* ALL video slides - keep them all mounted */}
      {moments.map((moment, i) => {
        if (moment.type !== "video") return null;
        const isVisible = Math.abs(i - index) <= 1;
        
        return (
          <div 
            key={moment.content_id} 
            className="mmvp-slide" 
            style={{
              ...getSlideTransform(i),
              visibility: isVisible ? "visible" : "hidden",
            }}
          >
            <div className="mmvp-video-frame">
              <video
                ref={(el) => { videoRefs.current[i] = el; }}
                className="mmvp-video-element"
                src={(moment as VideoMoment).src}
                playsInline
                preload="auto"
                loop
                onEnded={i === index ? goNext : undefined}
              />
            </div>
          </div>
        );
      })}

      {/* Progress bars */}
      <div className="mmvp-progress-top">
        {moments.map((_, i) => (
          <div key={i} className="mmvp-progress-track">
            <div
              className="mmvp-progress-fill"
              style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Top controls - order: mute, share, close */}
      <div 
        className="mmvp-top-right"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <button className="mmvp-btn-icon" onClick={() => setMuted(m => !m)}>
          {muted ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          )}
        </button>
        <button className="mmvp-btn-icon" onClick={handleShare}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
        <button className="mmvp-btn-icon" onClick={() => onClose?.()}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      {/* Desktop arrows */}
      {!mobile && hasPrev && (
        <button className="mmvp-arrow-nav mmvp-arrow-left" onClick={(e) => { e.stopPropagation(); goPrev(); }}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
      )}
      {!mobile && hasNext && (
        <button className="mmvp-arrow-nav mmvp-arrow-right" onClick={(e) => { e.stopPropagation(); goNext(); }}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      )}

      {/* Bottom info */}
      <div className="mmvp-bottom-bar">
        <div className="mmvp-title">{current?.title}</div>
        <div className="mmvp-counter">{index + 1} / {total}</div>
      </div>
    </div>
  );
}
