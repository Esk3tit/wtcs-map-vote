/**
 * Format team names for display.
 */
export function formatTeamDisplay(teams: string[]): string {
  if (teams.length >= 2) return `${teams[0]} vs ${teams[1]}`;
  if (teams.length === 1) return teams[0];
  return "No teams assigned";
}
