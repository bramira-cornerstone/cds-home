import { useEffect, useRef, useState } from "react";

interface FitTextProps {
  children: string;
  minFontSize?: number;
  maxFontSize?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function FitText({
  children,
  minFontSize = 8,
  maxFontSize = 14,
  style = {},
  className = "",
}: FitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) return;

    const adjustFontSize = () => {
      const containerWidth = container.clientWidth;
      const containerPadding = 16; // px-2 = 0.5rem = 8px on each side
      const maxWidth = containerWidth - containerPadding;

      // Binary search for the best font size to minimize layout recalculations
      let low = minFontSize;
      let high = maxFontSize;
      let bestFontSize = maxFontSize;

      while (low <= high) {
        const mid = Math.round((low + high) / 2);
        text.style.fontSize = `${mid}px`;

        // Force layout only once per iteration by reading scrollWidth
        const currentWidth = text.scrollWidth;

        if (currentWidth <= maxWidth) {
          bestFontSize = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      text.style.fontSize = `${bestFontSize}px`;
      setFontSize(bestFontSize);
    };

    // Initial adjustment
    adjustFontSize();

    // Watch for container resize with throttling
    let resizeObserverRaf = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      resizeObserverRaf = requestAnimationFrame(adjustFontSize);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
    };
  }, [children, minFontSize, maxFontSize]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: "hidden",
        ...style,
      }}
    >
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          fontSize: "12px",
          margin: "0 auto",
        }}
      >
        {children}
      </span>
    </div>
  );
}
