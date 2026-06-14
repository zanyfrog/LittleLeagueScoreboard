import type { Game, GameEvent, GameRosterEntry } from "@ll-score/contracts";

export type PitchCall =
  | "BALL"
  | "CALLED_STRIKE"
  | "SWINGING_STRIKE"
  | "FOUL"
  | "IN_PLAY"
  | "HIT_BY_PITCH";

export interface CountState {
  balls: number;
  strikes: number;
  outs: number;
}

export interface PlateAppearanceState extends CountState {
  batterId?: string;
  batterLabel?: string;
  pitcherId?: string;
  pitcherLabel?: string;
  pitchNumber: number;
  active: boolean;
  inning: number;
  half: "TOP" | "BOTTOM";
  battingTeamId?: string;
  fieldingTeamId?: string;
  nextBatterId?: string;
  nextBatterLabel?: string;
}

export const emptyCount: CountState = { balls: 0, strikes: 0, outs: 0 };

export function activeGameEvents(events: GameEvent[]): GameEvent[] {
  const suppressed = new Set(
    events
      .map((event) => event.reversesEventId ?? event.correctsEventId)
      .filter((eventId): eventId is string => Boolean(eventId))
  );
  return events.filter(
    (event) =>
      event.eventType !== "EventReversed" &&
      event.eventType !== "EventCorrected" &&
      !suppressed.has(event.eventId)
  );
}

export function projectPlateAppearance(
  events: GameEvent[]
): PlateAppearanceState {
  const state: PlateAppearanceState = {
    ...emptyCount,
    pitchNumber: 0,
    active: false,
    inning: 1,
    half: "TOP"
  };
  const locationActionIds = new Set<string>();

  for (const event of activeGameEvents(events).sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    if (event.eventType === "HalfInningStarted") {
      state.outs = 0;
      state.active = false;
      state.inning = Number(event.payload.inning ?? state.inning);
      state.half = event.payload.half === "BOTTOM" ? "BOTTOM" : "TOP";
    }
    if (event.eventType === "PlateAppearanceStarted") {
      state.balls = 0;
      state.strikes = 0;
      state.pitchNumber = 0;
      state.batterId = String(event.payload.batterId ?? "");
      state.batterLabel = String(event.payload.batterLabel ?? "");
      state.pitcherId = String(event.payload.pitcherId ?? "");
      state.pitcherLabel = String(event.payload.pitcherLabel ?? "");
      state.active = true;
    }
    if (event.eventType === "PitchRecorded" && state.active) {
      const call = event.payload.call as PitchCall | undefined;
      state.pitchNumber += 1;
      if (event.payload.actionId) {
        locationActionIds.add(String(event.payload.actionId));
      }
      if (call === "BALL") state.balls += 1;
      if (call === "CALLED_STRIKE" || call === "SWINGING_STRIKE") {
        state.strikes += 1;
      }
      if (call === "FOUL" && state.strikes < 2) state.strikes += 1;
      if (
        call === "IN_PLAY" ||
        call === "HIT_BY_PITCH" ||
        state.balls >= 4 ||
        state.strikes >= 3
      ) {
        state.active = false;
      }
    }
    if (
      event.eventType === "FieldingActionRecorded" &&
      event.payload.countsTowardPitch === true &&
      state.active
    ) {
      const call = event.payload.result as PitchCall | undefined;
      if (
        !locationActionIds.has(String(event.payload.actionId ?? ""))
      ) {
        state.pitchNumber += 1;
      }
      if (call === "BALL") state.balls += 1;
      if (call === "CALLED_STRIKE" || call === "SWINGING_STRIKE") {
        state.strikes += 1;
      }
      if (call === "FOUL" && state.strikes < 2) state.strikes += 1;
    }
    if (event.eventType === "RunnerOut") {
      state.outs = Math.min(3, state.outs + 1);
      if (event.payload.completesPlateAppearance !== false) {
        state.active = false;
      }
    }
    if (event.eventType === "OutCountAdjusted") {
      const adjustedOuts = Number(event.payload.outs);
      if (Number.isInteger(adjustedOuts)) {
        state.outs = Math.max(0, Math.min(3, adjustedOuts));
      }
    }
    if (
      event.eventType === "RunnerMoved" &&
      (event.payload.reason === "walk" ||
        event.payload.reason === "hit-by-pitch")
    ) {
      state.active = false;
    }
    if (event.eventType === "BallPutInPlay") state.active = false;
  }

  return state;
}

function completedAppearanceCount(
  events: GameEvent[],
  teamId: string,
  teamByPlayer: Map<string, string>
): number {
  let activeForTeam = false;
  let completed = 0;
  for (const event of activeGameEvents(events).sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    if (event.eventType === "PlateAppearanceStarted") {
      const battingTeamId =
        String(event.payload.battingTeamId ?? "") ||
        teamByPlayer.get(String(event.payload.batterId ?? ""));
      activeForTeam = battingTeamId === teamId;
    }
    if (!activeForTeam) continue;
    if (
      event.eventType === "BallPutInPlay" ||
      (event.eventType === "RunnerOut" &&
        event.payload.completesPlateAppearance !== false)
    ) {
      completed += 1;
      activeForTeam = false;
    }
    if (
      event.eventType === "RunnerMoved" &&
      (event.payload.reason === "walk" ||
        event.payload.reason === "hit-by-pitch")
    ) {
      completed += 1;
      activeForTeam = false;
    }
  }
  return completed;
}

export function projectGameFlow(
  game: Game,
  roster: GameRosterEntry[],
  events: GameEvent[]
): PlateAppearanceState {
  const activeEvents = activeGameEvents(events);
  const state = projectPlateAppearance(activeEvents);
  const lastHalf = [...activeEvents]
    .reverse()
    .find((event) => event.eventType === "HalfInningStarted");
  state.inning = Number(lastHalf?.payload.inning ?? 1);
  state.half = lastHalf?.payload.half === "BOTTOM" ? "BOTTOM" : "TOP";
  state.battingTeamId =
    state.half === "TOP" ? game.awayTeamId : game.homeTeamId;
  state.fieldingTeamId =
    state.half === "TOP" ? game.homeTeamId : game.awayTeamId;
  const lineup = roster
    .filter(
      (entry) => entry.teamId === state.battingTeamId && entry.isPresent
    )
    .sort(
      (left, right) =>
        (left.battingOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.battingOrder ?? Number.MAX_SAFE_INTEGER)
    );
  if (lineup.length > 0) {
    const teamByPlayer = new Map(
      roster.map((entry) => [entry.playerId, entry.teamId])
    );
    const index =
      completedAppearanceCount(activeEvents, state.battingTeamId, teamByPlayer) %
      lineup.length;
    const batter = lineup[index];
    state.nextBatterId = batter?.playerId;
    state.nextBatterLabel = batter
      ? `${batter.jerseyNumberSnapshot ? `#${batter.jerseyNumberSnapshot} ` : ""}${batter.displayNameSnapshot}`
      : undefined;
  }
  return state;
}
