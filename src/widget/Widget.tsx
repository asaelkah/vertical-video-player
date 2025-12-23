import React, { useMemo, useState, useRef, useEffect } from "react";
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

// Video thumbnail with reliable fallback
function VideoThumb({ src, title, index }: { src: string; title?: string; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let timeoutId: number;
    
    const handleLoaded = () => {
      setLoaded(true);
      video.pause(); // Pause after loading first frame
    };
    
    const handleError = () => {
      setShowFallback(true);
    };
    
    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("error", handleError);
    
    // Fallback timeout - if video doesn't load in 2 seconds, show gradient
    timeoutId = window.setTimeout(() => {
      if (!loaded) {
        setShowFallback(true);
      }
    }, 2000);
    
    return () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
      clearTimeout(timeoutId);
    };
  }, [src, loaded]);

  const gradient = GRADIENTS[index % GRADIENTS.length];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Gradient background - always present as fallback */}
      <div 
        style={{
          position: "absolute",
          inset: 0,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: (loaded && !showFallback) ? 0 : 1,
          transition: "opacity 0.3s",
        }}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="rgba(255,255,255,0.8)" 
          style={{ width: 40, height: 40 }}
        >
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      
      {/* Video element */}
      {!showFallback && (
        <video
          ref={videoRef}
          src={`${src}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s",
          }}
        />
      )}
    </div>
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

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" });
  };

  const openPlayer = (originalIndex: number) => {
    setSelectedIndex(originalIndex);
    setOpen(true);
  };

  return (
    <div className="mmvp-popular">
      {/* Header - SI.com style */}
      <div className="mmvp-popular-header">
        <h2 className="mmvp-popular-title">Best of SI</h2>
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
