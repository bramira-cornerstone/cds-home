import { useState, useRef, useEffect } from "react";

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

export function TutorialVideoCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUnmute, setShowUnmute] = useState(false);
  const [hasInteraction, setHasInteraction] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    loadMuxPlayerScript().catch(() => {});
  }, []);

  useEffect(() => {
    const player = playerRef.current as any;
    if (!player || !isOpen) return;

    try {
      // Reset video when opening
      player.currentTime = 0;

      // If user has interacted, try sound. Otherwise try sound first, fall back to muted
      if (hasInteraction) {
        player.volume = 0.5;
      } else {
        // Try to autoplay with sound first
        player.volume = 0.5;
        player.muted = false;
      }

      player.play?.();

      // Set up a listener to detect if sound autoplay was blocked
      const onPlayAttempt = () => {
        if (!hasInteraction && !soundBlocked && player.muted) {
          // Autoplay with sound was blocked, show unmute button
          setSoundBlocked(true);
          setShowUnmute(true);
        }
      };

      player.addEventListener?.("play", onPlayAttempt);
      return () => {
        player.removeEventListener?.("play", onPlayAttempt);
      };
    } catch {}
  }, [isOpen, hasInteraction, soundBlocked]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    // Treat opening the tutorial as an interaction that unlocks autoplay with sound
    if (!isOpen) {
      setHasInteraction(true);
      setSoundBlocked(false);
      setShowUnmute(false);
    }
  };

  const handleUnmute = () => {
    const el = playerRef.current as any | null;
    try {
      if (el) {
        el.muted = false;
        el.volume = 0.5;
        el.play?.();
      }
      setShowUnmute(false);
    } catch {}
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden card-shadow account-card">
        {/* Toggle Button */}
        <div className="p-4">
          <button
            onClick={handleToggle}
            className="w-full text-white text-sm font-medium rounded transition-colors"
            style={{
              backgroundColor: "rgba(0, 79, 255, 1)",
              padding: "8px 16px",
              lineHeight: "20px",
            }}
          >
            {isOpen ? <p>Close Tutorial</p> : <p>Open Tutorial</p>}
          </button>
        </div>

        {/* Video Container - Slides in/out */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: isOpen ? "600px" : "0",
            opacity: isOpen ? 1 : 0,
            transition:
              "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="flex items-center justify-center tutorial-video-container relative"
            style={{ height: "460px", aspectRatio: "9 / 16", margin: "0 auto" }}
          >
            {isOpen && (
              <>
                <mux-player
                  ref={playerRef as any}
                  playback-id="yeBJDo01JVbFUg3D02RlF72NgjRIUo9jCLRfBNZEqSvMw"
                  stream-type="on-demand"
                  autoplay="any"
                  volume={0.5}
                  playsinline
                  style={{
                    height: "460px",
                    width: "300px",
                    aspectRatio: "9 / 16",
                  }}
                ></mux-player>
                {showUnmute && soundBlocked && (
                  <button
                    type="button"
                    aria-label="Unmute"
                    onClick={handleUnmute}
                    className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 text-white px-2.5 py-1.5 text-[12px] shadow-md border border-white/20"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M3 10v4h4l5 5V5L7 10H3z" fill="currentColor" />
                      <path
                        d="M14 10.5c1.5 1.5 1.5 3.5 0 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M16.5 8c3 3 3 7 0 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Tap for sound</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
