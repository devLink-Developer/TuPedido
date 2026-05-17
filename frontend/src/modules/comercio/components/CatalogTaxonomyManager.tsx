import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Layers3, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
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
  const [expanded, setExpanded] = useState(categories.length === 0);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<number, SubcategoryDraftState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcategoryCount = categories.reduce((total, category) => total + category.subcategories.length, 0);
  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [categories, activeCategoryId]
  );
  const visibleCategoryLabels = categories.slice(0, 4);
  const hiddenCategoryCount = Math.max(categories.length - visibleCategoryLabels.length, 0);

  useEffect(() => {
    if (!categories.length) {
      setExpanded(true);
      setActiveCategoryId(null);
      return;
    }

    setActiveCategoryId((current) =>
      current && categories.some((category) => category.id === current) ? current : categories[0].id
    );
  }, [categories]);

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

  function startCategoryEdit(category: ProductCategory) {
    setExpanded(true);
    setActiveCategoryId(category.id);
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, sort_order: String(category.sort_order) });
  }

  return (
    <section className="app-panel overflow-hidden p-0">
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--kp-stroke)] bg-white text-[var(--kp-accent)]">
            <Layers3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--kp-accent)]">Taxonomia</p>
              <span className="app-chip text-xs text-zinc-600">{categories.length} cat.</span>
              <span className="app-chip text-xs text-zinc-600">{subcategoryCount} subcat.</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-ink">Estructura del catalogo</h2>
            {categories.length ? (
              <div className="mt-2 flex max-w-full flex-wrap gap-1.5">
                {visibleCategoryLabels.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setExpanded(true);
                      setActiveCategoryId(category.id);
                    }}
                    className="inline-flex min-h-[32px] max-w-[140px] items-center rounded border border-black/5 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span className="truncate">{category.name}</span>
                  </button>
                ))}
                {hiddenCategoryCount ? (
                  <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-500">
                    +{hiddenCategoryCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded border border-[var(--kp-stroke)] bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-ink"
        >
          {expanded ? "Ocultar gestion" : "Gestionar"}
          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-[var(--color-border-default)] p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
            <div className="space-y-3">
              <form onSubmit={(event) => void handleCategorySubmit(event)} className="merchant-compact-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {editingCategoryId ? "Editar categoria" : "Nueva categoria"}
                  </p>
                  {editingCategoryId ? (
                    <button
                      type="button"
                      aria-label="Cancelar edicion de categoria"
                      onClick={resetCategoryEditor}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white text-zinc-700"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_84px] gap-2">
                  <input
                    aria-label="Nombre de categoria"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Categoria"
                    className="min-w-0 rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    aria-label="Orden de categoria"
                    type="number"
                    min={0}
                    value={categoryForm.sort_order}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
                    placeholder="Orden"
                    className="min-w-0 rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <Button type="submit" disabled={saving} className="mt-2 min-h-[44px] w-full px-3 py-2 text-xs">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {saving ? "Guardando" : editingCategoryId ? "Actualizar" : "Crear categoria"}
                </Button>
              </form>

              {error ? <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              <div className="space-y-2">
                {categories.map((category) => {
                  const selected = category.id === activeCategoryId;

                  return (
                    <article
                      key={category.id}
                      className={`merchant-compact-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 p-1.5 ${
                        selected ? "border-brand-500/40 bg-orange-50/70" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveCategoryId(category.id)}
                        className="flex min-h-[48px] min-w-0 items-center gap-2 rounded px-2 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-zinc-400 transition ${selected ? "rotate-90 text-brand-600" : ""}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-ink">{category.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">
                            {category.subcategories.length} sub. / Orden {category.sort_order}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Editar categoria ${category.name}`}
                          onClick={() => startCategoryEdit(category)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded bg-white text-zinc-700"
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
            </div>

            <div className="merchant-compact-panel min-h-[220px] p-3">
              {activeCategory ? (
                <div className="flex h-full flex-col gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Categoria activa</p>
                      <h3 className="mt-1 truncate text-lg font-bold text-ink">{activeCategory.name}</h3>
                    </div>
                    <span className="app-chip w-fit text-xs text-zinc-600">
                      {activeCategory.subcategories.length} subcategorias
                    </span>
                  </div>

                  <form
                    onSubmit={(event) => void handleSubcategorySubmit(event, activeCategory.id)}
                    className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_84px_auto]"
                  >
                    <input
                      aria-label="Nombre de subcategoria"
                      value={(subcategoryDrafts[activeCategory.id] ?? emptySubcategoryDraft()).name}
                      onChange={(event) => setSubcategoryDraft(activeCategory.id, { name: event.target.value })}
                      placeholder="Subcategoria"
                      className="min-w-0 rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                    />
                    <input
                      aria-label="Orden de subcategoria"
                      type="number"
                      min={0}
                      value={(subcategoryDrafts[activeCategory.id] ?? emptySubcategoryDraft()).sort_order}
                      onChange={(event) => setSubcategoryDraft(activeCategory.id, { sort_order: event.target.value })}
                      placeholder="Orden"
                      className="min-w-0 rounded border border-black/10 bg-white px-3 py-2.5 text-sm"
                    />
                    <div className="flex min-w-0 gap-2">
                      <Button type="submit" disabled={saving} className="min-h-[44px] flex-1 px-3 py-2 text-xs">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {(subcategoryDrafts[activeCategory.id] ?? emptySubcategoryDraft()).editingId ? "Actualizar" : "Agregar"}
                      </Button>
                      {(subcategoryDrafts[activeCategory.id] ?? emptySubcategoryDraft()).editingId ? (
                        <button
                          type="button"
                          aria-label="Cancelar edicion de subcategoria"
                          onClick={() => setSubcategoryDraft(activeCategory.id, emptySubcategoryDraft())}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white text-zinc-700"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </form>

                  <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {activeCategory.subcategories.map((subcategory) => (
                      <div
                        key={subcategory.id}
                        className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-black/5 bg-white px-2 py-1"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{subcategory.name}</p>
                          <p className="text-xs text-zinc-400">Orden {subcategory.sort_order}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Editar subcategoria ${subcategory.name}`}
                            onClick={() =>
                              setSubcategoryDraft(activeCategory.id, {
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
                            onClick={() => void handleDeleteSubcategory(subcategory.id, activeCategory.id)}
                            disabled={saving}
                            className="inline-flex h-11 w-11 items-center justify-center rounded text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!activeCategory.subcategories.length ? (
                    <p className="rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-500">Sin subcategorias cargadas.</p>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="Elige una categoria"
                  description="Crea o selecciona una categoria para gestionar sus subcategorias."
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
