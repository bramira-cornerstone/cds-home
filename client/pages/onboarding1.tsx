import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function loadMuxPlayerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector("script[data-mux-player]")) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mux/mux-player@1/dist/mux-player.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-mux-player", "");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load mux-player script"));
    document.head.appendChild(s);
  });
}

export default function Onboarding1() {
  const navigate = useNavigate();
  const playerRef = useRef<any>(null);

  useEffect(() => {
    loadMuxPlayerScript().catch(() => {});
  }, []);

  useEffect(() => {
    const player = playerRef.current as any;
    if (!player) return;

    try {
      player.volume = 0.5;
      player.muted = false;
      player.play?.();
    } catch {}
  }, []);

  const handleNext = () => {
    navigate("/onboarding2");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white px-4 mt-6">
      <div className="flex flex-col items-center gap-0 max-w-md">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-black">
          How It Works
        </h1>

        {/* Subtitle */}
        <p className="text-center text-slate-600">
          Learn what it is you do here, and what makes us different
        </p>

        {/* Video Player */}
        <div className="flex items-center justify-center">
          <mux-player
            ref={playerRef as any}
            playback-id="yeBJDo01JVbFUg3D02RlF72NgjRIUo9jCLRfBNZEqSvMw"
            stream-type="on-demand"
            autoplay="any"
            volume={0.5}
            playsinline
            style={{
              height: "400px",
              width: "300px",
              aspectRatio: "9 / 16",
              borderRadius: "8px",
              paddingBottom: "6px",
            }}
          ></mux-player>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full text-white font-medium rounded transition-colors"
          style={{
            backgroundColor: "rgba(0, 79, 255, 1)",
            padding: "12px 16px",
            lineHeight: "20px",
            fontSize: "16px",
            boxShadow: "1px 1px 3px 0 rgba(0, 0, 0, 1)",
          }}
        >
          <p>Click to take the next step</p>
        </button>
      </div>
    </div>
  );
}
