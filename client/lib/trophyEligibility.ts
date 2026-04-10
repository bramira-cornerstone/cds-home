/**
 * Determines which trophy displays a user is eligible for based on their rank level
 */
export function getEligibleDisplays(
  rankLevel: string | null,
): (
  | "trophy_display1"
  | "trophy_display2"
  | "trophy_display3"
  | "trophy_display4"
  | "trophy_display5"
)[] {
  switch (rankLevel) {
    case "Diamond":
      return [
        "trophy_display1",
        "trophy_display2",
        "trophy_display3",
        "trophy_display4",
        "trophy_display5",
      ];
    case "Epic":
      return [
        "trophy_display1",
        "trophy_display2",
        "trophy_display3",
        "trophy_display4",
      ];
    case "Rare":
      return ["trophy_display1", "trophy_display2", "trophy_display3"];
    case "Basic":
      return ["trophy_display1", "trophy_display2"];
    default:
      return ["trophy_display1"];
  }
}

/**
 * Gets the highest eligible display for a rank level
 */
export function getHighestEligibleDisplay(
  rankLevel: string | null,
):
  | "trophy_display1"
  | "trophy_display2"
  | "trophy_display3"
  | "trophy_display4"
  | "trophy_display5" {
  const eligible = getEligibleDisplays(rankLevel);
  return eligible[eligible.length - 1];
}

/**
 * Determines if a user is eligible for a specific display
 */
export function isDisplayEligible(
  rankLevel: string | null,
  display: string,
): boolean {
  const eligible = getEligibleDisplays(rankLevel);
  return eligible.includes(display as any);
}

/**
 * Maps trophy display names to their slot numbers
 */
export function getDisplaySlotNumber(
  display:
    | "trophy_display1"
    | "trophy_display2"
    | "trophy_display3"
    | "trophy_display4"
    | "trophy_display5",
): number {
  const match = display.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

/**
 * Gets the field names to clear when downgrading from a display
 */
export function getFieldsToClear(slotNumber: number): string[] {
  return [
    `trophy${slotNumber}_editionId`,
    `trophy${slotNumber}_serial`,
    `trophy${slotNumber}_tokenId`,
  ];
}
