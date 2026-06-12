import type { BaseState } from "@ll-score/contracts";

export function occupiedBaseCount(state: BaseState): number {
  return [state.first, state.second, state.third].filter(Boolean).length;
}
