import { NextResponse } from "next/server";
import type { BaseLocation } from "@ll-score/contracts";
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
  };
  const runtime = await getRuntime();
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: input.outcome === "OUT" ? "RunnerOut" : "RunnerMoved",
      payload: { reason: input.reason ?? "manual scorer entry" },
      runnerMovements: [{
        runnerId: input.runnerId,
        from: input.from,
        to: input.to,
        outcome: input.outcome,
        reason: input.reason ?? "manual scorer entry"
      }]
    },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json(result);
}
