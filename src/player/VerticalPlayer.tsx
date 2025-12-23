import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PlaylistPayload, VideoMoment, AdMoment } from "../types";
import { track } from "../telemetry/track";
import { markSeen } from "./seen";

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// In-memory storage for skipped ads (resets on page refresh)
let skippedAdsInSession = new Set<string>();

const getSkippedAds = (): Set<string> => skippedAdsInSession;
const markAdSkipped = (id: string) => { skippedAdsInSession.add(id); };

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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const current = moments[currentIndex];
  const mobile = isMobile();

  // Helpers
  const hasVideo = (m: typeof moments[0]) => m.type === "video" || m.type === "ad";
  const getVideoSrc = (m: typeof moments[0]) => {
    if (m.type === "video") return (m as VideoMoment).src;
    if (m.type === "ad") return (m as AdMoment).src;
    return "";
  };

  // Scroll to initial index on mount
  useEffect(() => {
    if (initialIndex > 0 && sectionRefs.current[initialIndex]) {
      sectionRefs.current[initialIndex]?.scrollIntoView({ behavior: "auto" });
    }
  }, [initialIndex]);

  // Eagerly preload all ad videos on mount
  useEffect(() => {
    moments.forEach((moment, i) => {
      if (moment.type === "ad") {
        const video = videoRefs.current[i];
        if (video) {
          video.preload = "auto";
          video.load();
        }
      }
    });
  }, [moments]);

  // Touch swipe detection for closing on last video
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
      
      // Swipe up on last video (delta > 50px) - close player
      if (isOnLastVideo && deltaY > 50) {
        onClose?.();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentIndex, total, onClose]);

  // Intersection Observer for video play/pause
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-index"));
          const video = videoRefs.current[idx];
          
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // This video is now the main one
            setCurrentIndex(idx);
            setPaused(false);
            setProgress(0);
            
            if (video) {
              video.currentTime = 0;
              video.muted = muted;
              video.play().catch(() => {
                // Try muted autoplay
                video.muted = true;
                video.play().catch(() => {});
              });
            }
          } else {
            // Pause and reset videos that are not visible
            if (video) {
              video.pause();
              video.currentTime = 0;
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    // Observe all sections
    sectionRefs.current.forEach((section) => {
      if (section) observerRef.current?.observe(section);
    });

    return () => observerRef.current?.disconnect();
  }, [moments, muted]);

  // Sync mute state to current video
  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (video) video.muted = muted;
  }, [muted, currentIndex]);

  // Sync pause state
  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (!video) return;
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [paused, currentIndex]);

  // Track progress
  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [currentIndex]);

  // Track moment view
  useEffect(() => {
    if (!current) return;
    markSeen(current.content_id);
    track("moment_start", { content_id: current.content_id, position: currentIndex + 1 });
  }, [currentIndex, current]);

  // Handle video end - scroll to next
  const handleVideoEnd = useCallback((idx: number) => {
    if (idx === currentIndex) {
      if (idx < total - 1) {
        sectionRefs.current[idx + 1]?.scrollIntoView({ behavior: "smooth" });
      } else {
        onClose?.();
      }
    }
  }, [currentIndex, total, onClose]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < total - 1) {
      sectionRefs.current[currentIndex + 1]?.scrollIntoView({ behavior: "smooth" });
    } else {
      onClose?.();
    }
  }, [currentIndex, total, onClose]);

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
    setPaused(p => !p);
  }, []);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: current?.title, url: location.href }); } catch {}
    } else {
      navigator.clipboard?.writeText(location.href);
    }
  };

  return (
    <div className="mmvp-player-wrapper">
      {/* Scrollable container with CSS snap */}
      <div ref={containerRef} className="mmvp-scroll-container">
        {moments.map((moment, i) => {
          if (!hasVideo(moment)) return null;
          const isActive = i === currentIndex;
          const isNear = Math.abs(i - currentIndex) <= 1;
          
          return (
            <div
              key={moment.content_id}
              ref={(el) => { sectionRefs.current[i] = el; }}
              data-index={i}
              className="mmvp-video-section"
              onClick={handleTap}
            >
              {/* Background blur for active */}
              {isActive && (
                <div className="mmvp-bg-blur">
                  <video src={getVideoSrc(moment)} muted playsInline autoPlay loop />
                </div>
              )}

              {/* Video frame */}
              <div className="mmvp-video-frame">
                <video
                  ref={(el) => { videoRefs.current[i] = el; }}
                  className="mmvp-video-element"
                  src={getVideoSrc(moment)}
                  playsInline
                  muted={muted}
                  preload={isNear || moment.type === "ad" ? "auto" : "metadata"}
                  onEnded={() => handleVideoEnd(i)}
                />

                {/* Play overlay when paused */}
                {isActive && paused && (
                  <div className="mmvp-play-overlay">
                    <div className="mmvp-play-icon-large">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                )}

                {/* Skip Ad button */}
                {isActive && moment.type === "ad" && (
                  <button
                    className="mmvp-skip-ad mmvp-skip-ad-inside"
                    onClick={(e) => { e.stopPropagation(); markAdSkipped(moment.content_id); goNext(); }}
                  >
                    Skip Ad →
                  </button>
                )}
              </div>

              {/* Sponsor box for ads */}
              {isActive && moment.type === "ad" && (
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
              {isActive && moment.type !== "ad" && (
                <div className="mmvp-bottom-bar">
                  <div className="mmvp-title">{moment.title}</div>
                  <div className="mmvp-counter">{i + 1} / {total}</div>
                </div>
              )}
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

      {/* Progress bar - fixed at bottom of screen, interactive on desktop */}
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
        }}
        onMouseDown={(e) => {
          if (mobile) return;
          e.stopPropagation();
          const progressBar = e.currentTarget;
          const video = videoRefs.current[currentIndex];
          if (!video || !video.duration) return;
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const rect = progressBar.getBoundingClientRect();
            const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
            const percent = x / rect.width;
            video.currentTime = percent * video.duration;
            setProgress(percent);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };
          
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      >
        <div className="mmvp-progress-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
