import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { BaseState, RunnerMovement } from "@ll-score/contracts";
import { activeGameEvents, projectGameFlow } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

type PlateAppearanceAction =
  | {
      action: "START";
      batterId: string;
      batterLabel: string;
      pitcherId: string;
      pitcherLabel: string;
    }
  | {
      action: "LOCATION" | "PITCH";
      call?: string;
      pitchType?: string;
      location?: string;
      locationZone?: number;
      locationX?: number;
      locationY?: number;
      isInStrikeZone?: boolean;
      description?: string;
      pitchActionId?: string;
    }
  | {
      action: "RESULT";
      result: string;
      pitchActionId?: string;
      description?: string;
    }
  | {
      action: "BALL_IN_PLAY";
      result: string;
      fieldLocation?: string;
      hitLocationX?: number;
      hitLocationY?: number;
      fieldingSequence?: string;
      description?: string;
    };

function walkMovements(
  batterId: string,
  bases: BaseState,
  cause: "walk" | "hit-by-pitch" = "walk"
): RunnerMovement[] {
  const movements: RunnerMovement[] = [];
  const causeLabel = cause === "hit-by-pitch" ? "hit by pitch" : "walk";
  if (bases.first && bases.second && bases.third) {
    movements.push({
      runnerId: bases.third.runnerId,
      from: "THIRD",
      to: "HOME",
      outcome: "SAFE",
      reason: `forced home by ${causeLabel}`
    });
  }
  if (bases.first && bases.second) {
    movements.push({
      runnerId: bases.second.runnerId,
      from: "SECOND",
      to: "THIRD",
      outcome: "SAFE",
      reason: `forced to third by ${causeLabel}`
    });
  }
  if (bases.first) {
    movements.push({
      runnerId: bases.first.runnerId,
      from: "FIRST",
      to: "SECOND",
      outcome: "SAFE",
      reason: `forced to second by ${causeLabel}`
    });
  }
  movements.push({
    runnerId: batterId,
    from: "BATTER",
    to: "FIRST",
    outcome: "SAFE",
    reason: causeLabel
  });
  return movements;
}

function hitMovements(
  batterId: string,
  bases: BaseState,
  basesEarned: number
): RunnerMovement[] {
  const movements: RunnerMovement[] = [];
  const occupied = [
    { runner: bases.third, from: "THIRD" as const, index: 3 },
    { runner: bases.second, from: "SECOND" as const, index: 2 },
    { runner: bases.first, from: "FIRST" as const, index: 1 }
  ];
  for (const item of occupied) {
    if (!item.runner) continue;
    const destination = item.index + basesEarned;
    movements.push({
      runnerId: item.runner.runnerId,
      from: item.from,
      to:
        destination >= 4
          ? "HOME"
          : destination === 3
            ? "THIRD"
            : destination === 2
              ? "SECOND"
              : "FIRST",
      outcome: "SAFE",
      reason: `advanced on ${basesEarned}-base hit`
    });
  }
  movements.push({
    runnerId: batterId,
    from: "BATTER",
    to:
      basesEarned >= 4
        ? "HOME"
        : basesEarned === 3
          ? "THIRD"
          : basesEarned === 2
            ? "SECOND"
            : "FIRST",
    outcome: "SAFE",
    reason: `${basesEarned}-base hit`
  });
  return movements;
}

function inferFieldLocation(sequence?: string): string | undefined {
  const firstFielder = sequence?.trim().match(/^(1|2|3|4|5|6|7|8|9)\b/)?.[1];
  return {
    "1": "P",
    "2": "C",
    "3": "1B",
    "4": "2B",
    "5": "3B",
    "6": "SS",
    "7": "LF",
    "8": "LCF",
    "9": "RF"
  }[firstFielder ?? ""];
}

