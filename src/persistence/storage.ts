// Two alternating localStorage slots with monotonic revisions.
import type { GameState } from '../core/types';
import { makeEnvelope, parseEnvelope, type ParseResult } from './serializer';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SLOT_KEYS = ['btbb3.save.a', 'btbb3.save.b'] as const;

export interface LoadReport {
  state: GameState | null;
  notice: string | null;
  /** Set when a save exists but cannot be used by this build (export + new game offered). */
  blocked: { reason: string; raw: string } | null;
}

export class SaveStore {
  failing = false;
  lastError: string | null = null;
  simulateFailure = false;

  constructor(private kv: KV | null) {}

  static browser(): SaveStore {
    try {
      const ls = window.localStorage;
      const probe = '__btbb3_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return new SaveStore(ls);
    } catch {
      const s = new SaveStore(null);
      s.failing = true;
      s.lastError = 'Browser storage is unavailable.';
      return s;
    }
  }

  load(): LoadReport {
    if (!this.kv) return { state: null, notice: null, blocked: null };
    const results: { key: string; raw: string | null; res: ParseResult | null }[] = [];
    for (const key of SLOT_KEYS) {
      let raw: string | null = null;
      try { raw = this.kv.getItem(key); } catch { raw = null; }
      results.push({ key, raw, res: raw ? parseEnvelope(raw) : null });
    }
    const valid = results.filter((r) => r.res?.ok) as { key: string; raw: string; res: { ok: true; envelope: { revision: number; payload: GameState } } }[];
    const invalid = results.filter((r) => r.res && !r.res.ok);
    if (!valid.length) {
      const b = invalid.find((r) => r.res && !r.res.ok && (r.res.kind === 'content_mismatch' || r.res.kind === 'future_schema'));
      if (b && b.res && !b.res.ok) return { state: null, notice: null, blocked: { reason: b.res.reason, raw: b.raw! } };
      if (invalid.length) return { state: null, notice: 'Your save data was damaged and could not be loaded.', blocked: null };
      return { state: null, notice: null, blocked: null };
    }
    valid.sort((a, b) => b.res.envelope.revision - a.res.envelope.revision);
    const best = valid[0];
    // Was there a newer but invalid save? Tell the player we fell back.
    const newerInvalid = invalid.some((r) => {
      try {
        const rev = JSON.parse(r.raw!).revision;
        return typeof rev === 'number' && rev > best.res.envelope.revision;
      } catch {
        return true;
      }
    });
    return {
      state: best.res.envelope.payload,
      notice: newerInvalid ? 'The newest save was damaged, so the previous save was restored.' : null,
      blocked: null,
    };
  }

  /** Writes to the slot opposite the newest, so one good copy always survives. */
  save(s: GameState): boolean {
    if (!this.kv) { this.failing = true; return false; }
    try {
      if (this.simulateFailure) throw new DOMException('Simulated quota exceeded', 'QuotaExceededError');
      const text = JSON.stringify(makeEnvelope(s));
      const key = SLOT_KEYS[s.revision % 2];
      this.kv.setItem(key, text);
      this.failing = false;
      this.lastError = null;
      return true;
    } catch (e) {
      this.failing = true;
      this.lastError = (e as Error).message || 'Storage write failed.';
      return false;
    }
  }

  clear() {
    if (!this.kv) return;
    for (const k of SLOT_KEYS) {
      try { this.kv.removeItem(k); } catch { /* ignore */ }
    }
  }

  hasSave(): boolean {
    return !!this.load().state;
  }
}

export function exportText(s: GameState): string {
  return JSON.stringify(makeEnvelope(s), null, 1);
}
