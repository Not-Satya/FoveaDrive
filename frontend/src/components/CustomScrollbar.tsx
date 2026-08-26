import { useEffect, useRef, useState, useCallback } from 'react';

interface CustomScrollbarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function CustomScrollbar({ scrollContainerRef }: CustomScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateThumb = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ratio = el.clientHeight / el.scrollHeight;
    if (ratio >= 1) { setIsVisible(false); return; }
    const trackH = trackRef.current?.clientHeight ?? el.clientHeight;
    setThumbHeight(Math.max(ratio * trackH, 32));
    setThumbTop((el.scrollTop / el.scrollHeight) * trackH);
    setIsVisible(true);
    // Auto-hide after 1.5s of no scrolling
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setIsVisible(false), 1500);
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateThumb, { passive: true });
    window.addEventListener('resize', updateThumb);
    updateThumb();
    return () => {
      el.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [updateThumb, scrollContainerRef]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainerRef.current?.scrollTop ?? 0;
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const el = scrollContainerRef.current;
      const trackH = trackRef.current?.clientHeight ?? 1;
      if (!el) return;
      const delta = e.clientY - dragStartY.current;
      const scrollRatio = el.scrollHeight / trackH;
      el.scrollTop = dragStartScrollTop.current + delta * scrollRatio;
      setIsVisible(true);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      hideTimeout.current = setTimeout(() => setIsVisible(false), 1500);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, scrollContainerRef]);

  // Click on track to jump
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = (e.clientY - rect.top) / rect.height;
    el.scrollTop = clickRatio * el.scrollHeight - el.clientHeight / 2;
  };

  return (
    <div
      ref={trackRef}
      onClick={onTrackClick}
      className="fixed right-0 top-0 h-full z-50 flex items-start justify-center cursor-pointer"
      style={{ width: '12px' }}
    >
      {/* Track line */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#2B4C6F]/30" />

      {/* Thumb */}
      <div
        ref={thumbRef}
        onMouseDown={onMouseDown}
        className="absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing transition-opacity duration-300"
        style={{
          top: thumbTop,
          height: thumbHeight,
          opacity: isDragging ? 1 : isVisible ? 0.9 : 0,
          width: '3px',
        }}
      >
        {/* Thumb body */}
        <div className="w-full h-full bg-icy-blue/60 rounded-full shadow-[0_0_6px_rgba(188,227,255,0.4)]" />
        {/* Top tick */}
        <div className="absolute -left-[2px] top-0 w-[7px] h-[1px] bg-icy-blue/80" />
        {/* Bottom tick */}
        <div className="absolute -left-[2px] bottom-0 w-[7px] h-[1px] bg-icy-blue/80" />
      </div>
    </div>
  );
}
