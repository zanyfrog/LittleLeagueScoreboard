export class WriteQueue {
  #chain: Promise<void> = Promise.resolve();

  enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#chain.then(work, work);
    this.#chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
