import { useEffect, useRef, useState, useCallback } from "react";

export interface SwipeState {
  isDragging: boolean;
  dragOffset: number;
  isAnimating: boolean;
}

export function useInputController(opts: {
  onNext: () => void;
  onPrev: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleUI: () => void;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isDragging: false,
    dragOffset: 0,
    isAnimating: false,
  });

  const SWIPE_THRESHOLD = 50;
  const VELOCITY_THRESHOLD = 0.3;

  const completeSwipe = useCallback((direction: "next" | "prev" | "cancel") => {
    setSwipeState({
      isDragging: false,
      dragOffset: 0,
      isAnimating: true,
    });
    
    if (direction === "next") {
      opts.onNext();
    } else if (direction === "prev") {
      opts.onPrev();
    }
    
    setTimeout(() => {
      setSwipeState({
        isDragging: false,
        dragOffset: 0,
        isAnimating: false,
      });
    }, 300);
  }, [opts]);

  // Use native event listeners for proper touch handling
  const setContainerRef = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Prevent default to stop ALL scrolling behavior
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      startY.current = touch.clientY;
      startTime.current = performance.now();
      
      setSwipeState({
        isDragging: true,
        dragOffset: 0,
        isAnimating: false,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent default to stop scrolling
      e.preventDefault();
      e.stopPropagation();
      
      if (startY.current === null) return;
      
      const touch = e.touches[0];
      const dy = touch.clientY - startY.current;
      
      setSwipeState(prev => ({
        ...prev,
        dragOffset: dy,
      }));
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (startY.current === null) return;
      
      const touch = e.changedTouches[0];
      const dy = touch.clientY - startY.current;
      const dt = performance.now() - startTime.current;
      const velocity = Math.abs(dy) / dt;
      
      startY.current = null;
      
      const isQuickSwipe = velocity > VELOCITY_THRESHOLD && Math.abs(dy) > 15;
      const isLongSwipe = Math.abs(dy) > SWIPE_THRESHOLD;
      
      if (isQuickSwipe || isLongSwipe) {
        completeSwipe(dy < 0 ? "next" : "prev");
      } else {
        completeSwipe("cancel");
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      e.preventDefault();
      startY.current = null;
      completeSwipe("cancel");
    };

    // Add listeners with passive: false to allow preventDefault
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });
    el.addEventListener("touchcancel", handleTouchCancel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [completeSwipe]);

  const bind = {
    ref: setContainerRef,
    tabIndex: 0,
    
    onKeyDown: (e: React.KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowdown" || k === "j") opts.onNext();
      if (k === "arrowup" || k === "k") opts.onPrev();
      if (k === " ") { e.preventDefault(); opts.onTogglePause(); }
      if (k === "m") opts.onToggleMute();
      if (k === "escape") opts.onClose?.();
    },
    
    onWheel: (e: React.WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 15) return;
      if (e.deltaY > 0) opts.onNext();
      else opts.onPrev();
    },
    
    // Mouse fallback for desktop
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      startY.current = e.clientY;
      startTime.current = performance.now();
      
      setSwipeState({
        isDragging: true,
        dragOffset: 0,
        isAnimating: false,
      });
    },
    
    onMouseMove: (e: React.MouseEvent) => {
      if (startY.current === null || !(e.buttons & 1)) return;
      
      const dy = e.clientY - startY.current;
      setSwipeState(prev => ({ ...prev, dragOffset: dy }));
    },
    
    onMouseUp: (e: React.MouseEvent) => {
      if (startY.current === null) return;
      
      const dy = e.clientY - startY.current;
      const dt = performance.now() - startTime.current;
      const velocity = Math.abs(dy) / dt;
      
      startY.current = null;
      
      const isQuickSwipe = velocity > VELOCITY_THRESHOLD && Math.abs(dy) > 15;
      const isLongSwipe = Math.abs(dy) > SWIPE_THRESHOLD;
      
      if (isQuickSwipe || isLongSwipe) {
        completeSwipe(dy < 0 ? "next" : "prev");
      } else {
        completeSwipe("cancel");
      }
    },
    
    onMouseLeave: () => {
      if (startY.current !== null) {
        completeSwipe("cancel");
        startY.current = null;
      }
    },
  };

  return { bind, swipeState };
}
