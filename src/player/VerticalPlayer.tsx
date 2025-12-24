import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { PlaylistPayload, VideoMoment, AdMoment } from "../types";
import { track } from "../telemetry/track";
import { markSeen } from "./seen";

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// Global flag to track if user has interacted (for autoplay policies)
let hasUserInteracted = false;
let audioContextUnlocked = false;

const markUserInteraction = () => { 
  hasUserInteracted = true;
  
  // Unlock audio context on first interaction (critical for iOS)
  if (!audioContextUnlocked) {
    audioContextUnlocked = true;
    try {
      // Create and immediately close an audio context to unlock audio
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        ctx.resume().then(() => {
          // Create a silent buffer and play it
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        });
      }
    } catch (e) {
      // Silent fail
    }
  }
};

// In-memory storage for skipped ads (resets on page refresh)
let skippedAdsInSession = new Set<string>();

const getSkippedAds = (): Set<string> => skippedAdsInSession;
const markAdSkipped = (id: string) => { skippedAdsInSession.add(id); };

// Format time as M:SS
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// --- INDIVIDUAL VIDEO ITEM COMPONENT ---
// This component manages its own playback based on whether it's active, preloading, or dormant
const VideoItem = memo(({ 
  moment, 
  index, 
  activeIndex,
  muted,
  paused,
  onVideoEnd,
  onTimeUpdate,
  onTap,
  onSkipAd,
  videoRef,
  total,
}: {
  moment: VideoMoment | AdMoment;
  index: number;
  activeIndex: number;
  muted: boolean;
  paused: boolean;
  onVideoEnd: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onTap: () => void;
  onSkipAd: () => void;
  videoRef: (el: HTMLVideoElement | null) => void;
  total: number;
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const playAttemptRef = useRef(0);
  const BASE_URL = import.meta.env.BASE_URL || "/";

  // AGGRESSIVE UNMOUNTING: Only mount video for distance < 2 from active
  // This prevents hardware decoder exhaustion on mobile (limit is usually 3-6)
  const diff = Math.abs(index - activeIndex);
  const isActive = index === activeIndex;
  const shouldMountVideo = diff < 2; // Only current and immediate neighbor

  const videoSrc = moment.type === "video" ? moment.src : (moment as AdMoment).src;
  const isAd = moment.type === "ad";

  // Aggressive play function with retries
  const playWithSound = useCallback(async (video: HTMLVideoElement, targetMuted: boolean) => {
    if (!video) return;
    
    playAttemptRef.current++;
    const currentAttempt = playAttemptRef.current;
    
    // Reset video position
    video.currentTime = 0;
    
    // CRITICAL: Always start muted, then unmute after play succeeds
    video.muted = true;
    
    try {
      await video.play();
      
      // After successful play, set the desired mute state
      if (!targetMuted && hasUserInteracted) {
        // Small delay to ensure play is stable before unmuting
        setTimeout(() => {
          if (currentAttempt === playAttemptRef.current && video) {
            video.muted = false;
          }
        }, 100);
      }
    } catch (e) {
      // Play failed, try again after a short delay
      setTimeout(async () => {
        if (currentAttempt === playAttemptRef.current) {
          try {
            await video.play();
            if (!targetMuted && hasUserInteracted) {
              video.muted = false;
            }
          } catch (e2) {
            // Final fail - keep muted
          }
        }
      }, 200);
    }
  }, []);

  // Handle video play/pause based on active state
  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video) return;

    if (isActive && !paused) {
      playWithSound(video, muted);
    } else if (isActive && paused) {
      video.pause();
    } else {
      // Not active - pause immediately and mute to release audio decoder
      video.pause();
      video.muted = true; // CRITICAL: Mute non-active videos to free audio resources
    }
  }, [isActive, muted, paused, playWithSound]);

  // Sync mute state immediately (only for active video)
  useEffect(() => {
    const video = internalVideoRef.current;
    if (video && isActive && hasUserInteracted) {
      video.muted = muted;
    }
  }, [muted, isActive]);

  // Time update tracking
  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !isActive) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [isActive, onTimeUpdate]);

  // Set ref for parent access
  useEffect(() => {
    videoRef(internalVideoRef.current);
  }, [videoRef, shouldMountVideo]);

  return (
    <div className="mmvp-video-section" onClick={onTap}>
      {/* Background blur for active */}
      {isActive && (
        <div className="mmvp-bg-blur">
          <video src={videoSrc} muted playsInline autoPlay loop />
        </div>
      )}

      {/* Video frame */}
      <div className="mmvp-video-frame">
        {/* Loading placeholder - SI logo (only for active video if still loading) */}
        {isActive && isLoading && (
          <div className="mmvp-loading-placeholder">
            <img src={`${BASE_URL}si-logo.svg`} alt="Loading..." className="mmvp-loading-logo" />
          </div>
        )}

        {shouldMountVideo ? (
          // Active or neighbor: Mount video element
          // CRITICAL: Always start muted, JS will unmute after play succeeds
          <video
            ref={internalVideoRef}
            className="mmvp-video-element"
            src={videoSrc}
            playsInline
            muted // Always start muted for autoplay policy
            preload="auto"
            onEnded={onVideoEnd}
            onCanPlay={() => setIsLoading(false)}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => setIsLoading(false)}
          />
        ) : (
          // Dormant: No video element - frees hardware decoder
          <div className="mmvp-video-placeholder">
            <img 
              src={`${BASE_URL}si-logo.svg`} 
              alt="" 
              className="mmvp-loading-logo" 
              style={{ opacity: 0.15 }}
            />
          </div>
        )}

        {/* Play overlay when paused */}
        {isActive && paused && (
          <div className="mmvp-play-overlay">
            <div className="mmvp-play-icon-large">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        )}

        {/* Skip Ad button */}
        {isActive && isAd && (
          <button
            className="mmvp-skip-ad mmvp-skip-ad-inside"
            onClick={(e) => { e.stopPropagation(); onSkipAd(); }}
          >
            Skip Ad →
          </button>
        )}
      </div>

      {/* Sponsor box for ads */}
      {isActive && isAd && (
        <div className="mmvp-sponsor-box" onClick={(e) => e.stopPropagation()}>
          <div className="mmvp-sponsor-header">
            <div className="mmvp-sponsor-logo">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 5.41V21h-2V5.41L5.41 11 4 9.59 12 1.59l8 8L18.59 11z"/></svg>
            </div>
            <div className="mmvp-sponsor-info">
              <div className="mmvp-sponsor-name">{(moment as AdMoment).sponsor.name}</div>
              <div className="mmvp-sponsor-label">Sponsored</div>
            </div>
          </div>
          <a href={(moment as AdMoment).sponsor.ctaUrl} target="_blank" rel="noopener noreferrer" className="mmvp-sponsor-cta">
            {(moment as AdMoment).sponsor.ctaText}
          </a>
        </div>
      )}

      {/* Bottom info (not for ads) */}
      {isActive && !isAd && (
        <div className="mmvp-bottom-bar">
          <div className="mmvp-title">{moment.title}</div>
          <div className="mmvp-counter">{index + 1} / {total}</div>
        </div>
      )}
    </div>
  );
});

