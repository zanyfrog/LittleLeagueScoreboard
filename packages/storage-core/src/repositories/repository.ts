export interface Repository<T> {
  getById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(value: T, actorId: string): Promise<void>;
}
