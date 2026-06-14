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
  const game = await runtime.storage.games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (game.status === "FINAL") {
    return NextResponse.json(
      { error: "Completed game lineups are read-only." },
      { status: 409 }
    );
  }
  const entries = await runtime.storage.rosters.getGameRoster(gameId);
  const teamEntries = entries.filter((entry) => entry.teamId === input.teamId);
  if (
    input.playerIds.length !== teamEntries.length ||
    new Set(input.playerIds).size !== teamEntries.length ||
    input.playerIds.some(
      (playerId) =>
        !teamEntries.some((entry) => entry.playerId === playerId)
    )
  ) {
    return NextResponse.json(
      { error: "The lineup must include every game-roster player once." },
      { status: 400 }
    );
  }
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
  return NextResponse.json({
    ok: true,
    gameId,
    teamId: input.teamId,
    playerIds: input.playerIds
  });
}
