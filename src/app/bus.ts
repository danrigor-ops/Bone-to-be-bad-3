// Tiny UI bus between Phaser scenes and DOM. Never carries game state mutations.
type Handler = (payload?: unknown) => void;
const handlers = new Map<string, Handler[]>();

export const bus = {
  on(name: string, h: Handler) {
    handlers.set(name, [...(handlers.get(name) ?? []), h]);
  },
  emit(name: string, payload?: unknown) {
    for (const h of handlers.get(name) ?? []) h(payload);
  },
};

/** Shared, non-persisted view state. */
export const view = {
  panelOpen: false,
  focusObject: null as string | null,
  battleAnimating: false,
  targeting: false,
  hidden: false,
};
