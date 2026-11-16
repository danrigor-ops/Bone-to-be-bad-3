import type { Store } from '../app/store';
import type { Command, ReduceResult } from '../core/types';

export interface Prefs { dpad: boolean; hintSeen: boolean }

export interface UIContext {
  store: Store;
  dispatch(cmd: Command): ReduceResult | null;
  toast(text: string, kind?: 'reward' | 'info'): void;
  setPanelOpen(open: boolean): void;
  showTitle(): void;
  exportSave(): void;
  copySave(): void;
  refreshAll(): void;
  prefs: Prefs;
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void;
}
