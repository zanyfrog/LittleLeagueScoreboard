import { NextResponse } from "next/server";
import type { PlayerPosition } from "@ll-score/contracts";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as {
    teamId: string;
    playerId: string;
    toPosition: PlayerPosition;
  };
  const runtime = await getRuntime();
  const result = await runtime.engine.scoring.changePlayerPositions(
    { gameId, changes: [input] },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json(result);
}
