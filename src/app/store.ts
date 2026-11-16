// Single state owner. Scenes and DOM emit commands; only the reducer changes state.
import { reduce } from '../core/reducer';
import type { Command, GameEvent, GameState, ReduceResult } from '../core/types';
import { SaveStore } from '../persistence/storage';

type Listener = (s: GameState, prev: GameState | null) => void;
type EventListener = (e: GameEvent) => void;

export class Store {
  state: GameState | null = null;
  private listeners: Listener[] = [];
  private eventListeners: EventListener[] = [];
  private committing = false;
  saveOk = true;

  constructor(public saves: SaveStore) {}

  subscribe(l: Listener) {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  }
  onEvent(l: EventListener) {
    this.eventListeners.push(l);
  }

  /** Replace the whole state (new game, load, import). */
  load(s: GameState) {
    const prev = this.state;
    this.state = s;
    this.persist();
    for (const l of this.listeners) l(s, prev);
  }

  dispatch(cmd: Command): ReduceResult | null {
    if (!this.state || this.committing) return null;
    this.committing = true;
    try {
      const prev = this.state;
      const r = reduce(prev, cmd);
      if (!r.error) {
        this.state = r.state;
        this.persist();
      }
      for (const e of r.events) for (const l of this.eventListeners) l(e);
      if (!r.error) for (const l of this.listeners) l(r.state, prev);
      return r;
    } finally {
      this.committing = false;
    }
  }

  persist() {
    if (!this.state) return;
    this.saveOk = this.saves.save(this.state);
  }

  emit(e: GameEvent) {
    for (const l of this.eventListeners) l(e);
  }
}
