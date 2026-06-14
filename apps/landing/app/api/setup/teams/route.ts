import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRuntime } from "@/lib/runtime";

export async function GET() {
  const runtime = await getRuntime();
  const teams = await runtime.storage.teams.list();
  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
  const runtime = await getRuntime();
  const input = (await request.json()) as {
    name: string;
    playerNames?: string[];
  };
  const now = new Date().toISOString();
  const teamId = `team-${randomUUID()}`;
  const team = {
    teamId,
    organizationId: "sample-organization",
    name: input.name.trim(),
    createdAtUtc: now
  };
  await runtime.storage.teams.save(team, runtime.actorId);
  const names =
    input.playerNames?.map((name) => name.trim()).filter(Boolean) ?? [];
  const players = names.length
    ? names
    : Array.from({ length: 11 }, (_, index) => `Player ${index + 1}`);
  for (const [index, displayName] of players.entries()) {
    const personId = `person-${randomUUID()}`;
    const playerId = `player-${randomUUID()}`;
    await runtime.storage.people.save(
      { personId, displayName, createdAtUtc: now },
      runtime.actorId
    );
    await runtime.storage.players.save(
      {
        playerId,
        personId,
        bats: "RIGHT",
        throws: "RIGHT",
        primaryPosition: index === 0 ? "P" : index === 1 ? "C" : "UNKNOWN",
        createdAtUtc: now
      },
      runtime.actorId
    );
    await runtime.storage.memberships.save(
      {
        membershipId: `membership-${randomUUID()}`,
        playerId,
        teamId,
        seasonId: "sample-season-2026",
        membershipType: "REGULAR",
        status: "ACTIVE",
        jerseyNumber: String(index + 1),
        primaryPosition: index === 0 ? "P" : index === 1 ? "C" : "UNKNOWN",
        joinedOn: "2026-01-01",
        createdAtUtc: now
      },
      runtime.actorId
    );
  }
  return NextResponse.json({ team });
}
