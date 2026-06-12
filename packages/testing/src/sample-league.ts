import type {
  Game,
  GameRosterEntry,
  Membership,
  Organization,
  Person,
  PlayerPosition,
  PlayerProfile,
  Season,
  Team
} from "@ll-score/contracts";

export interface SampleLeague {
  organization: Organization;
  season: Season;
  teams: Team[];
  people: Person[];
  players: PlayerProfile[];
  memberships: Membership[];
  games: Game[];
  gameRosters: ReadonlyMap<string, GameRosterEntry[]>;
}

const createdAtUtc = "2026-03-01T12:00:00.000Z";
const organizationId = "sample-org-springfield";
const seasonId = "sample-season-2026";

const teamDefinitions = [
  {
    key: "falcons",
    name: "Springfield Falcons",
    players: [
      "Alex",
      "Ben",
      "Caleb",
      "Drew",
      "Eli",
      "Finn",
      "Gabe",
      "Henry",
      "Isaac",
      "Jack",
      "Kai"
    ]
  },
  {
    key: "bears",
    name: "Riverside Bears",
    players: [
      "Liam",
      "Mason",
      "Noah",
      "Owen",
      "Parker",
      "Quinn",
      "Ryan",
      "Sam",
      "Theo",
      "Wyatt",
      "Zane"
    ]
  },
  {
    key: "tigers",
    name: "Lakeside Tigers",
    players: [
      "Aiden",
      "Blake",
      "Carter",
      "Dylan",
      "Easton",
      "Felix",
      "Grayson",
      "Hudson",
      "Ian",
      "Jonah",
      "Logan"
    ]
  },
  {
    key: "sharks",
    name: "Bayview Sharks",
    players: [
      "Miles",
      "Nolan",
      "Oscar",
      "Preston",
      "Reed",
      "Silas",
      "Tate",
      "Victor",
      "Wes",
      "Xavier",
      "Zach"
    ]
  },
  {
    key: "hawks",
    name: "Hillcrest Hawks",
    players: [
      "Archer",
      "Brody",
      "Colin",
      "Dean",
      "Emmett",
      "Ford",
      "Grant",
      "Holden",
      "Jace",
      "Knox",
      "Luke"
    ]
  },
  {
    key: "wolves",
    name: "Oakwood Wolves",
    players: [
      "Max",
      "Nico",
      "Orion",
      "Paxton",
      "Rory",
      "Sawyer",
      "Tristan",
      "Vince",
      "Wade",
      "York",
      "Zion"
    ]
  }
] as const;

const lineupPositions = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "LCF",
  "RCF",
  "RF",
  "BENCH"
] as const satisfies readonly PlayerPosition[];

const gameDefinitions = [
  {
    gameId: "sample-game-falcons-bears",
    homeTeamKey: "falcons",
    awayTeamKey: "bears",
    scheduledStartUtc: "2026-06-13T14:00:00.000Z",
    status: "IN_PROGRESS" as const
  },
  {
    gameId: "sample-game-tigers-sharks",
    homeTeamKey: "tigers",
    awayTeamKey: "sharks",
    scheduledStartUtc: "2026-06-13T16:00:00.000Z",
    status: "SCHEDULED" as const
  },
  {
    gameId: "sample-game-hawks-wolves",
    homeTeamKey: "hawks",
    awayTeamKey: "wolves",
    scheduledStartUtc: "2026-06-14T14:00:00.000Z",
    status: "SCHEDULED" as const
  }
] as const;

export function createSampleLeague(): SampleLeague {
  const organization: Organization = {
    organizationId,
    name: "Springfield Little League",
    createdAtUtc
  };
  const season: Season = {
    seasonId,
    organizationId,
    name: "2026 Spring Season",
    startsOn: "2026-03-01",
    endsOn: "2026-08-31",
    createdAtUtc
  };
  const teams: Team[] = teamDefinitions.map((definition) => ({
    teamId: `sample-team-${definition.key}`,
    organizationId,
    name: definition.name,
    createdAtUtc
  }));
  const teamByKey = new Map(
    teamDefinitions.map((definition, index) => [
      definition.key,
      teams[index]!
    ])
  );
  const people: Person[] = [];
  const players: PlayerProfile[] = [];
  const memberships: Membership[] = [];

  for (const definition of teamDefinitions) {
    const team = teamByKey.get(definition.key)!;
    definition.players.forEach((displayName, index) => {
      const number = index + 1;
      const personId = `sample-person-${definition.key}-${number}`;
      const playerId = `sample-player-${definition.key}-${number}`;
      people.push({ personId, displayName, createdAtUtc });
      players.push({
        playerId,
        personId,
        bats: number % 5 === 0 ? "LEFT" : "RIGHT",
        throws: number % 6 === 0 ? "LEFT" : "RIGHT",
        primaryPosition: lineupPositions[index],
        createdAtUtc
      });
      memberships.push({
        membershipId: `sample-membership-${definition.key}-${number}`,
        playerId,
        teamId: team.teamId,
        seasonId,
        membershipType: "REGULAR",
        status: "ACTIVE",
        jerseyNumber: String(number),
        primaryPosition: lineupPositions[index],
        joinedOn: "2026-03-01",
        createdAtUtc
      });
    });
  }

  const games: Game[] = gameDefinitions.map((definition) => ({
    gameId: definition.gameId,
    homeTeamId: teamByKey.get(definition.homeTeamKey)!.teamId,
    awayTeamId: teamByKey.get(definition.awayTeamKey)!.teamId,
    timezoneName: "America/New_York",
    scheduledStartUtc: definition.scheduledStartUtc,
    status: definition.status,
    createdAtUtc
  }));
  const membershipByPlayer = new Map(
    memberships.map((membership) => [membership.playerId, membership])
  );
  const personById = new Map(people.map((person) => [person.personId, person]));
  const gameRosters = new Map<string, GameRosterEntry[]>();

  for (const game of games) {
    const gameTeams = [game.homeTeamId, game.awayTeamId];
    const entries: GameRosterEntry[] = [];
    for (const teamId of gameTeams) {
      const team = teams.find((item) => item.teamId === teamId)!;
      const teamPlayers = players.filter(
        (player) => membershipByPlayer.get(player.playerId)?.teamId === teamId
      );
      teamPlayers.forEach((player, index) => {
        const membership = membershipByPlayer.get(player.playerId)!;
        entries.push({
          gameId: game.gameId,
          teamId,
          playerId: player.playerId,
          membershipId: membership.membershipId,
          displayNameSnapshot: personById.get(player.personId)!.displayName,
          jerseyNumberSnapshot: membership.jerseyNumber,
          teamNameSnapshot: team.name,
          battingOrder: index + 1,
          initialPosition: lineupPositions[index]!,
          isPresent: true
        });
      });
    }
    gameRosters.set(game.gameId, entries);
  }

  return {
    organization,
    season,
    teams,
    people,
    players,
    memberships,
    games,
    gameRosters
  };
}
