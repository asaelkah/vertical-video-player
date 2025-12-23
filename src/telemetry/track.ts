export function track(event: string, payload: Record<string, any>) {
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({ event, ...payload, ts: Date.now() });

  // Helpful during local dev:
  // eslint-disable-next-line no-console
  console.debug("[MMVP]", event, payload);
}
