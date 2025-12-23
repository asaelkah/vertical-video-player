import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { CentralModal } from "./CentralModal";
import { VerticalPlayer } from "../player/VerticalPlayer";
import { PlaylistPayload, Moment, VideoMoment } from "../types";
import { getDemoPayload } from "./demoPayload";

// Gradient colors for fallback thumbnails
const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
];

// Video thumbnail - autoplay muted (works on mobile with muted)
function VideoThumb({ src, title, index }: { src: string; title?: string; index: number }) {
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const gradient = GRADIENTS[index % GRADIENTS.length];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Try to play the video (muted autoplay should work on mobile)
    const playVideo = () => {
      video.play().catch(() => {
        // If autoplay fails, that's ok - video will show first frame
      });
    };
    
    // Play when video can play
    video.addEventListener("canplay", playVideo);
    
    // Also try immediately
    playVideo();
    
    return () => {
      video.removeEventListener("canplay", playVideo);
    };
  }, [src]);

  if (hasError) {
    return (
      <div 
        style={{
          width: "100%",
          height: "100%",
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: "14px", textAlign: "center", fontWeight: 600, padding: "16px" }}>
          {title || "Video"}
        </span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={`${src}#t=0.1`}
      muted
      playsInline
      loop
      preload="auto"
      onError={() => setHasError(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
        background: "#000",
      }}
    />
  );
}

function CardThumbnail({ moment, index }: { moment: Moment; index: number }) {
  if (moment.type === "youtube") {
    return (
      <img 
        src={`https://img.youtube.com/vi/${moment.videoId}/hqdefault.jpg`} 
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  
  if (moment.type === "image") {
    return (
      <img 
        src={moment.src} 
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  
  if (moment.type === "video") {
    const videoMoment = moment as VideoMoment;
    if (videoMoment.poster) {
      return (
        <img 
          src={videoMoment.poster} 
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      );
    }
    return <VideoThumb src={videoMoment.src} title={videoMoment.title} index={index} />;
  }
  
  return <div style={{ width: "100%", height: "100%", background: GRADIENTS[index % GRADIENTS.length] }} />;
}

export function Widget({ hostEl }: { hostEl: HTMLElement }) {
  void hostEl;
  
  const payload = useMemo<PlaylistPayload>(() => getDemoPayload(window.location.href), []);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter out ads for carousel display (ads don't show thumbnails)
  const visibleMoments = useMemo(() => 
    payload.moments
      .map((m, i) => ({ moment: m, originalIndex: i }))
      .filter(({ moment }) => moment.type !== "ad"),
    [payload.moments]
  );

  const scrollLeft = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // If at the start, jump to end
    if (el.scrollLeft <= 10) {
      el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: "smooth" });
    } else {
      el.scrollBy({ left: -320, behavior: "smooth" });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    // If at the end, jump to start
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: 320, behavior: "smooth" });
    }
  }, []);

  // Note: Auto-loop removed to prevent alignment issues when returning from player
  // Infinite scroll is handled via arrow buttons only

  const openPlayer = (originalIndex: number) => {
    setSelectedIndex(originalIndex);
    setOpen(true);
  };

  return (
    <div className="mmvp-popular">
      {/* Header - MLB.com style */}
      <div className="mmvp-popular-header">
        <h2 className="mmvp-popular-title">Popular</h2>
        <div className="mmvp-popular-arrows">
          <button className="mmvp-pop-arrow" onClick={scrollLeft}>
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/></svg>
          </button>
          <button className="mmvp-pop-arrow" onClick={scrollRight}>
            <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>

      {/* Cards - ads are hidden from carousel */}
      <div className="mmvp-popular-scroll" ref={scrollRef}>
        {visibleMoments.map(({ moment, originalIndex }, idx) => (
          <div key={moment.content_id} className="mmvp-pop-card" onClick={() => openPlayer(originalIndex)}>
            {/* Thumbnail */}
            <div className="mmvp-pop-thumb">
              <CardThumbnail moment={moment} index={idx} />
            </div>
            
            {/* Title overlay */}
            <div className="mmvp-pop-overlay">
              <p className="mmvp-pop-label">{moment.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Player modal */}
      {open && (
        <CentralModal onClose={() => setOpen(false)}>
          <VerticalPlayer 
            payload={payload} 
            initialIndex={selectedIndex}
            onClose={() => setOpen(false)} 
          />
        </CentralModal>
      )}
    </div>
  );
}
