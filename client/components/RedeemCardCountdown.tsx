import { useRedemptionCountdown } from "@/hooks/useRedemptionCountdown";
import { useEffect } from "react";

interface RedeemCardCountdownProps {
  editionId: number;
  cardId?: number;
  onComingSoon?: (cardId: number, isComingSoon: boolean) => void;
}

export function RedeemCardCountdown({ editionId, cardId, onComingSoon }: RedeemCardCountdownProps) {
  const { days, hours, minutes, seconds, isComingSoon } = useRedemptionCountdown(editionId);

  // Notify parent about coming soon status when it changes
  useEffect(() => {
    if (onComingSoon && cardId !== undefined) {
      onComingSoon(cardId, isComingSoon);
    }
  }, [isComingSoon, onComingSoon, cardId]);

  if (isComingSoon) {
    return <span>Coming Soon</span>;
  }

  return (
    <span>
      {days}d {hours}h {minutes}m {seconds}s
    </span>
  );
}
