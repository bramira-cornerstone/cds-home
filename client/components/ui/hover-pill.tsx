import React from "react";
import clsx from "clsx";

export type HoverPillProps = {
  label: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  direction?: "right" | "left"; // expand direction
  // Optional additional classes for the inner pill wrapper
  pillClassName?: string;
  // Optional overrides for the label span (e.g. to change the max width)
  labelClassName?: string;
};

/**
 * HoverPill renders a circular icon that expands into a continuous pill on hover/focus to reveal a label.
 * - Collapsed: perfect circle with the icon centered.
 * - Expanded: one long horizontal oval with the label attached to the circle.
 */
export function HoverPill({
  label,
  onClick,
  className,
  icon = "×",
  ariaLabel = label,
  direction = "right",
  pillClassName,
  labelClassName,
}: HoverPillProps) {
  const reverse = direction === "left";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={label}
      className={clsx("group inline-flex items-center focus:outline-none", className)}
      onClick={onClick}
    >
      <span
        className={clsx(
          "inline-flex items-center rounded-full bg-white text-black border border-black/20 shadow overflow-hidden transition-all duration-200",
          reverse && "flex-row-reverse",
          pillClassName,
        )}
      >
        <span className="h-8 w-8 inline-flex items-center justify-center">{icon}</span>
        <span
          className={clsx(
            "pointer-events-none h-8 inline-flex items-center whitespace-nowrap pr-0 pl-0 w-0 max-w-0 opacity-0 transition-all duration-200 ease-out text-sm font-medium",
            reverse ? "translate-x-2" : "-translate-x-2",
            // Expand smoothly while keeping the single continuous pill
            reverse
              ? "group-hover:opacity-100 group-hover:max-w-[120px] group-hover:w-auto group-hover:px-2 group-hover:-translate-x-0 group-focus-visible:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:w-auto group-focus-visible:px-2 group-focus-visible:-translate-x-0"
              : "group-hover:opacity-100 group-hover:max-w-[120px] group-hover:w-auto group-hover:px-2 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:w-auto group-focus-visible:px-2 group-focus-visible:translate-x-0",
            labelClassName,
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

export default HoverPill;
