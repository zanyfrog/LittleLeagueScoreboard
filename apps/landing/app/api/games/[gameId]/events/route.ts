import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { gameEventTypeSchema, runnerMovementSchema } from "@ll-score/contracts";
import { getRuntime, requestContext } from "@/lib/runtime";

const manualEventTypes = [
  "HalfInningStarted",
  "PlateAppearanceStarted",
  "PitchRecorded",
  "ScorekeeperCommentRecorded",
  "BallPutInPlay",
  "FieldingActionRecorded",
  "RunnerMoved",
  "RunnerOut",
  "OutCountAdjusted",
  "RunScored",
  "PitcherChanged"
] as const;
type ManualEventType = (typeof manualEventTypes)[number];

interface EventInput {
  eventType?: ManualEventType;
  eventTimeUtc?: string;
  payload?: unknown;
  runnerMovements?: unknown;
  correctsEventId?: string;
  correctionNote?: string;
}

function validateInput(input: EventInput) {
  const eventType = gameEventTypeSchema.safeParse(input.eventType);
  if (
    !eventType.success ||
    !manualEventTypes.includes(eventType.data as ManualEventType)
  ) {
    return { error: "Choose a recordable event action." } as const;
  }
  const eventTime = new Date(input.eventTimeUtc ?? "");
  if (Number.isNaN(eventTime.getTime())) {
    return { error: "Enter a valid event time." } as const;
  }
  if (
    input.payload === null ||
    typeof input.payload !== "object" ||
    Array.isArray(input.payload)
  ) {
    return { error: "Payload must be a JSON object." } as const;
  }
  const movements = runnerMovementSchema.array().safeParse(
    input.runnerMovements ?? []
  );
  if (!movements.success) {
    return { error: "Runner movements are not valid." } as const;
  }
  return {
    eventType: eventType.data as ManualEventType,
    eventTimeUtc: eventTime.toISOString(),
    payload: input.payload as Record<string, unknown>,
    runnerMovements: movements.data
  } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as EventInput;
  const validated = validateInput(input);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const runtime = await getRuntime();
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: validated.eventType,
      occurredAtUtc: validated.eventTimeUtc,
      payload: {
        ...validated.payload,
        actionId:
          typeof validated.payload.actionId === "string"
            ? validated.payload.actionId
            : randomUUID(),
        manualEntry: true
      },
      runnerMovements: validated.runnerMovements,
      correctionNote: input.correctionNote?.trim(),
      allowFinalizedGameEdit: true
    },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json(result);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as EventInput;
  if (!input.correctsEventId) {
    return NextResponse.json(
      { error: "Select an event to correct." },
      { status: 400 }
    );
  }
  const validated = validateInput(input);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const replay = await runtime.engine.replay.getReplay(gameId, context);
  const target = replay.events.find(
    (event) => event.eventId === input.correctsEventId
  );
  if (!target) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (target.eventType === "EventReversed") {
    return NextResponse.json(
      { error: "Reversal audit records cannot be edited." },
      { status: 400 }
    );
  }
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: validated.eventType,
      occurredAtUtc: validated.eventTimeUtc,
      payload: {
        ...validated.payload,
        manualCorrection: true,
        correctedEventType: target.eventType
      },
      runnerMovements: validated.runnerMovements,
      correctsEventId: target.eventId,
      correctionNote:
        input.correctionNote?.trim() || "Manual event log correction",
      allowFinalizedGameEdit: true
    },
    context
  );
  return NextResponse.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as {
    eventId?: string;
    correctionNote?: string;
  };
  if (!input.eventId) {
    return NextResponse.json(
      { error: "Select an event to reverse." },
      { status: 400 }
    );
  }
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const replay = await runtime.engine.replay.getReplay(gameId, context);
  const target = replay.events.find((event) => event.eventId === input.eventId);
  if (!target) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "EventReversed",
      payload: {
        actionId: randomUUID(),
        reversedEventType: target.eventType,
        manualReversal: true
      },
      reversesEventId: target.eventId,
      correctionNote:
        input.correctionNote?.trim() || "Manual event log reversal",
      allowFinalizedGameEdit: true
    },
    context
  );
  return NextResponse.json(result);
}
