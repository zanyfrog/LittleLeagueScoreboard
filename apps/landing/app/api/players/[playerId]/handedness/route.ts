import { NextResponse } from "next/server";
import { getRuntime } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const input = (await request.json()) as {
    bats: "LEFT" | "RIGHT" | "SWITCH";
    throws: "LEFT" | "RIGHT";
  };
  if (!["LEFT", "RIGHT", "SWITCH"].includes(input.bats)) {
    return NextResponse.json({ error: "Invalid batting stance." }, { status: 400 });
  }
  if (!["LEFT", "RIGHT"].includes(input.throws)) {
    return NextResponse.json({ error: "Invalid throwing arm." }, { status: 400 });
  }
  const runtime = await getRuntime();
  const player = await runtime.storage.players.getById(playerId);
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  const updated = {
    ...player,
    bats: input.bats,
    throws: input.throws,
    updatedAtUtc: new Date().toISOString()
  };
  await runtime.storage.players.save(updated, runtime.actorId);
  return NextResponse.json({ player: updated });
}
