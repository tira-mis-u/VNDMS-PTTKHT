export interface AtomicMutationState<TSnapshot, TControl> {
  snapshot: TSnapshot;
  control: TControl;
}

export interface AtomicMutationCommit<TSnapshot, TControl> {
  (state: AtomicMutationState<TSnapshot, TControl>): void;
}

/**
 * Application-level atomicity for the deterministic local repository.
 * A command writes only to an isolated draft. The draft is published once
 * after successful completion and discarded when the command throws.
 */
export class OperationalMutationBoundary<TSnapshot, TControl> {
  private draft: AtomicMutationState<TSnapshot, TControl> | null = null;
  private depth = 0;

  private readonly clone: (
    state: AtomicMutationState<TSnapshot, TControl>,
  ) => AtomicMutationState<TSnapshot, TControl>;

  constructor(
    clone: (
      state: AtomicMutationState<TSnapshot, TControl>,
    ) => AtomicMutationState<TSnapshot, TControl> = structuredClone,
  ) {
    this.clone = clone;
  }

  get active() {
    return this.draft !== null;
  }

  execute<TResult>(
    current: AtomicMutationState<TSnapshot, TControl>,
    commit: AtomicMutationCommit<TSnapshot, TControl>,
    operation: () => TResult,
  ): TResult {
    if (this.draft) {
      this.depth++;
      try {
        return operation();
      } finally {
        this.depth--;
      }
    }
    this.draft = this.clone(current);
    this.depth = 1;
    try {
      const result = operation();
      const completed = this.draft;
      this.draft = null;
      this.depth = 0;
      commit(completed);
      return result;
    } catch (error) {
      this.draft = null;
      this.depth = 0;
      throw error;
    }
  }

  readSnapshot() {
    if (!this.draft)
      throw new Error("Operational mutation draft chưa được khởi tạo.");
    return this.draft.snapshot;
  }

  readControl() {
    if (!this.draft)
      throw new Error("Operational mutation draft chưa được khởi tạo.");
    return this.draft.control;
  }

  updateSnapshot(update: (snapshot: TSnapshot) => TSnapshot) {
    if (!this.draft)
      throw new Error("Operational mutation draft chưa được khởi tạo.");
    this.draft.snapshot = update(this.draft.snapshot);
  }

  updateControl(update: (control: TControl) => TControl) {
    if (!this.draft)
      throw new Error("Operational mutation draft chưa được khởi tạo.");
    this.draft.control = update(this.draft.control);
  }
}
