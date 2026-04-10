import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import {
  ThumbsUp,
  Gift,
  ShoppingBag,
  Trophy,
  Coins,
  Users,
  BarChart3,
  Moon,
  Sun,
  Recycle,
} from "lucide-react";
import { TbHome } from "react-icons/tb";

// Custom Boxes icon component
const BoxesIcon = (props: { size?: number; className?: string }) => (
  <svg
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    aria-hidden="true"
  >
    <rect x="5" y="10" width="14" height="8" rx="2" />
    <rect x="4" y="7" width="16" height="3" rx="1" />
  </svg>
);

// Custom Question Square icon component
const QuestionSquareIcon = (props: { size?: number; className?: string }) => (
  <svg
    width={props.size || 24}
    height={props.size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9c0-1 1-2 2-2s2 1 2 2c0 1.5-1 2-2 2M12 16h0" />
  </svg>
);

const menuItems = [
  { to: "/collection", label: "Collection", Icon: Trophy },
  { to: "/market", label: "Marketplace", Icon: ShoppingBag },
  { to: "/prior-drops", label: "Drops", Icon: BoxesIcon },
  { to: "/vote", label: "Vote", Icon: ThumbsUp },
  { to: "/redeem", label: "Redeem", Icon: Recycle },
  { to: "/reward", label: "Reward", Icon: Gift },
  { to: "/data", label: "Data", Icon: BarChart3 },
  { to: "/my_club", label: "My Club", Icon: Users },
  { to: "/info", label: "Info", Icon: QuestionSquareIcon },
] as const;

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const betaAllowlist = useBetaAllowlist();

  useEffect(() => {
    const saved = localStorage.getItem("nightMode");
    const enabled = saved === "true";
    setNightMode(enabled);
    if (enabled) document.documentElement.classList.add("dark");
  }, []);

  // Close menu if beta allowlist access is revoked
  useEffect(() => {
    if (betaAllowlist !== true) {
      setMenuOpen(false);
    }
  }, [betaAllowlist]);

  useEffect(() => {
    const onDocPointer = (e: Event) => {
      const t = e.target as Node;
      if (!btnRef.current) return;
      if (btnRef.current.contains(t)) return;
      setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("pointerdown", onDocPointer);
      document.addEventListener("touchstart", onDocPointer, { passive: true });
    }
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer as any);
    };
  }, [menuOpen]);

  const toggleNight = () => {
    const next = !nightMode;
    setNightMode(next);
    localStorage.setItem("nightMode", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  const handleMenuItemClick = (to: string, label?: string) => {
    if (label === "Redeem" || label === "Reward") {
      setIsComingSoonOpen(true);
    } else {
      navigate(to);
    }
    setMenuOpen(false);
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 w-full h-14 md:h-16 border-b border-black/5 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-black/70 dark:supports-[backdrop-filter]:bg-black/60 dark:border-white/10"
        style={{ zIndex: 60 }}
      >
        <div className="container mx-auto h-full px-4 flex items-center justify-between relative">

          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex flex-col items-center gap-1 max-sm:gap-0.5 mr-1.5 sm:mr-2.5 lg:mr-3"
            >
              <TbHome className="h-8 w-8 text-slate-700 dark:text-white" />
              <span className="text-[9px] text-slate-700 dark:text-white max-sm:text-[10px] max-sm:text-gray-500">
                HOME
              </span>
            </Link>

            <button
              ref={btnRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md lg:mr-2 md:mr-1.5 mr-1 transition-all bg-white/60 text-slate-700 hover:bg-white dark:bg-black/60 dark:text-white dark:hover:bg-black cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sliding Menu Bar */}
      <div
        className={`fixed top-14 md:top-16 left-0 right-0 z-30 w-full bg-white/70 dark:bg-black/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/60 border-b border-black/5 dark:border-white/10 transition-all duration-300 overflow-hidden ${
          menuOpen ? "max-h-80 max-lg:max-h-80 lg:max-h-48" : "max-h-0"
        }`}
      >
        <div className="w-full px-4 py-6 flex items-center justify-center">
          <div className="grid grid-cols-5 max-lg:grid-cols-5 lg:grid-cols-10 gap-0 w-full max-w-full px-2">
            {menuItems.map(({ to, label, Icon }, idx) => (
              <button
                key={idx}
                onClick={() => handleMenuItemClick(to, label)}
                className="flex flex-col items-center gap-1.5 px-3 py-2 text-slate-700 dark:text-white hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-w-0"
              >
                <Icon size={24} className="flex-shrink-0" />
                <span className="text-xs max-lg:text-[10px] text-center max-lg:leading-3 leading-tight line-clamp-1">
                  {label}
                </span>
              </button>
            ))}

            {/* Night Mode Toggle - 10th item */}
            <button
              onClick={toggleNight}
              className="flex flex-col items-center gap-1.5 px-3 py-2 text-slate-700 dark:text-white hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-w-0"
            >
              {nightMode ? (
                <Sun size={24} className="flex-shrink-0" />
              ) : (
                <Moon size={24} className="flex-shrink-0" />
              )}
              <span className="text-xs max-lg:text-[10px] text-center max-lg:leading-3 leading-tight line-clamp-1">
                Night Mode
              </span>
            </button>
          </div>
        </div>
      </div>

      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        title="Coming Soon"
      />
    </>
  );
}
