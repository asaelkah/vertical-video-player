import React, { useEffect, useRef } from "react";
import { ImageMoment } from "../../types";

export function ImageRenderer({
  moment,
  active,
  onDone,
}: {
  moment: ImageMoment;
  active: boolean;
  onDone?: () => void;
}) {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const ms = moment.duration_ms ?? 5000;
    timer.current = window.setTimeout(() => onDone?.(), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [active, moment.content_id, moment.duration_ms, onDone]);

  return <img className="mmvp-image" src={moment.src} alt={moment.title ?? "Image"} />;
}
