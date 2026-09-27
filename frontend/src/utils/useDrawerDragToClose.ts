import { useState, useRef, useCallback, useEffect } from "react";

interface UseDrawerDragToCloseOptions {
  onClose: () => void;
  threshold?: number;
  isOpen?: boolean;
}

/**
 * Hook providing touch drag-to-close physics for mobile phone bottom sheet drawers.
 * Enables smooth 1:1 dragging on grab pill and header, with flick velocity detection and spring snap-back.
 */
export function useDrawerDragToClose({
  onClose,
  threshold = 60,
  isOpen = true,
}: UseDrawerDragToCloseOptions) {
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setOffsetY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const clientY = e.touches[0].clientY;
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const clientY = e.touches[0].clientY;
    const deltaY = clientY - startYRef.current;
    currentYRef.current = clientY;

    if (deltaY > 0) {
      setOffsetY(deltaY);
    } else {
      // Slight resistance for upward overscroll
      setOffsetY(deltaY * 0.12);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const timeDiff = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = deltaY / timeDiff;

    // Trigger close if dragged past threshold or swiped down quickly
    if (deltaY > threshold || (deltaY > 20 && velocity > 0.35)) {
      setOffsetY(window.innerHeight || 800);
      setTimeout(() => {
        onClose();
      }, 160);
    } else {
      // Snap back to top
      setOffsetY(0);
    }
  }, [threshold, onClose]);

  const handleTouchCancel = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setOffsetY(0);
  }, []);

  const dragHandleProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    style: {
      cursor: "grab",
      touchAction: "none" as const,
      userSelect: "none" as const,
      WebkitUserSelect: "none" as const,
    },
  };

  const drawerStyle: React.CSSProperties = {
    transform: `translateY(${Math.max(0, offsetY)}px)`,
    transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: isDragging ? "transform" : undefined,
  };

  return {
    dragHandleProps,
    drawerStyle,
    isDragging,
    offsetY,
  };
}