// --- MAIN VERTICAL PLAYER COMPONENT ---
export function VerticalPlayer({
  payload,
  initialIndex = 0,
  onClose,
}: {
  payload: PlaylistPayload;
  initialIndex?: number;
  onClose?: () => void;
}) {
  // Filter out skipped ads
  const moments = useMemo(() => {
    const skippedAds = getSkippedAds();
    const filtered = payload.moments.filter((m) => {
      if (m.type === "ad" && skippedAds.has(m.content_id)) return false;
      return true;
    });
    return filtered.length ? filtered : payload.moments;
  }, [payload.moments]);

  const total = moments.length;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState<{ x: number; percent: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const current = moments[currentIndex];
  const mobile = isMobile();

  // Exit with animation
  const exitWithAnimation = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onClose?.();
    }, 300);
  }, [onClose]);

  // Helpers
  const hasVideo = (m: typeof moments[0]) => m.type === "video" || m.type === "ad";

  // Scroll to initial index on mount
  useEffect(() => {
    if (initialIndex > 0 && sectionRefs.current[initialIndex]) {
      sectionRefs.current[initialIndex]?.scrollIntoView({ behavior: "auto" });
    }
  }, [initialIndex]);

  // Mark user interaction on mount (user clicked to open player)
  useEffect(() => {
    markUserInteraction();
    
    // Preload nearby videos using link preload hints
    moments.slice(0, 5).forEach((m) => {
      if (m.type === "video" || m.type === "ad") {
        const src = m.type === "video" ? (m as VideoMoment).src : (m as AdMoment).src;
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "video";
        link.href = src;
        document.head.appendChild(link);
      }
    });
  }, [moments]);

  // Viewability detection using Intersection Observer
  // This determines which video is "Active"
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx) && idx !== currentIndex) {
              setCurrentIndex(idx);
              setProgress(0);
              setCurrentTime(0);
              setPaused(false);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    sectionRefs.current.forEach((section) => {
      if (section) observerRef.current?.observe(section);
    });

    return () => observerRef.current?.disconnect();
  }, [moments.length]);

  // Touch swipe detection for closing on last video (mobile)
  const touchStartY = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      const isOnLastVideo = currentIndex === total - 1;
      
      if (isOnLastVideo && deltaY > 50) {
        exitWithAnimation();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentIndex, total, exitWithAnimation]);

  // Mouse wheel detection for closing on last video (desktop)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mobile) return;

    let scrollAccumulator = 0;
    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleWheel = (e: WheelEvent) => {
      const isOnLastVideo = currentIndex === total - 1;
      
      if (isOnLastVideo && e.deltaY > 0) {
        scrollAccumulator += e.deltaY;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          scrollAccumulator = 0;
        }, 300);
        
        if (scrollAccumulator > 150) {
          exitWithAnimation();
          scrollAccumulator = 0;
        }
      } else {
        scrollAccumulator = 0;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    
    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [currentIndex, total, exitWithAnimation, mobile]);

  // Track moment view
  useEffect(() => {
    if (!current) return;
    markSeen(current.content_id);
    track("moment_start", { content_id: current.content_id, position: currentIndex + 1 });
  }, [currentIndex, current]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < total - 1) {
      sectionRefs.current[currentIndex + 1]?.scrollIntoView({ behavior: "smooth" });
    } else {
      exitWithAnimation();
    }
  }, [currentIndex, total, exitWithAnimation]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      sectionRefs.current[currentIndex - 1]?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
      if (e.key === "m") setMuted(m => !m);
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  // Tap to pause/play
  const handleTap = useCallback(() => {
    markUserInteraction();
    setPaused(p => !p);
  }, []);

  // Time update handler
  const handleTimeUpdate = useCallback((time: number, dur: number) => {
    if (!isSeeking) {
      setCurrentTime(time);
      setDuration(dur);
      setProgress(dur ? time / dur : 0);
    }
  }, [isSeeking]);

  // Video end handler
  const handleVideoEnd = useCallback((idx: number) => {
    if (idx === currentIndex) {
      if (idx < total - 1) {
        sectionRefs.current[idx + 1]?.scrollIntoView({ behavior: "smooth" });
      } else {
        exitWithAnimation();
      }
    }
  }, [currentIndex, total, exitWithAnimation]);

  // Skip ad handler
  const handleSkipAd = useCallback((contentId: string) => {
    markAdSkipped(contentId);
    goNext();
  }, [goNext]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: current?.title, url: location.href }); } catch {}
    } else {
      navigator.clipboard?.writeText(location.href);
    }
  };

  return (
    <div className={`mmvp-player-wrapper ${exiting ? "mmvp-exiting" : ""}`}>
      {/* Scrollable container with CSS snap */}
      <div ref={containerRef} className="mmvp-scroll-container">
        {moments.map((moment, i) => {
          if (!hasVideo(moment)) return null;
          
          return (
            <div
              key={moment.content_id}
              ref={(el) => { sectionRefs.current[i] = el; }}
              data-index={i}
              style={{ width: "100%", height: "100%" }}
            >
              <VideoItem
                moment={moment as VideoMoment | AdMoment}
                index={i}
                activeIndex={currentIndex}
                muted={muted}
                paused={paused}
                onVideoEnd={() => handleVideoEnd(i)}
                onTimeUpdate={handleTimeUpdate}
                onTap={handleTap}
                onSkipAd={() => handleSkipAd(moment.content_id)}
                videoRef={(el) => { videoRefs.current[i] = el; }}
                total={total}
              />
            </div>
          );
        })}
      </div>

      {/* Top controls - fixed overlay */}
      <div className="mmvp-top-right" onClick={(e) => e.stopPropagation()}>
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
      {!mobile && currentIndex > 0 && (
        <button className="mmvp-arrow-nav mmvp-arrow-left" onClick={(e) => { e.stopPropagation(); goPrev(); }}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
      )}
      {!mobile && currentIndex < total - 1 && (
        <button className="mmvp-arrow-nav mmvp-arrow-right" onClick={(e) => { e.stopPropagation(); goNext(); }}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      )}

      {/* Time display */}
      <div className="mmvp-time-display" onClick={(e) => e.stopPropagation()}>
        <span className="mmvp-time-current">{formatTime(isSeeking && seekPosition ? seekPosition.percent * duration : currentTime)}</span>
        <span className="mmvp-time-separator"> / </span>
        <span className="mmvp-time-duration">{formatTime(duration)}</span>
      </div>

      {/* Preview when seeking */}
      {isSeeking && seekPosition && (
        <div 
          className="mmvp-seek-preview"
          style={{ left: `${Math.max(60, Math.min(seekPosition.x, window.innerWidth - 60))}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mmvp-seek-preview-time">{formatTime(seekPosition.percent * duration)}</div>
        </div>
      )}

      {/* Progress bar - fixed at bottom */}
      <div 
        className="mmvp-progress-bottom"
        onClick={(e) => {
          e.stopPropagation();
          const video = videoRefs.current[currentIndex];
          if (!video || !video.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          video.currentTime = percent * video.duration;
          setProgress(percent);
          setCurrentTime(percent * video.duration);
        }}
        onMouseDown={(e) => {
          if (mobile) return;
          e.stopPropagation();
          setIsSeeking(true);
          const progressBar = e.currentTarget;
          const video = videoRefs.current[currentIndex];
          if (!video || !video.duration) return;
          
          const updateSeek = (clientX: number) => {
            const rect = progressBar.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const percent = x / rect.width;
            video.currentTime = percent * video.duration;
            setProgress(percent);
            setCurrentTime(percent * video.duration);
            setSeekPosition({ x: clientX - rect.left, percent });
          };
          
          updateSeek(e.clientX);
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            updateSeek(moveEvent.clientX);
          };
          
          const handleMouseUp = () => {
            setIsSeeking(false);
            setSeekPosition(null);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };
          
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          setIsSeeking(true);
          const progressBar = e.currentTarget;
          const video = videoRefs.current[currentIndex];
          if (!video || !video.duration) return;
          
          const seekToTouch = (touch: Touch) => {
            const rect = progressBar.getBoundingClientRect();
            const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
            const percent = x / rect.width;
            video.currentTime = percent * video.duration;
            setProgress(percent);
            setCurrentTime(percent * video.duration);
            setSeekPosition({ x, percent });
          };
          
          seekToTouch(e.touches[0]);
          
          const handleTouchMove = (moveEvent: TouchEvent) => {
            moveEvent.preventDefault();
            seekToTouch(moveEvent.touches[0]);
          };
          
          const handleTouchEnd = () => {
            setIsSeeking(false);
            setSeekPosition(null);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
          };
          
          document.addEventListener("touchmove", handleTouchMove, { passive: false });
          document.addEventListener("touchend", handleTouchEnd);
        }}
      >
        <div className="mmvp-progress-bar-fill" style={{ width: `${progress * 100}%` }}>
          <div className="mmvp-progress-handle" />
        </div>
      </div>
    </div>
  );
}
