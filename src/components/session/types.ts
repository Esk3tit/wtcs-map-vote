import type { Id } from "../../../convex/_generated/dataModel";

export interface RoundHistoryBan {
  mapId: Id<"sessionMaps">;
  mapName: string;
  bannedByTeam: string;
  voteCount?: number;
}

export interface RoundHistoryEntry {
  round: number;
  bans: RoundHistoryBan[];
}

export interface MapInfo {
  _id: Id<"sessionMaps">;
  imageUrl: string;
}
