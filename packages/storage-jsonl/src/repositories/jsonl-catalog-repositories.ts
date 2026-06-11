import { join } from "node:path";
import type {
  Game,
  Membership,
  Organization,
  Person,
  PlayerProfile,
  Season,
  Team
} from "@ll-score/contracts";
import type {
  GameRepository,
  MembershipRepository,
  OrganizationRepository,
  PersonRepository,
  PlayerRepository,
  SeasonRepository,
  TeamRepository
} from "@ll-score/storage-core";
import { JsonlStream } from "../filesystem/jsonl-stream.js";
import type { WriteQueue } from "../filesystem/write-queue.js";
import { JsonlRepository } from "./jsonl-repository.js";

export interface JsonlCatalogRepositories {
  people: PersonRepository;
  players: PlayerRepository;
  organizations: OrganizationRepository;
  seasons: SeasonRepository;
  teams: TeamRepository;
  memberships: MembershipRepository;
  games: GameRepository;
}

export function createJsonlCatalogRepositories(
  catalogPath: string,
  queue: WriteQueue
): JsonlCatalogRepositories {
  const people = new JsonlRepository(
    new JsonlStream<Person>(join(catalogPath, "people.jsonl"), "catalog:people", queue),
    (value) => value.personId
  );
  const players = new JsonlRepository(
    new JsonlStream<PlayerProfile>(
      join(catalogPath, "player-profiles.jsonl"),
      "catalog:player-profiles",
      queue
    ),
    (value) => value.playerId
  );
  const organizations = new JsonlRepository(
    new JsonlStream<Organization>(
      join(catalogPath, "organizations.jsonl"),
      "catalog:organizations",
      queue
    ),
    (value) => value.organizationId
  );
  const seasons = new JsonlRepository(
    new JsonlStream<Season>(join(catalogPath, "seasons.jsonl"), "catalog:seasons", queue),
    (value) => value.seasonId
  );
  const teams = new JsonlRepository(
    new JsonlStream<Team>(join(catalogPath, "teams.jsonl"), "catalog:teams", queue),
    (value) => value.teamId
  );
  const membershipBase = new JsonlRepository(
    new JsonlStream<Membership>(
      join(catalogPath, "memberships.jsonl"),
      "catalog:memberships",
      queue
    ),
    (value) => value.membershipId
  );
  const memberships: MembershipRepository = {
    getById: (id) => membershipBase.getById(id),
    list: () => membershipBase.list(),
    save: (value, actorId) => membershipBase.save(value, actorId),
    listForPlayer: async (playerId) =>
      (await membershipBase.list()).filter((item) => item.playerId === playerId),
    listForTeam: async (teamId, seasonId) =>
      (await membershipBase.list()).filter(
        (item) =>
          item.teamId === teamId && (!seasonId || item.seasonId === seasonId)
      )
  };
  const games = new JsonlRepository(
    new JsonlStream<Game>(join(catalogPath, "games.jsonl"), "catalog:games", queue),
    (value) => value.gameId
  );

  return { people, players, organizations, seasons, teams, memberships, games };
}
