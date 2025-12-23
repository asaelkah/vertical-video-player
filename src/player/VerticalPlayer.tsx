import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PlaylistPayload, VideoMoment, AdMoment } from "../types";
import { track } from "../telemetry/track";
import { getSeen, markSeen } from "./seen";

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// In-memory storage for skipped ads (resets on page refresh)
let skippedAdsInSession = new Set<string>();

const getSkippedAds = (): Set<string> => {
  return skippedAdsInSession;
};
const markAdSkipped = (id: string) => {
  skippedAdsInSession.add(id);
};

// Spring physics constants - tuned for TikTok-like feel
const SPRING_TENSION = 300;
const SPRING_FRICTION = 26;
const VELOCITY_THRESHOLD = 0.3; // pixels per ms for flick detection
const SWIPE_THRESHOLD_RATIO = 0.15; // 15% of screen height
const RUBBER_BAND_RESISTANCE = 0.35;
const MIN_SWIPE_DISTANCE = 10; // Minimum distance to consider it a swipe

export function VerticalPlayer({
  payload,
  initialIndex = 0,
  onClose,
}: {
  payload: PlaylistPayload;
  initialIndex?: number;
  onClose?: () => void;
}) {
  // Filter out skipped ads from this session
  const moments = useMemo(() => {
    const skippedAds = getSkippedAds();
    const filtered = payload.moments.filter((m) => {
      if (m.type === "ad" && skippedAds.has(m.content_id)) return false;
      return true;
    });
    return filtered.length ? filtered : payload.moments;
  }, [payload.moments]);

  const total = moments.length;
  const [index, setIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(true);
  const [progress, setProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  
  // Video refs
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Advanced swipe state
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchState = useRef({
    isDragging: false,
    startY: 0,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    velocityHistory: [] as { v: number; t: number }[],
    didSwipe: false,
    rafId: 0,
  });

  const current = moments[index];
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

  // Helper functions
  const hasVideo = (m: typeof moments[0]) => m.type === "video" || m.type === "ad";
  const getVideoSrc = (m: typeof moments[0]) => {
    if (m.type === "video") return (m as VideoMoment).src;
    if (m.type === "ad") return (m as AdMoment).src;
    return "";
  };

  // Calculate weighted average velocity from history
  const getAverageVelocity = () => {
    const history = touchState.current.velocityHistory;
    if (history.length === 0) return 0;
    
    // Weight recent velocities more heavily
    let totalWeight = 0;
    let weightedSum = 0;
    const now = Date.now();
    
    history.forEach((entry, i) => {
      const age = now - entry.t;
      if (age < 100) { // Only consider last 100ms
        const weight = 1 - (age / 100);
        weightedSum += entry.v * weight;
        totalWeight += weight;
      }
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  // Spring animation to target position
  const animateToPosition = useCallback((targetOffset: number, onComplete?: () => void) => {
    let currentOffset = offset;
    let velocity = touchState.current.velocity;
    let lastTime = performance.now();
    
    setIsAnimating(true);
    
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.064); // Cap at ~16fps minimum
      lastTime = time;
      
      // Spring physics
      const displacement = targetOffset - currentOffset;
      const springForce = SPRING_TENSION * displacement;
      const dampingForce = -SPRING_FRICTION * velocity;
      const acceleration = springForce + dampingForce;
      
      velocity += acceleration * dt;
      currentOffset += velocity * dt;
      
      setOffset(currentOffset);
      
      // Check if animation is complete (settled)
      const isSettled = Math.abs(velocity) < 0.5 && Math.abs(displacement) < 0.5;
      
      if (isSettled) {
        setOffset(targetOffset);
        setIsAnimating(false);
        onComplete?.();
      } else {
        touchState.current.rafId = requestAnimationFrame(animate);
      }
    };
    
    touchState.current.rafId = requestAnimationFrame(animate);
  }, [offset]);

  // Preload ALL videos on mount
  useEffect(() => {
    moments.forEach((moment, i) => {
      if (hasVideo(moment)) {
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
      if (!hasVideo(moment)) return;
      const video = videoRefs.current[i];
      if (!video) return;

      if (i === index) {
        video.currentTime = 0;
        
        const playVideo = async () => {
          try {
            await video.play();
          } catch {
            video.muted = true;
            try {
              await video.play();
              setTimeout(() => {
                if (video && !video.paused) {
                  video.muted = false;
                }
              }, 100);
            } catch (e) {
              console.error("Video play failed:", e);
            }
          }
        };

        if (video.readyState >= 2) {
          playVideo();
        } else {
          video.addEventListener("canplay", playVideo, { once: true });
        }
      } else {
        video.pause();
      }
    });
  }, [index, moments]);

  // Sync mute state
  useEffect(() => {
    const video = videoRefs.current[index];
    if (video && hasInteracted) {
      video.muted = muted;
    }
  }, [muted, index, hasInteracted]);

  // Sync pause state
  useEffect(() => {
    const video = videoRefs.current[index];
    if (!video) return;
    
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [paused, index]);

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

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (touchState.current.rafId) {
        cancelAnimationFrame(touchState.current.rafId);
      }
    };
  }, []);

  const goNext = useCallback(() => {
    if (index < total - 1) {
      setIndex(i => i + 1);
      setPaused(false);
    } else {
      onClose?.();
    }
  }, [index, total, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(i => i - 1);
      setPaused(false);
    }
  }, [index]);

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

  // Touch handlers with RAF-based updates
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleFirstInteraction();
    
    // Cancel any ongoing animation
    if (touchState.current.rafId) {
      cancelAnimationFrame(touchState.current.rafId);
    }
    setIsAnimating(false);
    
    const touch = e.touches[0];
    const now = Date.now();
    
    touchState.current = {
      isDragging: true,
      startY: touch.clientY,
      startTime: now,
      lastY: touch.clientY,
      lastTime: now,
      velocity: 0,
      velocityHistory: [],
      didSwipe: false,
      rafId: 0,
    };
    
    setOffset(0);
  }, [handleFirstInteraction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.current.isDragging) return;
    
    const touch = e.touches[0];
    const now = Date.now();
    const dy = touch.clientY - touchState.current.startY;
    const dt = now - touchState.current.lastTime;
    
    // Mark as swipe if moved enough
    if (Math.abs(dy) > MIN_SWIPE_DISTANCE) {
      touchState.current.didSwipe = true;
    }
    
    // Calculate instantaneous velocity
    if (dt > 0) {
      const instantVelocity = (touch.clientY - touchState.current.lastY) / dt;
      touchState.current.velocityHistory.push({ v: instantVelocity, t: now });
      // Keep only last 5 samples
      if (touchState.current.velocityHistory.length > 5) {
        touchState.current.velocityHistory.shift();
      }
    }
    
    touchState.current.lastY = touch.clientY;
    touchState.current.lastTime = now;
    
    // Apply rubber-band resistance at boundaries
    let newOffset = dy;
    
    // At top (can't go previous) - add resistance to pulling down
    if (!hasPrev && dy > 0) {
      newOffset = dy * RUBBER_BAND_RESISTANCE;
    }
    // At bottom (can't go next) - add resistance to pulling up
    else if (!hasNext && dy < 0) {
      newOffset = dy * RUBBER_BAND_RESISTANCE;
    }
    
    // Use RAF for smooth updates
    cancelAnimationFrame(touchState.current.rafId);
    touchState.current.rafId = requestAnimationFrame(() => {
      setOffset(newOffset);
    });
  }, [hasPrev, hasNext]);

  const handleTouchEnd = useCallback(() => {
    if (!touchState.current.isDragging) return;
    
    touchState.current.isDragging = false;
    cancelAnimationFrame(touchState.current.rafId);
    
    const avgVelocity = getAverageVelocity();
    touchState.current.velocity = avgVelocity * 1000; // Convert to per second
    
    const swipeThreshold = screenH * SWIPE_THRESHOLD_RATIO;
    const velocityTriggered = Math.abs(avgVelocity) > VELOCITY_THRESHOLD;
    const distanceTriggered = Math.abs(offset) > swipeThreshold;
    
    // Determine action based on velocity and distance
    if (offset < 0 && (velocityTriggered || distanceTriggered)) {
      // Swipe up - go next
      if (hasNext) {
        animateToPosition(-screenH, () => {
          setOffset(0);
          goNext();
        });
      } else {
        // At end - rubber band back and close
        animateToPosition(0, () => {
          onClose?.();
        });
      }
    } else if (offset > 0 && (velocityTriggered || distanceTriggered)) {
      // Swipe down - go previous
      if (hasPrev) {
        animateToPosition(screenH, () => {
          setOffset(0);
          goPrev();
        });
      } else {
        // At start - rubber band back
        animateToPosition(0);
      }
    } else {
      // Not enough to trigger - rubber band back
      animateToPosition(0);
    }
  }, [offset, screenH, hasPrev, hasNext, goNext, goPrev, animateToPosition, onClose]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    handleFirstInteraction();
    
    // Only toggle pause if not a swipe
    if (!touchState.current.didSwipe) {
      setPaused(p => !p);
    }
  }, [handleFirstInteraction]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleFirstInteraction();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
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
    if (wheelTimeout.current || isAnimating) return;
    if (Math.abs(e.deltaY) > 20) {
      if (e.deltaY > 0) goNext();
      else goPrev();
      wheelTimeout.current = window.setTimeout(() => {
        wheelTimeout.current = null;
      }, 400);
    }
  }, [goNext, goPrev, handleFirstInteraction, isAnimating]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: current?.title, url: location.href }); } catch {}
    } else {
      navigator.clipboard?.writeText(location.href);
    }
  };

  const mobile = isMobile();

  const getSlideTransform = (slideIndex: number) => {
    const diff = slideIndex - index;
    const baseY = diff * screenH;
    const y = baseY + offset;
    
    return {
      transform: `translate3d(0, ${y}px, 0)`,
      transition: isAnimating ? "none" : (touchState.current.isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)"),
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
      {hasVideo(current) && (
        <div className="mmvp-bg-blur">
          <video
            src={getVideoSrc(current)}
            muted
            playsInline
            autoPlay
          />
        </div>
      )}

      {/* ALL video slides */}
      {moments.map((moment, i) => {
        if (!hasVideo(moment)) return null;
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
                src={getVideoSrc(moment)}
                playsInline
                preload="auto"
                onEnded={i === index ? goNext : undefined}
              />
              {/* Progress bar - inside video frame at bottom */}
              {i === index && (
                <div className="mmvp-progress-bottom">
                  <div 
                    className="mmvp-progress-bar-fill"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
              {/* Play button overlay when paused */}
              {i === index && paused && (
                <div className="mmvp-play-overlay">
                  <div className="mmvp-play-icon-large">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              )}
              {/* Skip Ad button */}
              {i === index && moment.type === "ad" && (
                <button 
                  className="mmvp-skip-ad mmvp-skip-ad-inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAdSkipped(moment.content_id);
                    goNext();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    markAdSkipped(moment.content_id);
                    goNext();
                  }}
                >
                  Skip Ad →
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Sponsored overlay for ads */}
      {current?.type === "ad" && (
        <div 
          className="mmvp-sponsor-box"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="mmvp-sponsor-header">
            <div className="mmvp-sponsor-logo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M13 5.41V21h-2V5.41L5.41 11 4 9.59 12 1.59l8 8L18.59 11z"/>
              </svg>
            </div>
            <div className="mmvp-sponsor-info">
              <div className="mmvp-sponsor-name">{(current as AdMoment).sponsor.name}</div>
              <div className="mmvp-sponsor-label">Sponsored</div>
            </div>
          </div>
          <a 
            href={(current as AdMoment).sponsor.ctaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mmvp-sponsor-cta"
          >
            {(current as AdMoment).sponsor.ctaText}
          </a>
        </div>
      )}

      {/* Top controls */}
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

      {/* Bottom info - hidden for ads */}
      {current?.type !== "ad" && (
        <div className="mmvp-bottom-bar">
          <div className="mmvp-title">{current?.title}</div>
          <div className="mmvp-counter">{index + 1} / {total}</div>
        </div>
      )}
    </div>
  );
}
