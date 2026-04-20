"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type CommentSheetFrameProps = {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  closeDurationMs?: number;
  collapsedHeight?: string;
  expandedHeight?: string;
  collapsedBorderRadius?: string;
  expandedBorderRadius?: string;
};

export function CommentSheetFrame({
  title = "댓글",
  onClose,
  children,
  closeDurationMs = 300,
  collapsedHeight = "70vh",
  expandedHeight = "100dvh",
  collapsedBorderRadius = "20px 20px 0 0",
  expandedBorderRadius = "0",
}: CommentSheetFrameProps) {
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  function dismiss() {
    if (closing) return;
    setDragY(0);
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, closeDurationMs);
  }

  function onDragStart(e: React.TouchEvent) {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
  }

  function onDragMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (expanded) {
      if (diff > 0) setDragY(diff);
    } else {
      setDragY(diff);
    }
  }

  function onDragEnd() {
    isDragging.current = false;
    if (expanded) {
      if (dragY > 100) setExpanded(false);
      setDragY(0);
      return;
    }
    if (dragY < -60) {
      setExpanded(true);
      setDragY(0);
      return;
    }
    if (dragY > 80) {
      dismiss();
      return;
    }
    setDragY(0);
  }

  const panelStyle: React.CSSProperties = {
    height: expanded ? expandedHeight : collapsedHeight,
    borderRadius: expanded ? expandedBorderRadius : collapsedBorderRadius,
    transform: closing
      ? "translateY(100%)"
      : dragY > 0
        ? `translateY(${dragY}px)`
        : undefined,
    transition: isDragging.current
      ? "none"
      : closing
        ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
        : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), height 0.3s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.3s",
  };

  return (
    <div className={`gallery-sheet-overlay${closing ? " is-closing" : ""}`} onClick={dismiss}>
      <div className="gallery-sheet-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div
          className="gallery-sheet-drag-area"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="gallery-sheet-handle" />
          <p className="gallery-sheet-title">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
