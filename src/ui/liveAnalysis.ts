/**
 * Debounced, latest-wins analysis runner (framework-free so it can be unit-tested).
 * Every update() invalidates earlier requests immediately — before the debounce fires — so a
 * result for old settings can never be shown once the settings have changed.
 */
import { SupersededError } from '../engine/client';
import type { Analysis, Settings } from '../engine/types';

export const ANALYZE_DEBOUNCE_MS = 300;

export interface LiveAnalysisCallbacks {
  onBusy: (busy: boolean) => void;
  onResult: (analysis: Analysis) => void;
  onError: (message: string) => void;
}

export class LiveAnalysis {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly run: (settings: Settings) => Promise<Analysis>,
    private readonly callbacks: LiveAnalysisCallbacks,
    private readonly delayMs = ANALYZE_DEBOUNCE_MS,
  ) {}

  update(settings: Settings): void {
    const generation = this.invalidate();
    if (!settings.seed) {
      this.callbacks.onBusy(false);
      return;
    }
    this.callbacks.onBusy(true);
    this.timer = setTimeout(() => this.start(generation, settings), this.delayMs);
  }

  dispose(): void {
    this.invalidate();
  }

  private invalidate(): number {
    clearTimeout(this.timer);
    return ++this.generation;
  }

  private start(generation: number, settings: Settings): void {
    this.run(settings).then(
      (analysis) => {
        if (generation !== this.generation) return;
        this.callbacks.onResult(analysis);
        this.callbacks.onBusy(false);
      },
      (err: unknown) => {
        if (generation !== this.generation || err instanceof SupersededError) return;
        this.callbacks.onError(err instanceof Error ? err.message : String(err));
        this.callbacks.onBusy(false);
      },
    );
  }
}