async function finishHalfInningIfNeeded(
  gameId: string,
  outsAfterPlay: number,
  inning: number,
  half: "TOP" | "BOTTOM",
  runtime: Awaited<ReturnType<typeof getRuntime>>,
  actionId: string
) {
  if (outsAfterPlay < 3) return;
  const nextHalf = half === "TOP" ? "BOTTOM" : "TOP";
  const nextInning = half === "BOTTOM" ? inning + 1 : inning;
  await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "HalfInningStarted",
      payload: { inning: nextInning, half: nextHalf, actionId }
    },
    requestContext(runtime.actorId, gameId)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as PlateAppearanceAction;
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const [game, roster, replay] = await Promise.all([
    runtime.storage.games.getById(gameId),
    runtime.storage.rosters.getGameRoster(gameId),
    runtime.engine.replay.getReplay(gameId, context)
  ]);
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  const flow = projectGameFlow(game, roster, replay.events);

  if (input.action === "START") {
    const actionId = randomUUID();
    if (input.batterId !== flow.nextBatterId) {
      return NextResponse.json(
        { error: `Next batter must be ${flow.nextBatterLabel}.` },
        { status: 400 }
      );
    }
    const result = await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "PlateAppearanceStarted",
        payload: {
          ...input,
          actionId,
          battingTeamId: flow.battingTeamId,
          fieldingTeamId: flow.fieldingTeamId,
          inning: flow.inning,
          half: flow.half
        }
      },
      context
    );
    return NextResponse.json(result);
  }

  if (input.action === "LOCATION" || input.action === "PITCH") {
    const actionId = input.pitchActionId ?? randomUUID();
    const priorLocation = input.pitchActionId
      ? [...activeGameEvents(replay.events)]
          .reverse()
          .find(
            (event) =>
              event.eventType === "PitchRecorded" &&
              String(event.payload.actionId ?? "") === input.pitchActionId &&
              event.payload.source === "location"
          )
      : undefined;
    if (input.pitchActionId && !priorLocation) {
      return NextResponse.json(
        { error: "The pending pitch location could not be found." },
        { status: 409 }
      );
    }
    const pitch = await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "PitchRecorded",
        payload: {
          ...input,
          call: input.action === "PITCH" ? input.call : undefined,
          actionId,
          source: "location"
        },
        correctsEventId: priorLocation?.eventId,
        correctionNote: priorLocation
          ? "Pitch location changed before the official result"
          : undefined
      },
      context
    );
    return NextResponse.json(pitch);
  }

  if (input.action === "RESULT") {
    const actionId = input.pitchActionId ?? randomUUID();
    const result = await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "FieldingActionRecorded",
        payload: {
          result: input.result,
          description: input.description,
          actionId,
          source: "pitch-result",
          countsTowardPitch: true
        }
      },
      context
    );
    const isWalk = input.result === "BALL" && flow.balls === 3;
    const isStrikeout =
      (input.result === "CALLED_STRIKE" ||
        input.result === "SWINGING_STRIKE") &&
      flow.strikes === 2;
    if (isWalk && flow.batterId) {
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "RunnerMoved",
          payload: { reason: "walk", actionId },
          runnerMovements: walkMovements(flow.batterId, replay.currentBaseState)
        },
        context
      );
    }
    if (isStrikeout && flow.batterId) {
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "RunnerOut",
          payload: {
            reason: "strikeout",
            batterId: flow.batterId,
            actionId
          },
          runnerMovements: [{
            runnerId: flow.batterId,
            from: "BATTER",
            to: "OUT",
            outcome: "OUT",
            reason: "strikeout"
          }]
        },
        context
      );
      await finishHalfInningIfNeeded(
        gameId,
        flow.outs + 1,
        flow.inning,
        flow.half,
        runtime,
        actionId
      );
    }
    if (input.result === "HIT_BY_PITCH" && flow.batterId) {
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "RunnerMoved",
          payload: { reason: "hit-by-pitch", actionId },
          runnerMovements: walkMovements(
            flow.batterId,
            replay.currentBaseState,
            "hit-by-pitch"
          )
        },
        requestContext(runtime.actorId, gameId)
      );
    }
    return NextResponse.json(result);
  }

  if (input.action !== "BALL_IN_PLAY") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  if (
    input.result === "Ground Out" &&
    !input.fieldingSequence?.trim()
  ) {
    return NextResponse.json(
      { error: "Ground outs require a fielding sequence, such as SS to 1B." },
      { status: 400 }
    );
  }

  const actionId = randomUUID();
  const fieldLocation =
    input.fieldLocation ?? inferFieldLocation(input.fieldingSequence);
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "BallPutInPlay",
      payload: { ...input, fieldLocation, actionId }
    },
    context
  );
  const hitBases = new Map([
    ["Single", 1],
    ["Double", 2],
    ["Triple", 3],
    ["Home run", 4]
  ]).get(input.result);
  if (hitBases && flow.batterId) {
    await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "RunnerMoved",
        payload: {
          reason: "hit",
          actionId,
          result: input.result,
          hitLocationX: input.hitLocationX,
          hitLocationY: input.hitLocationY,
          fieldLocation: input.fieldLocation
        },
        runnerMovements: hitMovements(
          flow.batterId,
          replay.currentBaseState,
          hitBases
        )
      },
      requestContext(runtime.actorId, gameId)
    );
  }
  const isOut = [
    "Ground Out",
    "Fly Out",
    "Line Out",
    "Pop Out",
    "Sacrifice Fly",
    "Sacrifice Bunt"
  ].includes(input.result);
  if (isOut && flow.batterId) {
    await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "RunnerOut",
        payload: {
          reason: input.result,
          batterId: flow.batterId,
          fieldingSequence: input.fieldingSequence?.trim(),
          actionId
        },
        runnerMovements: [{
          runnerId: flow.batterId,
          from: "BATTER",
          to: "OUT",
          outcome: "OUT",
          reason: input.result
        }]
      },
      requestContext(runtime.actorId, gameId)
    );
    await finishHalfInningIfNeeded(
      gameId,
      flow.outs + 1,
      flow.inning,
      flow.half,
      runtime,
      actionId
    );
  }
  return NextResponse.json(result);
}
