import { NextResponse } from "next/server";
import { projectGameFlow } from "@ll-score/count-controls";
import { projectScore } from "@ll-score/scoreboard";
import { getRuntime, requestContext } from "@/lib/runtime";

export const dynamic = "force-dynamic";

function canFinalizeAfterVisitingLastAtBat(
  inning: number,
  half: "TOP" | "BOTTOM",
  expectedInnings: number
): boolean {
  return inning > expectedInnings || (inning === expectedInnings && half === "BOTTOM");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const runtime = await getRuntime();
  const context = requestContext(runtime.actorId, gameId);
  const [game, roster, events] = await Promise.all([
    runtime.storage.games.getById(gameId),
    runtime.storage.rosters.getGameRoster(gameId),
    runtime.storage.gameEvents.read(gameId)
  ]);

  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (game.status === "FINAL") {
    return NextResponse.json({ game });
  }

  const flow = projectGameFlow(game, roster, events);
  const score = projectScore(game, events);
  const expectedInnings = game.expectedInnings ?? 6;
  if (flow.active) {
    return NextResponse.json(
      { error: "Finish the current batter before marking the game final." },
      { status: 409 }
    );
  }
  if (
    !canFinalizeAfterVisitingLastAtBat(
      flow.inning,
      flow.half,
      expectedInnings
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The visiting team must complete the top of the expected final inning before the game can be marked final."
      },
      { status: 409 }
    );
  }
  if (
    flow.inning === expectedInnings &&
    flow.half === "BOTTOM" &&
    score.homeScore === score.awayScore
  ) {
    return NextResponse.json(
      {
        error:
          "The game is tied. Finish the home half first, then choose extra innings or end the game as a tie."
      },
      { status: 409 }
    );
  }

  await runtime.engine.scoring.recordEvent(
    {
      gameId,
      eventType: "GameFinalized",
      payload: {
        inning: flow.inning,
        half: flow.half,
        expectedInnings,
        reason: "scorekeeper marked final"
      }
    },
    context
  );

  const finalized = {
    ...game,
    status: "FINAL" as const,
    updatedAtUtc: new Date().toISOString()
  };
  await runtime.storage.games.save(finalized, runtime.actorId);
  return NextResponse.json({ game: finalized });
}
