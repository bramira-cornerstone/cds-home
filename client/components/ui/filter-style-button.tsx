import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ComingSoonModal } from "@/components/ComingSoonModal";

export interface FilterStyleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  editionId?: number;
  playerName?: string;
  setName?: string;
  minted?: number | string | null;
  gameDate?: string;
}

// Reusable style matching /editions filter/sort buttons (without dropdown logic)
// Applies the gradient overlay with smooth 1s transition and keeps passed size/colors.
// When editionId is provided, acts as a subscription toggle button with Supabase integration
export const FilterStyleButton = React.forwardRef<
  HTMLButtonElement,
  FilterStyleButtonProps
>(
  (
    {
      className,
      asChild = false,
      editionId,
      playerName,
      setName,
      minted,
      gameDate,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (editionId) {
        setIsComingSoonOpen(true);
      } else {
        onClick?.(e);
      }
    };

    const Comp = asChild ? Slot : "button";

    return (
      <>
        <Comp
          ref={ref as any}
          disabled={props.disabled}
          className={cn(
            "relative overflow-hidden flex items-center justify-center text-center rounded border",
            // base border/text defaults can be overridden by className
            "border-slate-300 bg-white text-slate-800",
            // dark mode: slate grey bg, white text, subtle border
            "dark:bg-slate-700 dark:text-white dark:border-white/10",
            // base gradient and darkened hover layer with smooth crossfade (1s)
            "before:content-[''] before:absolute before:inset-0 before:pointer-events-none",
            "before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)]",
            "after:content-[''] after:absolute after:inset-0 after:pointer-events-none",
            "after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0",
            "hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out",
            "transition-colors duration-200",
            "px-2 py-1",
            className,
          )}
          onClick={handleClick}
          {...props}
        />
        <ComingSoonModal
          isOpen={isComingSoonOpen}
          onClose={() => setIsComingSoonOpen(false)}
          title="Coming Soon"
        />
      </>
    );
  },
);
FilterStyleButton.displayName = "FilterStyleButton";
