import { create } from "zustand";
import { readJsonStorage, removeStorageValue, writeJsonStorage } from "../utils/storage";

export type ApplicationDraftKind = "merchant" | "delivery";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type ApplicationDraftRecord = {
  redirectTo: string;
  pendingSubmit: boolean;
  draft: unknown;
};

type Toast = {
  id: string;
  title: string;
};

type UiState = {
  cartDrawerOpen: boolean;
  toasts: Toast[];
  installPromptEvent: BeforeInstallPromptEvent | null;
  applicationDrafts: Partial<Record<ApplicationDraftKind, ApplicationDraftRecord>>;
  setCartDrawerOpen: (open: boolean) => void;
  setInstallPromptEvent: (event: BeforeInstallPromptEvent | null) => void;
  saveApplicationDraft: (kind: ApplicationDraftKind, draft: unknown, redirectTo: string, pendingSubmit?: boolean) => void;
  getApplicationDraft: (kind: ApplicationDraftKind) => ApplicationDraftRecord | null;
  clearApplicationDraft: (kind: ApplicationDraftKind) => void;
  enqueueToast: (title: string) => void;
  dismissToast: (id: string) => void;
  resetForTest: () => void;
};

const DRAFT_STORAGE_PREFIX = "kepedimos.application-draft.";

function readDraft(kind: ApplicationDraftKind): ApplicationDraftRecord | null {
  if (typeof window === "undefined") return null;
  return readJsonStorage<ApplicationDraftRecord>(window.sessionStorage, `${DRAFT_STORAGE_PREFIX}${kind}`);
}

function persistDraft(kind: ApplicationDraftKind, value: ApplicationDraftRecord | null) {
  if (typeof window === "undefined") return;
  const key = `${DRAFT_STORAGE_PREFIX}${kind}`;
  if (!value) {
    removeStorageValue(window.sessionStorage, key);
    return;
  }
  writeJsonStorage(window.sessionStorage, key, value);
}

export const useUiStore = create<UiState>((set, get) => ({
  cartDrawerOpen: false,
  toasts: [],
  installPromptEvent: null,
  applicationDrafts: {
    merchant: readDraft("merchant") ?? undefined,
    delivery: readDraft("delivery") ?? undefined
  },
  setCartDrawerOpen(open) {
    set({ cartDrawerOpen: open });
  },
  setInstallPromptEvent(event) {
    set({ installPromptEvent: event });
  },
  saveApplicationDraft(kind, draft, redirectTo, pendingSubmit = true) {
    const nextValue: ApplicationDraftRecord = { draft, redirectTo, pendingSubmit };
    persistDraft(kind, nextValue);
    set((state) => ({
      applicationDrafts: {
        ...state.applicationDrafts,
        [kind]: nextValue
      }
    }));
  },
  getApplicationDraft(kind) {
    return get().applicationDrafts[kind] ?? readDraft(kind);
  },
  clearApplicationDraft(kind) {
    persistDraft(kind, null);
    set((state) => ({
      applicationDrafts: {
        ...state.applicationDrafts,
        [kind]: undefined
      }
    }));
  },
  enqueueToast(title) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, title }]
    }));
  },
  dismissToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
  resetForTest() {
    persistDraft("merchant", null);
    persistDraft("delivery", null);
    set({
      cartDrawerOpen: false,
      toasts: [],
      installPromptEvent: null,
      applicationDrafts: {}
    });
  }
}));
