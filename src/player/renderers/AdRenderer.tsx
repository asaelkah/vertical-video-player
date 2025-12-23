import React, { useEffect } from "react";
import { AdMoment } from "../../types";

export function AdRenderer({
  moment,
  active,
  onDone,
  onAdImpression,
}: {
  moment: AdMoment;
  active: boolean;
  onDone?: () => void;
  onAdImpression?: (ad: any) => void;
}) {
  useEffect(() => {
    if (!active) return;
    onAdImpression?.({ ad_id: moment.adId ?? "stub", vast_version: "4.x" });
    const ms = Math.min(Math.max(moment.min_ms ?? 6000, 6000), moment.max_ms ?? 15000);
    const t = window.setTimeout(() => onDone?.(), ms);
    return () => clearTimeout(t);
  }, [active, moment.adId, moment.min_ms, moment.max_ms, onDone, onAdImpression]);

  return (
    <div className="mmvp-ad">
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Ad (stub)</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          Replace this renderer with your VAST / SIMID / IMA integration.
        </div>
      </div>
    </div>
  );
}
