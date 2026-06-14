import { NextResponse } from "next/server";
import {
  playerPositionSchema,
  type PlayerPosition
} from "@ll-score/contracts";
import { getRuntime } from "@/lib/runtime";

interface RosterUpdate {
  playerId: string;
  displayName: string;
  jerseyNumber: string;
  primaryPosition: PlayerPosition;
  bats: "LEFT" | "RIGHT" | "SWITCH";
  throws: "LEFT" | "RIGHT";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const runtime = await getRuntime();
  const team = await runtime.storage.teams.getById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  const memberships = (await runtime.storage.memberships.listForTeam(teamId))
    .filter((membership) => membership.status === "ACTIVE");
  const roster = await Promise.all(
    memberships.map(async (membership) => {
      const player = await runtime.storage.players.getById(membership.playerId);
      const person = player
        ? await runtime.storage.people.getById(player.personId)
        : null;
      return {
        playerId: membership.playerId,
        displayName: person?.displayName ?? membership.playerId,
        jerseyNumber: membership.jerseyNumber ?? "",
        primaryPosition:
          membership.primaryPosition ?? player?.primaryPosition ?? "UNKNOWN",
        bats: player?.bats === "UNKNOWN" ? "RIGHT" : player?.bats ?? "RIGHT",
        throws:
          player?.throws === "UNKNOWN" ? "RIGHT" : player?.throws ?? "RIGHT"
      };
    })
  );
  return NextResponse.json({ team, roster });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const input = (await request.json()) as {
    name?: string;
    roster?: RosterUpdate[];
  };
  const name = input.name?.trim() ?? "";
  const roster = input.roster ?? [];
  if (!name) {
    return NextResponse.json(
      { error: "Team name is required." },
      { status: 400 }
    );
  }
  if (
    roster.some(
      (player) =>
        !player.playerId ||
        !player.displayName.trim() ||
        !player.jerseyNumber.trim() ||
        !playerPositionSchema.safeParse(player.primaryPosition).success ||
        !["LEFT", "RIGHT", "SWITCH"].includes(player.bats) ||
        !["LEFT", "RIGHT"].includes(player.throws)
    )
  ) {
    return NextResponse.json(
      { error: "Every player needs a name, number, and valid attributes." },
      { status: 400 }
    );
  }
  const runtime = await getRuntime();
  const team = await runtime.storage.teams.getById(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  const memberships = (await runtime.storage.memberships.listForTeam(teamId))
    .filter((membership) => membership.status === "ACTIVE");
  const membershipByPlayer = new Map(
    memberships.map((membership) => [membership.playerId, membership])
  );
  if (
    roster.length !== memberships.length ||
    roster.some((player) => !membershipByPlayer.has(player.playerId))
  ) {
    return NextResponse.json(
      { error: "The submitted roster does not match this team." },
      { status: 400 }
    );
  }
  const records = await Promise.all(
    roster.map(async (rosterPlayer) => {
      const player = await runtime.storage.players.getById(
        rosterPlayer.playerId
      );
      const person = player
        ? await runtime.storage.people.getById(player.personId)
        : null;
      return { rosterPlayer, player, person };
    })
  );
  if (records.some(({ player, person }) => !player || !person)) {
    return NextResponse.json(
      { error: "One or more player records could not be found." },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();
  await runtime.storage.teams.save(
    { ...team, name, updatedAtUtc: now },
    runtime.actorId
  );
  for (const { rosterPlayer, player, person } of records) {
    const membership = membershipByPlayer.get(rosterPlayer.playerId)!;
    await runtime.storage.people.save(
      {
        ...person!,
        displayName: rosterPlayer.displayName.trim(),
        updatedAtUtc: now
      },
      runtime.actorId
    );
    await runtime.storage.players.save(
      {
        ...player!,
        bats: rosterPlayer.bats,
        throws: rosterPlayer.throws,
        primaryPosition: rosterPlayer.primaryPosition,
        updatedAtUtc: now
      },
      runtime.actorId
    );
    await runtime.storage.memberships.save(
      {
        ...membership,
        jerseyNumber: rosterPlayer.jerseyNumber.trim(),
        primaryPosition: rosterPlayer.primaryPosition,
        updatedAtUtc: now
      },
      runtime.actorId
    );
  }

  const rosterByPlayer = new Map(
    roster.map((player) => [player.playerId, player])
  );
  for (const game of await runtime.storage.games.list()) {
    if (
      game.status !== "SCHEDULED" ||
      (game.homeTeamId !== teamId && game.awayTeamId !== teamId)
    ) {
      continue;
    }
    const gameRoster = await runtime.storage.rosters.getGameRoster(game.gameId);
    const updatedRoster = gameRoster.map((entry) => {
      if (entry.teamId !== teamId) return entry;
      const rosterPlayer = rosterByPlayer.get(entry.playerId);
      return rosterPlayer
        ? {
            ...entry,
            displayNameSnapshot: rosterPlayer.displayName.trim(),
            jerseyNumberSnapshot: rosterPlayer.jerseyNumber.trim(),
            teamNameSnapshot: name,
            initialPosition: rosterPlayer.primaryPosition
          }
        : entry;
    });
    await runtime.storage.rosters.replaceGameRoster(
      game.gameId,
      updatedRoster,
      runtime.actorId
    );
  }

  return NextResponse.json({ ok: true });
}
