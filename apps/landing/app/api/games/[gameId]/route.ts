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
