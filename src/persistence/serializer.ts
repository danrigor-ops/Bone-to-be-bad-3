import type { GameState } from '../core/types';
import { SCHEMA_VERSION } from '../core/state';
import { CONTENT } from '../core/content';
import { checkInvariants } from '../core/invariants';

export interface Envelope {
  schemaVersion: number;
  contentVersion: string;
  revision: number;
  checksum: string;
  payload: GameState;
}

/** Deterministic JSON: object keys sorted recursively. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

/** FNV-1a 32-bit. Corruption detection only, not security. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function makeEnvelope(s: GameState): Envelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT.raw.contentVersion,
    revision: s.revision,
    checksum: checksum(stableStringify(s)),
    payload: s,
  };
}

export type ParseResult =
  | { ok: true; envelope: Envelope }
  | { ok: false; reason: string; kind: 'corrupt' | 'future_schema' | 'content_mismatch' | 'invalid' };

const REQUIRED_KEYS: (keyof GameState)[] = [
  'schemaVersion', 'contentVersion', 'revision', 'location', 'party', 'inventory', 'questState', 'flags',
  'claimedRewards', 'salvageRunIndex', 'settings', 'rngState',
];

export function parseEnvelope(text: string): ParseResult {
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Save data is not valid JSON.', kind: 'corrupt' };
  }
  if (!env || typeof env !== 'object' || typeof env.schemaVersion !== 'number' || !env.payload) {
    return { ok: false, reason: 'Not a Bone to Be Bad III save.', kind: 'invalid' };
  }
  if (env.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: `Save uses a newer format (v${env.schemaVersion}) than this build supports (v${SCHEMA_VERSION}).`, kind: 'future_schema' };
  }
  if (env.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'Unsupported save format.', kind: 'invalid' };
  if (checksum(stableStringify(env.payload)) !== env.checksum) {
    return { ok: false, reason: 'Save checksum mismatch (data corrupted).', kind: 'corrupt' };
  }
  for (const k of REQUIRED_KEYS) if (!(k in env.payload)) return { ok: false, reason: `Save is missing ${k}.`, kind: 'invalid' };
  if (env.contentVersion !== CONTENT.raw.contentVersion || env.payload.contentVersion !== CONTENT.raw.contentVersion) {
    return { ok: false, reason: `Save was made for content ${env.contentVersion}; this build has ${CONTENT.raw.contentVersion}.`, kind: 'content_mismatch' };
  }
  try {
    const problems = checkInvariants(env.payload);
    if (problems.length) return { ok: false, reason: `Save failed validation: ${problems[0]}`, kind: 'invalid' };
  } catch (e) {
    return { ok: false, reason: `Save failed validation: ${(e as Error).message}`, kind: 'invalid' };
  }
  return { ok: true, envelope: env };
}

export const MAX_IMPORT_BYTES = 512 * 1024;
