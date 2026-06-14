import { NextResponse } from "next/server";
import { getRuntime, requestContext } from "@/lib/runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const game = await runtime.storage.games.getById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  const context = requestContext(runtime.actorId, gameId);
  const lineups = await runtime.engine.rosters.getCurrentLineups(
    { gameId },
    context
  );
  if (game.status === "SCHEDULED") {
    await runtime.storage.games.save(
      {
        ...game,
        status: "IN_PROGRESS",
        updatedAtUtc: new Date().toISOString()
      },
      runtime.actorId
    );
  }
  const result = await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "GameStarted",
      payload: {
        label: "Play Ball",
        startingLineups: {
          away: {
            teamId: lineups.away.teamId,
            teamName: lineups.away.teamName,
            players: lineups.away.players.map((player, index) => ({
              battingOrder: index + 1,
              playerId: player.playerId,
              displayLabel: player.displayLabel,
              position: player.position
            }))
          },
          home: {
            teamId: lineups.home.teamId,
            teamName: lineups.home.teamName,
            players: lineups.home.players.map((player, index) => ({
              battingOrder: index + 1,
              playerId: player.playerId,
              displayLabel: player.displayLabel,
              position: player.position
            }))
          }
        }
      }
    },
    context
  );
  return NextResponse.json(result);
}
