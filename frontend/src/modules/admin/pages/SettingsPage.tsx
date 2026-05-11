import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { useCategoryStore } from "../../../shared/stores";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory
} from "../../../shared/services/api";
import type { Category, CategoryWrite } from "../../../shared/types";
import { hexToRgba, isHexColor, normalizeHexColor, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import { Button } from "../../../shared/ui/Button";

type CategoryFormState = {
  name: string;
  description: string;
  color: string;
  color_light: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

const emptyCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  color: "#FF7043",
  color_light: "",
  icon: "",
  sort_order: "0",
  is_active: true
};

const suggestedColors = ["#FF7043", "#29B6F6", "#66BB6A", "#AB47BC", "#EF5350", "#FFCA28", "#8D6E63", "#26A69A"];

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCategoryForm(category: Category): CategoryFormState {
  return {
    name: category.name,
    description: category.description ?? "",
    color: category.color,
    color_light: category.color_light,
    icon: category.icon ?? "",
    sort_order: String(category.sort_order),
    is_active: category.is_active
  };
}

function toCategoryPayload(form: CategoryFormState): CategoryWrite {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color.trim().toUpperCase(),
    color_light: form.color_light.trim() ? form.color_light.trim().toUpperCase() : null,
    icon: form.icon.trim() || null,
    is_active: form.is_active,
    sort_order: toNumber(form.sort_order)
  };
}

function previewLabel(name: string, icon: string) {
  const trimmed = icon.trim();
  if (trimmed) return trimmed.slice(0, 2).toUpperCase();
  return (name.trim().slice(0, 2) || "RB").toUpperCase();
}

