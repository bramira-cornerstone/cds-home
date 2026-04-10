import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export function FitText({
  text,
  align = "right",
  className = "",
  min = 8,
  max = 200,
}: {
  text: string;
  align?: "left" | "center" | "right";
  className?: string;
  min?: number;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontPx, setFontPx] = useState<number>(min);

  const ctx = useMemo(() => {
    const c = document.createElement("canvas");
    return c.getContext("2d");
  }, []);

  const recompute = () => {
    const el = ref.current;
    if (!el || !ctx) return;
    const computed = window.getComputedStyle(el);
    const fontFamily = computed.fontFamily || "sans-serif";
    const fontWeight = computed.fontWeight || "500";
    const paddingLeft = parseFloat(computed.paddingLeft || "0") || 0;
    const paddingRight = parseFloat(computed.paddingRight || "0") || 0;
    const availableW = Math.max(0, el.clientWidth - paddingLeft - paddingRight);
    const availableH = Math.max(0, el.clientHeight);

    const measure = (size: number) => {
      ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
      return ctx.measureText(text).width;
    };

    let lo = Math.max(1, Math.floor(min));
    let hi = Math.max(lo, Math.min(Math.floor(max), Math.floor(availableH)));
    for (let i = 0; i < 18 && lo <= hi; i++) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const widthAtMid = measure(mid);
      const fitsHeight = mid <= availableH; // line-height: 1
      const fitsWidth = availableW <= 0 ? true : widthAtMid <= availableW;
      if (fitsHeight && fitsWidth) lo = mid; else hi = mid - 1;
    }

    setFontPx(Math.max(min, Math.min(lo, max)));
  };

  useLayoutEffect(() => {
    recompute();
    const id = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let resizeObserverRaf = 0;
    const ro = new ResizeObserver(() => {
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      resizeObserverRaf = requestAnimationFrame(() => recompute());
    });
    ro.observe(el);

    let resizeWindowRaf = 0;
    const onResize = () => {
      if (resizeWindowRaf) cancelAnimationFrame(resizeWindowRaf);
      resizeWindowRaf = requestAnimationFrame(() => recompute());
    };
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      if (resizeWindowRaf) cancelAnimationFrame(resizeWindowRaf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={
        `w-full h-full leading-none select-none whitespace-nowrap overflow-hidden ` +
        (align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left") +
        (className ? ` ${className}` : "")
      }
      style={{ fontSize: fontPx, lineHeight: 1 }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
