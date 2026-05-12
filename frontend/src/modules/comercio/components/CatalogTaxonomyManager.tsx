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
    <section className="app-panel p-3 xl:flex xl:max-h-[calc(100vh-132px)] xl:flex-col xl:overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--kp-accent)]">Taxonomia</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Layers3 className="h-4 w-4 shrink-0 text-[var(--kp-accent)]" aria-hidden="true" />
          <h2 className="truncate text-lg font-bold text-ink">Categorias</h2>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="app-chip text-xs text-zinc-600">{categories.length} cat.</span>
          <span className="app-chip text-xs text-zinc-600">{subcategoryCount} subcat.</span>
        </div>
      </div>

      <form
        onSubmit={(event) => void handleCategorySubmit(event)}
        className="mt-3 rounded border border-black/5 bg-zinc-50 p-2.5"
      >
        <input
          value={categoryForm.name}
          onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nombre de categoria"
          className="w-full rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
        />
        <div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <input
            type="number"
            min={0}
            value={categoryForm.sort_order}
            onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
            placeholder="Orden"
            className="min-w-0 rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
          />
          <div className="flex min-w-0 gap-2">
            <Button type="submit" disabled={saving} className="min-h-[44px] flex-1 px-3 py-2 text-xs">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Guardando" : editingCategoryId ? "Actualizar" : "Crear"}
            </Button>
            {editingCategoryId ? (
              <button
                type="button"
                aria-label="Cancelar edicion de categoria"
                onClick={resetCategoryEditor}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white text-sm font-semibold text-zinc-700 shadow-sm"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {error ? <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-3 space-y-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {categories.map((category) => {
          const draft = subcategoryDrafts[category.id] ?? emptySubcategoryDraft();
          return (
            <article key={category.id} className="rounded border border-black/5 bg-white p-2.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-ink">{category.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-500">
                    <span className="rounded bg-zinc-100 px-2 py-1">Orden {category.sort_order}</span>
                    <span className="rounded bg-zinc-100 px-2 py-1">{category.subcategories.length} sub.</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    aria-label={`Editar categoria ${category.name}`}
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryForm({ name: category.name, sort_order: String(category.sort_order) });
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded bg-zinc-100 text-zinc-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar categoria ${category.name}`}
                    onClick={() => void handleDeleteCategory(category.id)}
                    disabled={saving}
                    className="inline-flex h-11 w-11 items-center justify-center rounded bg-rose-50 text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <form
                onSubmit={(event) => void handleSubcategorySubmit(event, category.id)}
                className="mt-2.5 rounded border border-black/5 bg-zinc-50 p-2"
              >
                <input
                  value={draft.name}
                  onChange={(event) => setSubcategoryDraft(category.id, { name: event.target.value })}
                  placeholder="Nueva subcategoria"
                  className="w-full rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                />
                <div className="mt-2 grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                  <input
                    type="number"
                    min={0}
                    value={draft.sort_order}
                    onChange={(event) => setSubcategoryDraft(category.id, { sort_order: event.target.value })}
                    placeholder="Ord."
                    className="min-w-0 rounded border border-black/10 bg-white px-2 py-2.5 text-sm"
                  />
                  <div className="flex min-w-0 gap-2">
                    <Button type="submit" disabled={saving} className="min-h-[44px] flex-1 px-3 py-2 text-xs">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {draft.editingId ? "Actualizar" : "Agregar"}
                    </Button>
                    {draft.editingId ? (
                      <button
                        type="button"
                        aria-label="Cancelar edicion de subcategoria"
                        onClick={() => setSubcategoryDraft(category.id, emptySubcategoryDraft())}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white text-sm font-semibold text-zinc-700 shadow-sm"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {category.subcategories.map((subcategory) => (
                  <span
                    key={subcategory.id}
                    className="inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded border border-black/5 bg-zinc-50 px-2 text-xs text-zinc-700"
                  >
                    <span className="max-w-[120px] truncate font-semibold text-ink">{subcategory.name}</span>
                    <span className="text-zinc-400">#{subcategory.sort_order}</span>
                    <button
                      type="button"
                      aria-label={`Editar subcategoria ${subcategory.name}`}
                      onClick={() =>
                        setSubcategoryDraft(category.id, {
                          editingId: subcategory.id,
                          name: subcategory.name,
                          sort_order: String(subcategory.sort_order)
                        })
                      }
                      className="inline-flex h-11 w-11 items-center justify-center rounded text-brand-600"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar subcategoria ${subcategory.name}`}
                      onClick={() => void handleDeleteSubcategory(subcategory.id, category.id)}
                      disabled={saving}
                      className="inline-flex h-11 w-11 items-center justify-center rounded text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
