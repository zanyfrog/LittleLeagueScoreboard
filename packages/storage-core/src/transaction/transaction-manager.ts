export interface TransactionManager {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
