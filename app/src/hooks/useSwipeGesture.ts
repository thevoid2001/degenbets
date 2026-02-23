"use client";

import { useRef, useState, useCallback } from "react";

export interface SwipeState {
  offsetX: number;
  offsetY: number;
  rotation: number;
  direction: "left" | "right" | null;
  swiping: boolean;
  settling: boolean;
  exiting: boolean;
}

const SWIPE_THRESHOLD = 120;
const ROTATION_FACTOR = 0.1;
const MAX_ROTATION = 15;

export function useSwipeGesture(
  onSwipe: (dir: "left" | "right") => void,
  enabled: boolean = true
) {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    direction: null,
    swiping: false,
    settling: false,
    exiting: false,
  });

  const startPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  const updateOffset = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - startPos.current.x;
    const dy = clientY - startPos.current.y;
    const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, dx * ROTATION_FACTOR));
    const direction = dx > 60 ? "right" : dx < -60 ? "left" : null;
    setState({
      offsetX: dx,
      offsetY: dy,
      rotation,
      direction,
      swiping: true,
      settling: false,
      exiting: false,
    });
  }, []);

  const handleEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    setState((prev) => {
      if (Math.abs(prev.offsetX) > SWIPE_THRESHOLD) {
        const dir = prev.offsetX > 0 ? "right" : "left";
        const exitX = dir === "right" ? 600 : -600;
        // Animate off-screen
        setTimeout(() => {
          onSwipe(dir);
          // Reset state after exit animation
          setState({
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
            direction: null,
            swiping: false,
            settling: false,
            exiting: false,
          });
        }, 300);
        return {
          offsetX: exitX,
          offsetY: prev.offsetY,
          rotation: dir === "right" ? 20 : -20,
          direction: dir,
          swiping: false,
          settling: false,
          exiting: true,
        };
      }
      // Spring back
      return {
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        direction: null,
        swiping: false,
        settling: true,
        exiting: false,
      };
    });
  }, [onSwipe]);

  // Touch events
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      dragging.current = true;
      startPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging.current) return;
      updateOffset(e.touches[0].clientX, e.touches[0].clientY);
    },
    [updateOffset]
  );

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse events (desktop fallback)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
    },
    [enabled]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      updateOffset(e.clientX, e.clientY);
    },
    [updateOffset]
  );

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    if (dragging.current) handleEnd();
  }, [handleEnd]);

  const bind = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };

  return { state, bind };
}
