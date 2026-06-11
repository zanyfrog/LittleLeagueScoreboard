import type { Person } from "@ll-score/contracts";
import type { Repository } from "./repository.js";

export interface PersonRepository extends Repository<Person> {}
