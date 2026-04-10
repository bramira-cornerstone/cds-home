import React, { useEffect, useMemo, useRef, useState } from "react";
import Spline from "@splinetool/react-spline";
import { cacheBustedUrl } from "@/lib/utils";

const SPLINE_RESPONSIVE_STYLES = `
  [data-spline-fitted] {
    width: 100% !important;
    height: 100% !important;
    min-height: 320px !important;
    min-width: 320px !important;
  }

  [data-spline-fitted] > * {
    width: 100% !important;
    height: 100% !important;
    min-height: 320px !important;
    min-width: 320px !important;
  }

  [data-spline-fitted] > div > div {
    width: 100% !important;
    height: auto !important;
    flex-grow: 1 !important;
    min-height: 320px !important;
    min-width: 320px !important;
  }

  [data-spline-fitted] canvas {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    min-height: 320px !important;
    min-width: 320px !important;
  }

  [data-spline-fitted] > div {
    width: 100% !important;
    height: 100% !important;
    min-height: 320px !important;
    min-width: 320px !important;
    flex-grow: 1 !important;
  }

  @media (max-width: 991px) {
    [data-spline-fitted] {
      flex-grow: 1 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 320px !important;
      min-width: 320px !important;
    }

    [data-spline-fitted] > * {
      flex-grow: 1 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 320px !important;
      min-width: 320px !important;
    }

    [data-spline-fitted] > div > div {
      width: 100% !important;
      height: auto !important;
      flex-grow: 1 !important;
      min-height: 320px !important;
      min-width: 320px !important;
    }

    [data-spline-fitted] canvas {
      width: 100% !important;
      height: 100% !important;
      min-height: 320px !important;
      min-width: 320px !important;
    }
  }
`;

interface Props {
  scene: string;
  baseWidth?: number; // aspect ratio width (defaults 390)
  baseHeight?: number; // aspect ratio height (defaults 571)
  className?: string; // container classes (should control final box size)
  onLoad?: (app: any) => void;
}

class SplineErrorBoundary extends React.Component<
  { fallback?: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any) {
    // eslint-disable-next-line no-console
    console.error("SplineErrorBoundary caught:", error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children as any;
  }
}

function isValidSplineUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (!/spline\.design$/i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export default function SplineFitted({
  scene,
  baseWidth = 390,
  baseHeight = 571,
  className,
  onLoad,
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [scene]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    let raf = 0;
    const recompute = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(0, Math.round(rect.width));
      const h = Math.max(0, Math.round(rect.height));
      if (w > 0 && h > 0) setBox({ w, h });
    };

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(recompute);
          })
        : null;

    ro?.observe(el);
    recompute();

    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const sceneUrl = useMemo(() => {
    const url = cacheBustedUrl(scene);
    return url;
  }, [scene]);

  const scale = useMemo(() => {
    const { w, h } = box;
    if (!w || !h || !baseWidth || !baseHeight) return 0;
    return Math.min(w / baseWidth, h / baseHeight);
  }, [box, baseWidth, baseHeight]);

  const valid = isValidSplineUrl(sceneUrl);

  if (!valid) {
    return (
      <div className={className}>
        <div className="w-full rounded-md border border-slate-200 bg-white/70 p-3 text-center text-sm text-slate-600 dark:bg-slate-700 dark:text-white dark:border-white/10">
          3D scene unavailable. (Invalid URL: {sceneUrl})
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{SPLINE_RESPONSIVE_STYLES}</style>
      <div
        ref={outerRef}
        data-spline-fitted
        className={
          (className ? className + " " : "") +
          "relative overflow-hidden w-full"
        }
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          minHeight: "320px",
          minWidth: "320px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            willChange: "transform",
            flex: "1 1 auto",
          }}
        >
          {loading ? (
            <div className="grid w-full place-items-center text-[13px] text-slate-600 dark:text-white">
              Loading 3D…
            </div>
          ) : null}
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              display: "flex",
              minHeight: "320px",
              minWidth: "320px",
              flexGrow: "1",
            }}
          >
            <SplineErrorBoundary
              fallback={
                <div className="grid w-full place-items-center text-[13px] text-slate-600 dark:text-white">
                  Failed to load 3D scene.
                </div>
              }
            >
              <Spline
                onLoad={(app: any) => {
                  setLoading(false);
                  try {
                    onLoad?.(app);
                  } catch (e) {
                    /* ignore */
                  }
                }}
                scene={sceneUrl}
                onError={(error?: any) => {
                  setLoading(false);
                  setError("Failed to load scene");
                }}
                style={{ width: "100%", height: "100%", display: "block", flex: "1 1 auto", minHeight: "320px", minWidth: "320px" }}
              />
            </SplineErrorBoundary>
          </div>
          {error ? (
            <div className="absolute bottom-1 left-1 right-1 mx-auto w-[95%] rounded bg-red-50 px-2 py-1 text-center text-[11px] text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
