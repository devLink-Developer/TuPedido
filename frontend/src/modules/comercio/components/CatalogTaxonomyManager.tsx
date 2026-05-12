import { useState, type FormEvent } from "react";
import { Layers3, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { EmptyState } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantProductCategory,
  createMerchantProductSubcategory,
  deleteMerchantProductCategory,
  deleteMerchantProductSubcategory,
  updateMerchantProductCategory,
  updateMerchantProductSubcategory
} from "../../../shared/services/api";
import type { ProductCategory } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

type CategoryFormState = {
  name: string;
  sort_order: string;
};

type SubcategoryDraftState = {
  name: string;
  sort_order: string;
  editingId: number | null;
};

const emptyCategoryForm: CategoryFormState = {
  name: "",
  sort_order: "0"
};

function emptySubcategoryDraft(): SubcategoryDraftState {
  return {
    name: "",
    sort_order: "0",
    editingId: null
  };
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function CatalogTaxonomyManager({
  categories,
  onRefresh
}: {
  categories: ProductCategory[];
  onRefresh: () => Promise<void>;
}) {
  const { token } = useAuthSession();
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<number, SubcategoryDraftState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcategoryCount = categories.reduce((total, category) => total + category.subcategories.length, 0);

  function resetCategoryEditor() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
  }

  function setSubcategoryDraft(categoryId: number, next: Partial<SubcategoryDraftState>) {
    setSubcategoryDrafts((current) => ({
      ...current,
      [categoryId]: { ...(current[categoryId] ?? emptySubcategoryDraft()), ...next }
    }));
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryForm.name.trim()) {
      setError("Ingresa un nombre para la categoria.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        sort_order: toNumber(categoryForm.sort_order)
      };
      if (editingCategoryId) {
        await updateMerchantProductCategory(token, editingCategoryId, payload);
      } else {
        await createMerchantProductCategory(token, payload);
      }
      resetCategoryEditor();
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la categoria");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMerchantProductCategory(token, categoryId);
      if (editingCategoryId === categoryId) {
        resetCategoryEditor();
      }
      setSubcategoryDrafts((current) => {
        const next = { ...current };
        delete next[categoryId];
        return next;
      });
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la categoria");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubcategorySubmit(event: FormEvent<HTMLFormElement>, categoryId: number) {
    event.preventDefault();
    if (!token) return;
    const draft = subcategoryDrafts[categoryId] ?? emptySubcategoryDraft();
    if (!draft.name.trim()) {
      setError("Ingresa un nombre para la subcategoria.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        product_category_id: categoryId,
        name: draft.name.trim(),
        sort_order: toNumber(draft.sort_order)
      };
      if (draft.editingId) {
        await updateMerchantProductSubcategory(token, draft.editingId, payload);
      } else {
        await createMerchantProductSubcategory(token, payload);
      }
      setSubcategoryDraft(categoryId, emptySubcategoryDraft());
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la subcategoria");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSubcategory(subcategoryId: number, categoryId: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMerchantProductSubcategory(token, subcategoryId);
      const draft = subcategoryDrafts[categoryId];
      if (draft?.editingId === subcategoryId) {
        setSubcategoryDraft(categoryId, emptySubcategoryDraft());
      }
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la subcategoria");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-panel p-3">
      <div className="flex flex-col gap-2 border-b border-[var(--color-border-default)] pb-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--kp-accent)]">Taxonomia</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-[var(--kp-accent)]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-ink">Categorias y subcategorias</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="app-chip text-xs text-zinc-600">{categories.length} categorias</span>
          <span className="app-chip text-xs text-zinc-600">{subcategoryCount} subcategorias</span>
        </div>
      </div>

      <form
        onSubmit={(event) => void handleCategorySubmit(event)}
        className="mt-3 grid gap-2 rounded border border-black/5 bg-zinc-50 p-2.5 lg:grid-cols-[minmax(0,1fr)_72px_auto]"
      >
        <input
          value={categoryForm.name}
          onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nombre de categoria"
          className="rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
        />
        <input
          type="number"
          min={0}
          value={categoryForm.sort_order}
          onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
          placeholder="Orden"
          className="rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
        />
        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <Button type="submit" disabled={saving} className="min-h-[44px] px-3 py-2 text-xs">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {saving ? "Guardando" : editingCategoryId ? "Actualizar" : "Crear"}
          </Button>
          {editingCategoryId ? (
            <button
              type="button"
              aria-label="Cancelar edicion de categoria"
              onClick={resetCategoryEditor}
              className="inline-flex min-h-[44px] items-center justify-center rounded bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-3 space-y-3">
        {categories.map((category) => {
          const draft = subcategoryDrafts[category.id] ?? emptySubcategoryDraft();
          return (
            <article key={category.id} className="rounded border border-black/5 bg-white p-2.5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-ink">{category.name}</h3>
                    <span className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                      Orden {category.sort_order}
                    </span>
                    <span className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                      {category.subcategories.length} sub.
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryForm({ name: category.name, sort_order: String(category.sort_order) });
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-zinc-100 px-3 text-xs font-semibold text-zinc-700"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCategory(category.id)}
                    disabled={saving}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Eliminar
                  </button>
                </div>
              </div>

              <form
                onSubmit={(event) => void handleSubcategorySubmit(event, category.id)}
                className="mt-2.5 grid gap-2 rounded border border-black/5 bg-zinc-50 p-2.5 lg:grid-cols-[minmax(0,1fr)_72px_auto]"
              >
                <input
                  value={draft.name}
                  onChange={(event) => setSubcategoryDraft(category.id, { name: event.target.value })}
                  placeholder="Nueva subcategoria"
                  className="rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={draft.sort_order}
                  onChange={(event) => setSubcategoryDraft(category.id, { sort_order: event.target.value })}
                  placeholder="Orden"
                  className="rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                />
                <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                  <Button type="submit" disabled={saving} className="min-h-[44px] px-3 py-2 text-xs">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {draft.editingId ? "Actualizar" : "Agregar"}
                  </Button>
                  {draft.editingId ? (
                    <button
                      type="button"
                      aria-label="Cancelar edicion de subcategoria"
                      onClick={() => setSubcategoryDraft(category.id, emptySubcategoryDraft())}
                      className="inline-flex min-h-[44px] items-center justify-center rounded bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {category.subcategories.map((subcategory) => (
                  <span
                    key={subcategory.id}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-black/5 bg-zinc-50 px-2.5 text-sm text-zinc-700"
                  >
                    <span className="font-semibold text-ink">{subcategory.name}</span>
                    <span className="text-xs text-zinc-400">#{subcategory.sort_order}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubcategoryDraft(category.id, {
                          editingId: subcategory.id,
                          name: subcategory.name,
                          sort_order: String(subcategory.sort_order)
                        })
                      }
                      className="inline-flex min-h-[32px] items-center text-xs font-semibold text-brand-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSubcategory(subcategory.id, category.id)}
                      disabled={saving}
                      className="inline-flex min-h-[32px] items-center text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </span>
                ))}
                {!category.subcategories.length ? (
                  <p className="text-sm text-zinc-500">Sin subcategorias cargadas.</p>
                ) : null}
              </div>
            </article>
          );
        })}

        {!categories.length ? (
          <EmptyState
            title="Sin categorias de producto"
            description="Crea la primera categoria para habilitar el alta de productos."
          />
        ) : null}
      </div>
    </section>
  );
}
