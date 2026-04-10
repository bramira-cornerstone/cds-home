import { useSharedCountdown } from "@/hooks/useSharedCountdown";

interface CountdownDisplayProps {
  endTimestampSeconds: number;
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export default function CountdownDisplay({
  endTimestampSeconds,
  className = "",
  style,
  showLabel = true,
}: CountdownDisplayProps) {
  const displayText = useSharedCountdown(endTimestampSeconds);

  if (!displayText) return null;

  return (
    <div className={className} style={style}>
      {showLabel ? "Ends: " : ""}{displayText}
    </div>
  );
}
