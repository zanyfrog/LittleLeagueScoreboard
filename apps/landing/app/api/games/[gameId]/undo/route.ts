import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { activeGameEvents } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const replay = await runtime.engine.replay.getReplay(gameId, context);
  const active = activeGameEvents(replay.events);
  const latest = [...active]
    .reverse()
    .find((event) => Boolean(event.payload.actionId));
  if (!latest) {
    return NextResponse.json(
      { error: "There is no recorded action to undo." },
      { status: 404 }
    );
  }
  const actionId = String(latest.payload.actionId);
  const targets = active
    .filter((event) => event.payload.actionId === actionId)
    .sort((left, right) => right.eventOrder - left.eventOrder);
  const undoActionId = randomUUID();
  for (const target of targets) {
    await runtime.engine.scoring.recordEvent(
      {
        gameId,
        eventType: "EventReversed",
        payload: {
          actionId: undoActionId,
          reversedActionId: actionId,
          reversedEventType: target.eventType
        },
        reversesEventId: target.eventId,
        correctionNote: "Undo last scorekeeper action"
      },
      requestContext(runtime.actorId, gameId)
    );
  }
  return NextResponse.json({
    undoneActionId: actionId,
    reversedEventCount: targets.length
  });
}
