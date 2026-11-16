// Deterministic seeded RNG (mulberry32). State is a plain uint32 kept in save data.
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

export function pickIndex(state: number, length: number): { index: number; state: number } {
  const r = nextRandom(state);
  return { index: Math.floor(r.value * length), state: r.state };
}
