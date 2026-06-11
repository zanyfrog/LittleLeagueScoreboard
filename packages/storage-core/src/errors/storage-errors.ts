export class StorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
    this.code = code;
  }
}

export class StreamVersionConflictError extends StorageError {
  constructor(streamId: string, expected: number, actual: number) {
    super(
      "STREAM_VERSION_CONFLICT",
      `Stream ${streamId} expected version ${expected}, but is at version ${actual}`
    );
    this.name = "StreamVersionConflictError";
  }
}

export class DataCorruptionError extends StorageError {
  constructor(path: string, detail: string) {
    super("DATA_CORRUPTION", `${path}: ${detail}`);
    this.name = "DataCorruptionError";
  }
}

export class DataDirectoryLockedError extends StorageError {
  constructor(path: string) {
    super("DATA_DIRECTORY_LOCKED", `Data directory is already locked: ${path}`);
    this.name = "DataDirectoryLockedError";
  }
}

export class StorageNotConfiguredError extends StorageError {
  constructor(adapter: string) {
    super(
      "STORAGE_NOT_CONFIGURED",
      `${adapter} storage is scaffolded but not configured`
    );
    this.name = "StorageNotConfiguredError";
  }
}
