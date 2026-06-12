import { NextResponse } from "next/server";
import type { BaseState, RunnerMovement } from "@ll-score/contracts";
import { projectGameFlow } from "@ll-score/count-controls";
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
      action: "PITCH";
      call: string;
      pitchType?: string;
      location?: string;
      locationX?: number;
      locationY?: number;
      isInStrikeZone?: boolean;
      description?: string;
    }
  | {
      action: "BALL_IN_PLAY";
      result: string;
      fieldLocation?: string;
      hitLocationX?: number;
      hitLocationY?: number;
      description?: string;
    };

function walkMovements(
  batterId: string,
  bases: BaseState
): RunnerMovement[] {
  const movements: RunnerMovement[] = [];
  if (bases.first && bases.second && bases.third) {
    movements.push({
      runnerId: bases.third.runnerId,
      from: "THIRD",
      to: "HOME",
      outcome: "SAFE",
      reason: "forced home by walk"
    });
  }
  if (bases.first && bases.second) {
    movements.push({
      runnerId: bases.second.runnerId,
      from: "SECOND",
      to: "THIRD",
      outcome: "SAFE",
      reason: "forced to third by walk"
    });
  }
  if (bases.first) {
    movements.push({
      runnerId: bases.first.runnerId,
      from: "FIRST",
      to: "SECOND",
      outcome: "SAFE",
      reason: "forced to second by walk"
    });
  }
  movements.push({
    runnerId: batterId,
    from: "BATTER",
    to: "FIRST",
    outcome: "SAFE",
    reason: "walk"
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

async function finishHalfInningIfNeeded(
  gameId: string,
  outsAfterPlay: number,
  inning: number,
  half: "TOP" | "BOTTOM",
  runtime: Awaited<ReturnType<typeof getRuntime>>
) {
  if (outsAfterPlay < 3) return;
  const nextHalf = half === "TOP" ? "BOTTOM" : "TOP";
  const nextInning = half === "BOTTOM" ? inning + 1 : inning;
  await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "HalfInningStarted",
      payload: { inning: nextInning, half: nextHalf }
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

  if (input.action === "PITCH") {
    const pitch = await runtime.engine.scoring.recordEvent(
      { gameId, eventType: "PitchRecorded", payload: input },
      context
    );
    const isWalk = input.call === "BALL" && flow.balls === 3;
    const isStrikeout =
      (input.call === "CALLED_STRIKE" ||
        input.call === "SWINGING_STRIKE") &&
      flow.strikes === 2;
    const isHitByPitch = input.call === "HIT_BY_PITCH";
    if ((isWalk || isHitByPitch) && flow.batterId) {
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "RunnerMoved",
          payload: { reason: isWalk ? "walk" : "hit-by-pitch" },
          runnerMovements: walkMovements(flow.batterId, replay.currentBaseState)
        },
        requestContext(runtime.actorId, gameId)
      );
    }
    if (isStrikeout && flow.batterId) {
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "RunnerOut",
          payload: { reason: "strikeout", batterId: flow.batterId },
          runnerMovements: [{
            runnerId: flow.batterId,
            from: "BATTER",
            to: "OUT",
            outcome: "OUT",
            reason: "strikeout"
          }]
        },
        requestContext(runtime.actorId, gameId)
      );
      await finishHalfInningIfNeeded(
        gameId,
        flow.outs + 1,
        flow.inning,
        flow.half,
        runtime
      );
    }
    return NextResponse.json(pitch);
  }

  const result = await runtime.engine.scoring.recordEvent(
    { gameId, eventType: "BallPutInPlay", payload: input },
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
  const isOut = ["Ground out", "Fly out", "Line out"].includes(input.result);
  if (isOut && flow.batterId) {
    await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "RunnerOut",
        payload: { reason: input.result, batterId: flow.batterId },
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
      runtime
    );
  }
  return NextResponse.json(result);
}
