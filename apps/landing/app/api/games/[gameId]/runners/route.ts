import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { BaseLocation } from "@ll-score/contracts";
import { projectGameFlow } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as {
    runnerId: string;
    from: BaseLocation;
    to: BaseLocation;
    outcome: "SAFE" | "OUT";
    reason?: string;
    outType?: "PICKOFF" | "THROW_OUT" | "CAUGHT_STEALING";
    attemptedBase?: "SECOND" | "THIRD" | "HOME";
    fieldingSequence?: string;
    completesPlateAppearance?: boolean;
  };
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const [game, roster, replay] = await Promise.all([
    runtime.storage.games.getById(gameId),
    runtime.storage.rosters.getGameRoster(gameId),
    runtime.engine.replay.getReplay(gameId, context)
  ]);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (
    input.outcome === "OUT" &&
    (input.outType === "PICKOFF" || input.outType === "THROW_OUT") &&
    !input.fieldingSequence?.trim()
  ) {
    return NextResponse.json(
      { error: "Pickoffs and throw outs require a fielding sequence." },
      { status: 400 }
    );
  }
  const actionId = randomUUID();
  const reason =
    input.outType === "PICKOFF"
      ? "pickoff"
      : input.outType === "THROW_OUT"
        ? "throw out"
        : input.outType === "CAUGHT_STEALING"
          ? `caught stealing ${String(input.attemptedBase ?? "").toLowerCase()}`
        : input.reason ?? "manual scorer entry";
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: input.outcome === "OUT" ? "RunnerOut" : "RunnerMoved",
      payload: {
        reason,
        outType: input.outType,
        attemptedBase: input.attemptedBase,
        fieldingSequence: input.fieldingSequence?.trim(),
        completesPlateAppearance:
          input.completesPlateAppearance ?? input.from === "BATTER",
        actionId
      },
      runnerMovements: [{
        runnerId: input.runnerId,
        from: input.from,
        to: input.to,
        outcome: input.outcome,
        reason:
          input.fieldingSequence?.trim()
            ? `${reason}: ${input.fieldingSequence.trim()}`
            : reason
      }]
    },
    context
  );
  if (input.outcome === "OUT") {
    const flow = projectGameFlow(game, roster, replay.events);
    if (flow.outs + 1 >= 3) {
      const nextHalf = flow.half === "TOP" ? "BOTTOM" : "TOP";
      const nextInning = flow.half === "BOTTOM" ? flow.inning + 1 : flow.inning;
      await runtime.engine.scoring.recordEvent(
        {
          gameId,
          eventType: "HalfInningStarted",
          payload: { inning: nextInning, half: nextHalf, actionId }
        },
        context
      );
    }
  }
  return NextResponse.json(result);
}
