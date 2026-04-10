import React, { useCallback, useEffect, useRef, useState } from "react";

function canPlayHlsNatively(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") === "probably" ||
         video.canPlayType("application/vnd.apple.mpegurl") === "maybe";
}

function loadHlsScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Hls) return resolve((window as any).Hls);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
    script.async = true;
    script.onload = () => resolve((window as any).Hls);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function EditionHoverPreview({ thumb, streamId }: { thumb: string | null; streamId: string | null }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const start = useCallback(async () => {
    if (!streamId) return;
    setPlaying(true);
  }, [streamId]);

  const stop = useCallback(() => {
    setPlaying(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!playing) {
      try {
        video.pause();
      } catch {}
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
      return;
    }

    const src = streamId ? `https://stream.mux.com/${encodeURIComponent(streamId)}.m3u8` : null;
    if (!src) return;

    const setup = async () => {
      if (canPlayHlsNatively(video)) {
        video.src = src;
        await video.play().catch(() => {});
      } else {
        const Hls: any = await loadHlsScript();
        if (Hls && Hls.isSupported()) {
          const hls = new Hls({ autoStartLoad: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            await video.play().catch(() => {});
          });
        } else {
          video.src = src;
          await video.play().catch(() => {});
        }
      }
    };

    setup();

    const onEnded = () => setPlaying(false);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("ended", onEnded);
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
    };
  }, [playing, streamId]);

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={start}
      onMouseLeave={stop}
      onPointerDown={start}
      onPointerUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
    >
      {!playing ? (
        thumb ? (
          <img src={thumb} alt="Edition preview" className="absolute inset-0 h-full w-full object-cover pointer-events-none" loading="lazy" />
        ) : null
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          muted
          controls={false}
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}
