import type {
  BaseState,
  DefensiveAlignment,
  DefensivePositionChange,
  GameEvent,
  GameRosterEntry,
  PlayerAssignment,
  ReplayFrame,
  RunnerMovement
} from "@ll-score/contracts";
import {
  assignPlayerPosition,
  defensiveAlignmentSchema,
  emptyBaseState
} from "@ll-score/contracts";

export interface ProjectedGame {
  eventVersion: number;
  baseState: BaseState;
  alignments: DefensiveAlignment[];
  frames: ReplayFrame[];
}

function initialAlignments(roster: GameRosterEntry[]): DefensiveAlignment[] {
  const alignments = new Map<string, DefensiveAlignment>();
  for (const entry of roster.filter((item) => item.isPresent)) {
    const alignment = alignments.get(entry.teamId) ?? {
      teamId: entry.teamId,
      assignments: []
    };
    alignment.assignments.push({
      playerId: entry.playerId,
      teamId: entry.teamId,
      displayLabel: entry.jerseyNumberSnapshot
        ? `#${entry.jerseyNumberSnapshot} ${entry.displayNameSnapshot}`
        : entry.displayNameSnapshot,
      position: entry.initialPosition
    });
    alignments.set(entry.teamId, alignment);
  }
  return [...alignments.values()].map((alignment) =>
    defensiveAlignmentSchema.parse(alignment)
  );
}

function cloneAlignments(
  alignments: Map<string, DefensiveAlignment>
): DefensiveAlignment[] {
  return [...alignments.values()].map((alignment) => ({
    teamId: alignment.teamId,
    assignments: alignment.assignments.map((assignment) => ({
      ...assignment
    }))
  }));
}

function applyPositionChanges(
  alignments: Map<string, DefensiveAlignment>,
  changes: DefensivePositionChange[]
): void {
  const byTeam = new Map<string, DefensivePositionChange[]>();
  for (const change of changes) {
    const changesForTeam = byTeam.get(change.teamId) ?? [];
    changesForTeam.push(change);
    byTeam.set(change.teamId, changesForTeam);
  }

  for (const [teamId, changesForTeam] of byTeam) {
    const changedPlayers = new Set(
      changesForTeam.map((change) => change.playerId)
    );
    let alignment: DefensiveAlignment = {
      teamId,
      assignments: (alignments.get(teamId)?.assignments ?? []).filter(
        (assignment) => !changedPlayers.has(assignment.playerId)
      )
    };
    for (const change of changesForTeam) {
      const assignment: PlayerAssignment = {
        playerId: change.playerId,
        teamId,
        displayLabel: change.displayLabel,
        position: change.toPosition
      };
      alignment = assignPlayerPosition(alignment, assignment);
    }
    alignments.set(teamId, alignment);
  }
}

function applyMovement(state: BaseState, movement: RunnerMovement): BaseState {
  const next = { ...state };
  for (const base of ["first", "second", "third"] as const) {
    if (next[base]?.runnerId === movement.runnerId) next[base] = null;
  }
  if (movement.outcome === "SAFE") {
    const runner = {
      runnerId: movement.runnerId,
      displayLabel: movement.runnerId
    };
    if (movement.to === "FIRST") next.first = runner;
    if (movement.to === "SECOND") next.second = runner;
    if (movement.to === "THIRD") next.third = runner;
  }
  return next;
}

function activeEvents(events: GameEvent[]): GameEvent[] {
  const suppressed = new Set<string>();
  for (const event of events) {
    if (event.reversesEventId) suppressed.add(event.reversesEventId);
    if (event.correctsEventId) suppressed.add(event.correctsEventId);
  }
  return events.filter((event) => !suppressed.has(event.eventId));
}

export function projectGame(
  roster: GameRosterEntry[],
  events: GameEvent[]
): ProjectedGame {
  const alignments = new Map(
    initialAlignments(roster).map((alignment) => [
      alignment.teamId,
      alignment
    ])
  );
  let baseState: BaseState = { ...emptyBaseState };
  const frames: ReplayFrame[] = [];

  for (const event of activeEvents(events).sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    const baseStateBefore = { ...baseState };
    const alignmentsBefore = cloneAlignments(alignments);
    if (event.eventType === "HalfInningStarted") {
      baseState = { ...emptyBaseState };
    }
    applyPositionChanges(alignments, event.positionChanges);
    for (const movement of event.runnerMovements) {
      baseState = applyMovement(baseState, movement);
    }
    frames.push({
      eventId: event.eventId,
      eventOrder: event.eventOrder,
      baseStateBefore,
      baseStateAfter: { ...baseState },
      alignmentsBefore,
      alignmentsAfter: cloneAlignments(alignments),
      positionChanges: event.positionChanges,
      movements: event.runnerMovements
    });
  }

  return {
    eventVersion: events.length,
    baseState,
    alignments: cloneAlignments(alignments),
    frames
  };
}