export function SettingsPage() {
  const { token } = useAuthSession();
  const syncPublicCategories = useCategoryStore((state) => state.setCategories);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [categorySaving, setCategorySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const categoryPreview = useMemo(
    () => resolveCategoryPalette({ color: categoryForm.color, color_light: categoryForm.color_light || null }),
    [categoryForm.color, categoryForm.color_light]
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const categoriesResult = await fetchAdminCategories(token);
      setCategories(categoriesResult);
      syncPublicCategories(categoriesResult.filter((category) => category.is_active));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar rubros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function resetCategoryEditor() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryError(null);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryForm.name.trim()) {
      setCategoryError("El nombre del rubro es obligatorio.");
      return;
    }
    if (!isHexColor(categoryForm.color)) {
      setCategoryError("El color principal debe usar formato HEX #RRGGBB.");
      return;
    }
    if (categoryForm.color_light.trim() && !isHexColor(categoryForm.color_light)) {
      setCategoryError("El color claro debe usar formato HEX #RRGGBB.");
      return;
    }

    setCategorySaving(true);
    setCategoryError(null);
    try {
      const payload = toCategoryPayload(categoryForm);
      if (editingCategoryId) {
        await updateAdminCategory(token, editingCategoryId, payload);
      } else {
        await createAdminCategory(token, payload);
      }
      resetCategoryEditor();
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo guardar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryDeactivate(categoryId: number) {
    if (!token) return;
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await deleteAdminCategory(token, categoryId);
      if (editingCategoryId === categoryId) {
        resetCategoryEditor();
      }
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo desactivar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryReactivate(category: Category) {
    if (!token) return;
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await updateAdminCategory(token, category.id, {
        name: category.name,
        description: category.description,
        color: category.color,
        color_light: category.color_light,
        icon: category.icon,
        is_active: true,
        sort_order: category.sort_order
      });
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo reactivar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) {
    return <EmptyState title="Rubros no disponibles" description={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Rubros"
        description="Administra categorias comerciales: nombre, color, icono, orden y estado visible en catalogo, filtros y comercios."
      />

      <section className="rounded bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Rubros comerciales</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              Estos cambios impactan en home, filtros y badges de comercios sin tocar codigo.
            </p>
          </div>
          <span className="rounded bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            {categories.filter((category) => category.is_active).length} activos / {categories.length} totales
          </span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={(event) => void handleCategorySubmit(event)}
            className="space-y-4 rounded border border-black/5 bg-zinc-50 p-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {editingCategoryId ? "Editar rubro" : "Nuevo rubro"}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink">
                {editingCategoryId ? "Actualiza el rubro seleccionado" : "Crea un rubro configurable"}
              </h3>
            </div>

            <div className="grid gap-3">
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Farmacia"
                className="rounded border border-black/10 bg-white px-4 py-3"
                required
              />
              <textarea
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe el tipo de comercios que representa este rubro."
                rows={3}
                className="rounded border border-black/10 bg-white px-4 py-3"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[100px_1fr]">
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Color
                <input
                  type="color"
                  value={normalizeHexColor(categoryForm.color)}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  className="h-12 w-full cursor-pointer rounded border border-black/10 bg-white p-1"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                HEX principal
                <input
                  value={categoryForm.color}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  placeholder="#FF7043"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                  required
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCategoryForm((current) => ({ ...current, color }))}
                  className="h-10 w-10 rounded border-2 transition"
                  style={{
                    backgroundColor: color,
                    borderColor: categoryForm.color === color ? "#2B2B2B" : "rgba(43, 43, 43, 0.08)"
                  }}
                  aria-label={`Usar color ${color}`}
                />
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Color claro opcional
                <input
                  value={categoryForm.color_light}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color_light: event.target.value.toUpperCase() }))}
                  placeholder="#FBE9E7"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Icono corto
                <input
                  value={categoryForm.icon}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))}
                  placeholder="FX"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Orden
                <input
                  type="number"
                  min={0}
                  value={categoryForm.sort_order}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="flex items-center gap-3 rounded border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
                Rubro activo
              </label>
            </div>

            <div
              className="rounded border p-4"
              style={{
                backgroundColor: categoryPreview.colorLight,
                borderColor: hexToRgba(categoryPreview.color, 0.16)
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: categoryPreview.color }}>
                Preview
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded text-sm font-black"
                  style={{ backgroundColor: hexToRgba(categoryPreview.color, 0.14), color: categoryPreview.color }}
                >
                  {previewLabel(categoryForm.name, categoryForm.icon)}
                </span>
                <div>
                  <p className="font-bold" style={{ color: categoryPreview.color }}>
                    {categoryForm.name.trim() || "Nuevo rubro"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {categoryForm.description.trim() || "Se vera en badges, filtros y secciones destacadas."}
                  </p>
                </div>
              </div>
            </div>

            {categoryError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{categoryError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? "Guardando..." : editingCategoryId ? "Actualizar rubro" : "Crear rubro"}
              </Button>
              {editingCategoryId ? (
                <button
                  type="button"
                  onClick={resetCategoryEditor}
                  className="rounded bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {categories.map((category) => {
              const palette = resolveCategoryPalette(category);
              return (
                <article
                  key={category.id}
                  className="rounded border p-4 shadow-sm"
                  style={{
                    background: `linear-gradient(180deg, ${palette.colorLight}, #FFFFFF)`,
                    borderColor: hexToRgba(palette.color, 0.14)
                  }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded text-xs font-black"
                          style={{ backgroundColor: hexToRgba(palette.color, 0.14), color: palette.color }}
                        >
                          {previewLabel(category.name, category.icon ?? "")}
                        </span>
                        <div>
                          <p className="font-bold" style={{ color: palette.color }}>
                            {category.name}
                          </p>
                          <p className="text-sm text-zinc-500">{category.description || "Sin descripcion comercial."}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">{category.color}</span>
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">Orden {category.sort_order}</span>
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">
                          {category.is_active ? "Activo" : "Inactivo"}
                        </span>
                        {category.icon ? (
                          <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">Icono {category.icon}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setCategoryForm(toCategoryForm(category));
                          setCategoryError(null);
                        }}
                        className="rounded bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                      >
                        Editar
                      </button>
                      {category.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleCategoryDeactivate(category.id)}
                          className="rounded bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCategoryReactivate(category)}
                          className="rounded bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!categories.length ? (
              <EmptyState
                title="Sin rubros configurados"
                description="Crea tu primer rubro para activar identidad visual dinamica en home, filtros y badges."
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
