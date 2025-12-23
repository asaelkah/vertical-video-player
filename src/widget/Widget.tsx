import React, { useMemo, useState, useRef } from "react";
import { CentralModal } from "./CentralModal";
import { VerticalPlayer } from "../player/VerticalPlayer";
import { PlaylistPayload, Moment, VideoMoment } from "../types";
import { getDemoPayload } from "./demoPayload";

// Video thumbnail using native video element
function VideoThumb({ src }: { src: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <div style={{ width: "100%", height: "100%", background: "#1a1a2e" }} />;
  }

  return (
    <video
      src={`${src}#t=0.1`}
      muted
      playsInline
      autoPlay
      loop
      preload="auto"
      onError={() => setHasError(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        background: "#1a1a2e",
      }}
    />
  );
}

function CardThumbnail({ moment }: { moment: Moment }) {
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
    return <VideoThumb src={videoMoment.src} />;
  }
  
  return <div style={{ width: "100%", height: "100%", background: "#1a1a2e" }} />;
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
        {visibleMoments.map(({ moment, originalIndex }) => (
          <div key={moment.content_id} className="mmvp-pop-card" onClick={() => openPlayer(originalIndex)}>
            {/* Thumbnail */}
            <div className="mmvp-pop-thumb">
              <CardThumbnail moment={moment} />
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
