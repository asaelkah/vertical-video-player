/**
 * Double-Tap-to-Like Component (Web Version)
 * 
 * Detects double-taps and spawns animated hearts at the tap location.
 * Hearts scale up, float up, and fade out like Instagram/TikTok.
 */

import React, { useState, useCallback, useRef } from 'react';

interface Heart {
  id: number;
  x: number;
  y: number;
}

interface DoubleTapLikeProps {
  children: React.ReactNode;
  onLike?: () => void;
  onSingleTap?: () => void;
}

// Animated Heart Component
function AnimatedHeart({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  // Auto-cleanup after animation
  React.useEffect(() => {
    const timer = setTimeout(onComplete, 1000); // Match animation duration
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="mmvp-heart"
      style={{
        left: x - 40, // Center the heart (80px width / 2)
        top: y - 40,
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="80" height="80">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </div>
  );
}

export function DoubleTapLike({ children, onLike, onSingleTap }: DoubleTapLikeProps) {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeHeart = useCallback((id: number) => {
    setHearts(prev => prev.filter(h => h.id !== id));
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // Check if this is a double-tap (within 300ms and 50px of last tap)
    if (
      lastTapRef.current &&
      now - lastTapRef.current.time < 300 &&
      Math.abs(x - lastTapRef.current.x) < 50 &&
      Math.abs(y - lastTapRef.current.y) < 50
    ) {
      // Double-tap detected!
      // Clear single-tap timer
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      // Spawn a heart
      const newHeart: Heart = {
        id: Date.now() + Math.random(),
        x,
        y,
      };
      setHearts(prev => [...prev, newHeart]);

      // Trigger like callback
      onLike?.();

      // Reset last tap
      lastTapRef.current = null;
    } else {
      // First tap - wait to see if it's a double-tap
      lastTapRef.current = { time: now, x, y };

      // Set timer for single-tap action
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        onSingleTap?.();
        lastTapRef.current = null;
        singleTapTimerRef.current = null;
      }, 300);
    }
  }, [onLike, onSingleTap]);

  return (
    <div 
      className="mmvp-double-tap-container" 
      onClick={handleClick}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {children}
      
      {/* Render hearts overlay */}
      {hearts.map(heart => (
        <AnimatedHeart
          key={heart.id}
          x={heart.x}
          y={heart.y}
          onComplete={() => removeHeart(heart.id)}
        />
      ))}
    </div>
  );
}

