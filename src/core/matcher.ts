export interface Hunk {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
}

interface Exports {
  memory: WebAssembly.Memory;
  mt_alloc(len: number): number;
  mt_free(ptr: number, len: number): void;
  mt_pattern(ptr: number, len: number): number;
  mt_pattern_free(pattern: number): void;
  mt_score(pattern: number, ptr: number, len: number, paths: number): bigint;
  mt_indices(pattern: number, ptr: number, len: number, paths: number): number;
  mt_output(): number;
  mt_diff(before: number, beforeLen: number, after: number, afterLen: number): number;
}

const encoder = new TextEncoder();

export class FuzzyPattern {
  constructor(
    private readonly matcher: Matcher,
    readonly ptr: number,
  ) {}

  score(text: string, paths = false): number | null {
    return this.matcher.score(this, text, paths);
  }

  indices(text: string, paths = false): number[] {
    return this.matcher.indices(this, text, paths);
  }

  free(): void {
    this.matcher.freePattern(this);
  }
}

export class Matcher {
  private constructor(private readonly x: Exports) {}

  static async load(bytes: Uint8Array): Promise<Matcher> {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new Matcher(instance.exports as unknown as Exports);
  }

  private withText<T>(text: string, use: (ptr: number, len: number) => T): T {
    const encoded = encoder.encode(text);
    const ptr = this.x.mt_alloc(encoded.length);
    new Uint8Array(this.x.memory.buffer, ptr, encoded.length).set(encoded);
    try {
      return use(ptr, encoded.length);
    } finally {
      this.x.mt_free(ptr, encoded.length);
    }
  }

  pattern(text: string): FuzzyPattern {
    return new FuzzyPattern(this, this.withText(text, (ptr, len) => this.x.mt_pattern(ptr, len)));
  }

  freePattern(pattern: FuzzyPattern): void {
    this.x.mt_pattern_free(pattern.ptr);
  }

  score(pattern: FuzzyPattern, text: string, paths: boolean): number | null {
    const score = this.withText(text, (ptr, len) => this.x.mt_score(pattern.ptr, ptr, len, paths ? 1 : 0));
    return score < 0n ? null : Number(score);
  }

  indices(pattern: FuzzyPattern, text: string, paths: boolean): number[] {
    const count = this.withText(text, (ptr, len) => this.x.mt_indices(pattern.ptr, ptr, len, paths ? 1 : 0));
    return [...new Uint32Array(this.x.memory.buffer, this.x.mt_output(), count)];
  }

  diff(before: string, after: string): Hunk[] {
    return this.withText(before, (bp, bl) =>
      this.withText(after, (ap, al) => {
        const count = this.x.mt_diff(bp, bl, ap, al);
        const out = new Uint32Array(this.x.memory.buffer, this.x.mt_output(), count * 4);
        const hunks: Hunk[] = [];
        for (let i = 0; i < count; i++) hunks.push({ beforeStart: out[i * 4]!, beforeEnd: out[i * 4 + 1]!, afterStart: out[i * 4 + 2]!, afterEnd: out[i * 4 + 3]! });
        return hunks;
      }),
    );
  }
}
