/** 32-bit Mulberry32 deterministic PRNG. */
export interface BombermanRandom {
  next(): number;
}

export class Mulberry32 implements BombermanRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) from deterministic state. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns the current 32-bit state (for serialization). */
  getState(): number {
    return this.state;
  }

  /** Restores state from a previously captured value. */
  setState(state: number): void {
    this.state = state | 0;
  }

  /** Clone this RNG (independent copy of current state). */
  clone(): Mulberry32 {
    const c = new Mulberry32(0);
    c.state = this.state;
    return c;
  }
}

/** Create a Mulberry32 from a numeric seed. */
export function createRandom(seed: number): Mulberry32 {
  return new Mulberry32(seed);
}
