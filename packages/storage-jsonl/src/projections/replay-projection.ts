import type {
  BaseState,
  DefensiveAlignment,
  DefensivePositionChange,
  GameEvent,
  GameProjections,
  PlayerAssignment,
  ReplayFrame,
  RunnerMovement
} from "@ll-score/contracts";
import {
  assignPlayerPosition,
  defensiveAlignmentSchema,
  emptyBaseState
} from "@ll-score/contracts";

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
  const changesByTeam = new Map<string, DefensivePositionChange[]>();
  for (const change of changes) {
    const teamChanges = changesByTeam.get(change.teamId) ?? [];
    teamChanges.push(change);
    changesByTeam.set(change.teamId, teamChanges);
  }

  for (const [teamId, teamChanges] of changesByTeam) {
    const changedPlayers = new Set(teamChanges.map((change) => change.playerId));
    let current: DefensiveAlignment = {
      teamId,
      assignments: (alignments.get(teamId)?.assignments ?? []).filter(
        (assignment) => !changedPlayers.has(assignment.playerId)
      )
    };
    for (const change of teamChanges) {
      const assignment: PlayerAssignment = {
        playerId: change.playerId,
        teamId,
        displayLabel: change.displayLabel,
        position: change.toPosition
      };
      current = assignPlayerPosition(current, assignment);
    }
    alignments.set(teamId, current);
  }
}

function applyRunnerMovement(
  state: BaseState,
  movement: RunnerMovement
): BaseState {
  const next: BaseState = { ...state };
  for (const base of ["first", "second", "third"] as const) {
    if (next[base]?.runnerId === movement.runnerId) next[base] = null;
  }
  const runner = { runnerId: movement.runnerId, displayLabel: movement.runnerId };
  if (movement.outcome === "SAFE") {
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

export function buildGameProjections(
  gameId: string,
  events: GameEvent[],
  initialAlignments: DefensiveAlignment[] = []
): GameProjections {
  const alignments = new Map(
    initialAlignments.map((alignment) => [
      alignment.teamId,
      defensiveAlignmentSchema.parse(alignment)
    ])
  );
  let baseState: BaseState = { ...emptyBaseState };
  const replayFrames: ReplayFrame[] = [];

  for (const event of activeEvents(events).sort(
    (left, right) => left.eventOrder - right.eventOrder
  )) {
    const baseStateBefore = { ...baseState };
    const alignmentsBefore = cloneAlignments(alignments);

    applyPositionChanges(alignments, event.positionChanges);
    for (const movement of event.runnerMovements) {
      baseState = applyRunnerMovement(baseState, movement);
    }

    replayFrames.push({
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
    gameId,
    eventVersion: events.length,
    baseState,
    alignments: cloneAlignments(alignments),
    replayFrames,
    updatedAtUtc: new Date().toISOString()
  };
}
