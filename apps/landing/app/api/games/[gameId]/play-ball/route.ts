import { NextResponse } from "next/server";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const result = await runtime.engine.scoring.recordEvent(
    { gameId, eventType: "GameStarted", payload: { label: "Play Ball" } },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json(result);
}
