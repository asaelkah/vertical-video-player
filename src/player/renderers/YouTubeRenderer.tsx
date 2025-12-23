import React, { useEffect, useRef } from "react";
import { YouTubeMoment } from "../../types";

export function YouTubeRenderer({
  moment,
  active,
  muted,
  paused,
  onEnded,
}: {
  moment: YouTubeMoment;
  active: boolean;
  muted: boolean;
  paused: boolean;
  onEnded?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasEndedRef = useRef(false);

  // Build embed URL with parameters
  const embedUrl = new URL(`https://www.youtube.com/embed/${moment.videoId}`);
  embedUrl.searchParams.set("autoplay", active && !paused ? "1" : "0");
  embedUrl.searchParams.set("mute", muted ? "1" : "0");
  embedUrl.searchParams.set("controls", "0");
  embedUrl.searchParams.set("modestbranding", "1");
  embedUrl.searchParams.set("playsinline", "1");
  embedUrl.searchParams.set("rel", "0");
  embedUrl.searchParams.set("showinfo", "0");
  embedUrl.searchParams.set("fs", "0");
  embedUrl.searchParams.set("iv_load_policy", "3");
  embedUrl.searchParams.set("enablejsapi", "1");
  embedUrl.searchParams.set("origin", window.location.origin);

  // Post message to control iframe
  const postMessage = (action: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: action, args: [] }),
        "*"
      );
    }
  };

  useEffect(() => {
    if (!active) {
      postMessage("pauseVideo");
    } else if (paused) {
      postMessage("pauseVideo");
    } else {
      postMessage("playVideo");
    }
  }, [active, paused]);

  useEffect(() => {
    if (muted) {
      postMessage("mute");
    } else {
      postMessage("unMute");
    }
  }, [muted]);

  // Listen for YouTube player state changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // YouTube sends playerState: 0 when video ends
        if (data.event === "onStateChange" && data.info === 0 && !hasEndedRef.current) {
          hasEndedRef.current = true;
          onEnded?.();
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEnded]);

  // Reset ended state when video changes
  useEffect(() => {
    hasEndedRef.current = false;
  }, [moment.videoId]);

  return (
    <div className="mmvp-youtube-container">
      <iframe
        ref={iframeRef}
        className="mmvp-youtube-iframe"
        src={embedUrl.toString()}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={moment.title || "YouTube video"}
      />
      <style>{`
        .mmvp-youtube-container {
          width: 100%;
          height: 100%;
          background: #000;
          position: relative;
          overflow: hidden;
        }
        .mmvp-youtube-iframe {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 180%;
          height: 180%;
          transform: translate(-50%, -50%);
          border: none;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
