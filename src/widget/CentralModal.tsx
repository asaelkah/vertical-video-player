import React, { useEffect, useRef } from "react";

export function CentralModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    const preventTouch = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", preventTouch, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.removeEventListener("touchmove", preventTouch);
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={modalRef} className="mmvp-modal" role="dialog">
      {children}
    </div>
  );
}
