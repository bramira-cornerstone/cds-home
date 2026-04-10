import React, { memo } from "react";

interface DarkModeHoverProps {
  children: React.ReactNode;
  tooltip?: string | null;
  className?: string;
}

export const DarkModeHover = memo(function DarkModeHover({
  children,
  tooltip,
  className = "",
}: DarkModeHoverProps) {
  return (
    <div className={`relative group ${className}`} title={tooltip || undefined}>
      {children}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity z-10 dark:bg-slate-700">
          {tooltip}
        </div>
      )}
    </div>
  );
});
