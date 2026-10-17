const FALLBACK_SEED = 0x6d2b79f5;

export interface RandomSample {
  state: number;
  value: number;
}

export function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? FALLBACK_SEED : normalized;
}

export function nextRandom(seed: number): RandomSample {
  let state = normalizeSeed(seed);
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  state >>>= 0;

  return {
    state: normalizeSeed(state),
    value: state / 0x1_0000_0000
  };
}

export function hashText(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return normalizeSeed(hash);
}
