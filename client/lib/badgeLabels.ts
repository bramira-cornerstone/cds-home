export function getBadgeLabel(badgeSrc: string | null | undefined): string | null {
  if (!badgeSrc) return null;
  
  if (badgeSrc.includes("cp-badge")) return "Cornerstone Premiere";
  if (badgeSrc.includes("cy-badge")) return "Championship Year";
  if (badgeSrc.includes("ry-badge")) return "Rookie Relic";
  
  return null;
}
