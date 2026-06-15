import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { projectGameFlow } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as { reason?: string };
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
  if (flow.active) {
    return NextResponse.json(
      { error: "Finish or undo the active batter before ending the half-inning." },
      { status: 409 }
    );
  }

  const nextHalf = flow.half === "TOP" ? "BOTTOM" : "TOP";
  const nextInning = flow.half === "BOTTOM" ? flow.inning + 1 : flow.inning;
  const actionId = randomUUID();
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "HalfInningStarted",
      payload: {
        inning: nextInning,
        half: nextHalf,
        previousInning: flow.inning,
        previousHalf: flow.half,
        previousOuts: flow.outs,
        reason: input.reason?.trim() || "scorekeeper ended half-inning",
        actionId
      }
    },
    context
  );

  return NextResponse.json(result);
}
