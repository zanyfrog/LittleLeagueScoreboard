import { NextResponse } from "next/server";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as {
    teamId: string;
    playerIds: string[];
  };
  const runtime = await getRuntime();
  const entries = await runtime.storage.rosters.getGameRoster(gameId);
  const order = new Map(input.playerIds.map((playerId, index) => [playerId, index + 1]));
  const updated = entries.map((entry) =>
    entry.teamId === input.teamId
      ? { ...entry, battingOrder: order.get(entry.playerId) ?? entry.battingOrder }
      : entry
  );
  await runtime.engine.rosters.setGameRoster(
    { gameId, entries: updated },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json({ ok: true });
}
