import { create, StateCreator } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

/**
 * Enable devtools in development mode.
 */
const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Options for creating an OHIF store.
 */
interface CreateOHIFStoreOptions {
  /** Store name for devtools and persistence key */
  name: string;
  /** Enable localStorage persistence */
  persist?: boolean;
  /** Custom storage (default: localStorage) */
  storage?: 'localStorage' | 'sessionStorage';
  /** Specific keys to persist (default: all) */
  partialize?: (state: any) => any;
}

/**
 * Creates a standardized Zustand store with OHIF conventions.
 *
 * Features:
 * - Automatic devtools integration in development
 * - Optional localStorage/sessionStorage persistence
 * - subscribeWithSelector for fine-grained subscriptions
 * - Consistent naming and debugging experience
 *
 * @example
 * ```ts
 * const useMyStore = createOHIFStore(
 *   (set, get) => ({
 *     count: 0,
 *     increment: () => set(state => ({ count: state.count + 1 })),
 *     reset: () => set({ count: 0 }),
 *   }),
 *   { name: 'MyStore', persist: true }
 * );
 * ```
 */
function createOHIFStore<T>(
  storeCreator: StateCreator<T, [], []>,
  options: CreateOHIFStoreOptions
) {
  const { name, persist: enablePersist = false, storage = 'localStorage', partialize } = options;

  // Build middleware chain
  let middlewaredCreator: any = storeCreator;

  // Add subscribeWithSelector for fine-grained subscriptions
  middlewaredCreator = subscribeWithSelector(middlewaredCreator);

  // Add devtools in development
  if (IS_DEV) {
    middlewaredCreator = devtools(middlewaredCreator, {
      name: `OHIF:${name}`,
      enabled: true,
    });
  }

  // Add persistence if requested
  if (enablePersist) {
    const storageApi =
      storage === 'sessionStorage' ? sessionStorage : localStorage;

    middlewaredCreator = persist(middlewaredCreator, {
      name: `ohif-store-${name}`,
      storage: {
        getItem: (key: string) => {
          const value = storageApi.getItem(key);
          return value ? JSON.parse(value) : null;
        },
        setItem: (key: string, value: any) => {
          storageApi.setItem(key, JSON.stringify(value));
        },
        removeItem: (key: string) => {
          storageApi.removeItem(key);
        },
      },
      partialize: partialize || (state => state),
    });
  }

  return create<T>()(middlewaredCreator);
}

/**
 * Undo/Redo middleware for Zustand stores.
 *
 * Wraps a store to track state history and provide undo/redo operations.
 * Useful for measurement and annotation editing workflows.
 */
interface UndoRedoState<T> {
  /** The current state */
  current: T;
  /** Past states for undo */
  past: T[];
  /** Future states for redo */
  future: T[];
  /** Record current state and push to history */
  checkpoint: () => void;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Check if undo is available */
  canUndo: boolean;
  /** Check if redo is available */
  canRedo: boolean;
  /** Clear all history */
  clearHistory: () => void;
}

function createUndoRedoStore<T>(
  initialState: T,
  options: CreateOHIFStoreOptions & { maxHistory?: number }
) {
  const maxHistory = options.maxHistory || 50;

  return createOHIFStore<UndoRedoState<T>>(
    (set, get) => ({
      current: initialState,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      checkpoint: () => {
        const { current, past } = get();
        const newPast = [...past, current].slice(-maxHistory);
        set({
          past: newPast,
          future: [],
          canUndo: true,
          canRedo: false,
        });
      },

      undo: () => {
        const { current, past, future } = get();
        if (past.length === 0) {
          return;
        }

        const previous = past[past.length - 1];
        const newPast = past.slice(0, -1);

        set({
          current: previous,
          past: newPast,
          future: [current, ...future],
          canUndo: newPast.length > 0,
          canRedo: true,
        });
      },

      redo: () => {
        const { current, past, future } = get();
        if (future.length === 0) {
          return;
        }

        const next = future[0];
        const newFuture = future.slice(1);

        set({
          current: next,
          past: [...past, current],
          future: newFuture,
          canUndo: true,
          canRedo: newFuture.length > 0,
        });
      },

      clearHistory: () => {
        set({ past: [], future: [], canUndo: false, canRedo: false });
      },
    }),
    options
  );
}

export { createOHIFStore, createUndoRedoStore };
export type { CreateOHIFStoreOptions, UndoRedoState };
