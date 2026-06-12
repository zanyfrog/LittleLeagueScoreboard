import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { GameRosterEntry } from "@ll-score/contracts";
import { getRuntime } from "@/lib/runtime";

export async function POST(request: Request) {
  const runtime = await getRuntime();
  const input = (await request.json()) as {
    awayTeamId: string;
    homeTeamId: string;
  };
  if (input.awayTeamId === input.homeTeamId) {
    return NextResponse.json({ error: "Choose two different teams." }, { status: 400 });
  }
  const [away, home] = await Promise.all([
    runtime.storage.teams.getById(input.awayTeamId),
    runtime.storage.teams.getById(input.homeTeamId)
  ]);
  if (!away || !home) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  const gameId = `game-${randomUUID()}`;
  const now = new Date().toISOString();
  await runtime.storage.games.save(
    {
      gameId,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
      timezoneName: "America/New_York",
      scheduledStartUtc: now,
      status: "SCHEDULED",
      createdAtUtc: now
    },
    runtime.actorId
  );
  const entries: GameRosterEntry[] = [];
  for (const team of [away, home]) {
    const memberships = (await runtime.storage.memberships.listForTeam(team.teamId))
      .filter((membership) => membership.status === "ACTIVE");
    for (const [index, membership] of memberships.entries()) {
      const player = await runtime.storage.players.getById(membership.playerId);
      const person = player
        ? await runtime.storage.people.getById(player.personId)
        : null;
      entries.push({
        gameId,
        teamId: team.teamId,
        playerId: membership.playerId,
        membershipId: membership.membershipId,
        displayNameSnapshot: person?.displayName ?? `Player ${index + 1}`,
        jerseyNumberSnapshot: membership.jerseyNumber,
        teamNameSnapshot: team.name,
        battingOrder: index + 1,
        initialPosition: membership.primaryPosition ?? "UNKNOWN",
        isPresent: true
      });
    }
  }
  await runtime.storage.rosters.replaceGameRoster(gameId, entries, runtime.actorId);
  return NextResponse.json({ gameId });
}
