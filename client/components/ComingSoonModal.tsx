import { X } from "lucide-react";
import { useEffect } from "react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function ComingSoonModal({
  isOpen,
  onClose,
  title = "Coming Soon",
}: ComingSoonModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl p-8 flex flex-col gap-6 w-full max-w-sm mx-4 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
          aria-label="Close modal"
        >
          <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>

        <div className="pt-2">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white text-center">
            {title}
          </h2>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
