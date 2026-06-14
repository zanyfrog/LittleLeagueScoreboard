import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { projectGameFlow } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as { outs?: number; reason?: string };
  if (
    !Number.isInteger(input.outs) ||
    Number(input.outs) < 0 ||
    Number(input.outs) > 3
  ) {
    return NextResponse.json(
      { error: "Out count must be 0, 1, 2, or 3." },
      { status: 400 }
    );
  }

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
  const flow = projectGameFlow(game, roster, replay.events);
  const actionId = randomUUID();
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "OutCountAdjusted",
      payload: {
        outs: input.outs,
        previousOuts: flow.outs,
        reason: input.reason?.trim() || "scorekeeper out-count adjustment",
        actionId
      }
    },
    context
  );

  if (input.outs === 3) {
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

  return NextResponse.json(result);
}
