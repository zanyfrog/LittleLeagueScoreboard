import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as { comment?: string };
  const comment = input.comment?.trim();
  if (!comment) {
    return NextResponse.json(
      { error: "A scorekeeper comment is required." },
      { status: 400 }
    );
  }
  if (comment.length > 250) {
    return NextResponse.json(
      { error: "Scorekeeper comments cannot exceed 250 characters." },
      { status: 400 }
    );
  }

  const runtime = await getRuntime();
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "ScorekeeperCommentRecorded",
      payload: { comment, actionId: randomUUID() }
    },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json(result);
}
