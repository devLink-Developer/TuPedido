import { create } from "zustand";
import { fetchCategories } from "../services/api";
import type { Category } from "../types";

type CategoryState = {
  categories: Category[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  loadCategories: (force?: boolean) => Promise<Category[]>;
  setCategories: (categories: Category[]) => void;
  resetForTest: () => void;
};

let inflightRequest: Promise<Category[]> | null = null;

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,
  loaded: false,
  error: null,
  async loadCategories(force = false) {
    if (!force && get().loaded) {
      return get().categories;
    }
    if (!force && inflightRequest) {
      return inflightRequest;
    }

    set({ loading: true, error: null });
    inflightRequest = fetchCategories()
      .then((categories) => {
        set({ categories, loading: false, loaded: true, error: null });
        return categories;
      })
      .catch((error) => {
        set({
          loading: false,
          loaded: false,
          error: error instanceof Error ? error.message : "No se pudieron cargar los rubros"
        });
        throw error;
      })
      .finally(() => {
        inflightRequest = null;
      });

    return inflightRequest;
  },
  setCategories(categories) {
    set({
      categories,
      loading: false,
      loaded: true,
      error: null
    });
  },
  resetForTest() {
    inflightRequest = null;
    set({
      categories: [],
      loading: false,
      loaded: false,
      error: null
    });
  }
}));
