import { NextResponse } from "next/server";
import { createEmptyScoreboard, projectScore } from "@ll-score/scoreboard";
import { projectGameFlow } from "@ll-score/count-controls";
import { getRuntime, requestContext } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const [game, lineups, replay, roster] = await Promise.all([
    runtime.engine.games.getGame(gameId, context),
    runtime.engine.rosters.getCurrentLineups({ gameId }, context),
    runtime.engine.replay.getReplay(gameId, context),
    runtime.storage.rosters.getGameRoster(gameId)
  ]);
  const plateAppearance = projectGameFlow(game, roster, replay.events);
  const score = projectScore(game, replay.events);
  return NextResponse.json({
    game,
    lineups,
    replay,
    scoreboard: {
      ...createEmptyScoreboard(
        game.homeTeamName,
        game.awayTeamName,
        game.status
      ),
      ...score,
      balls: plateAppearance.balls,
      strikes: plateAppearance.strikes,
      outs: plateAppearance.outs,
      inning: plateAppearance.inning,
      half: plateAppearance.half
    },
    plateAppearance
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const deleted = await runtime.engine.games.deleteGame(
    gameId,
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json({ deleted });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const input = (await request.json()) as {
    scheduledStartUtc?: string;
    locationName?: string;
  };
  const scheduledStartUtc = input.scheduledStartUtc?.trim();
  if (
    scheduledStartUtc &&
    Number.isNaN(new Date(scheduledStartUtc).getTime())
  ) {
    return NextResponse.json(
      { error: "Enter a valid matchup date and time." },
      { status: 400 }
    );
  }
  const runtime = await getRuntime();
  const game = await runtime.engine.games.updateGameDetails(
    gameId,
    {
      scheduledStartUtc: scheduledStartUtc
        ? new Date(scheduledStartUtc).toISOString()
        : undefined,
      locationName: input.locationName?.trim() || undefined
    },
    requestContext(runtime.actorId, gameId)
  );
  return NextResponse.json({ game });
}
