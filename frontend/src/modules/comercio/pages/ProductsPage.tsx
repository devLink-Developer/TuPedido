import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { EmptyState, LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantProduct,
  deleteMerchantProduct,
  fetchMerchantProductCategories,
  fetchMerchantProducts,
  updateMerchantProduct
} from "../../../shared/services/api";
import type { Product, ProductCategory, ProductWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { formatCurrency } from "../../../shared/utils/format";
import { CatalogTaxonomyManager } from "../components/CatalogTaxonomyManager";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { ProductForm } from "../components/ProductForm";
import { ProductList } from "../components/ProductList";

export function ProductsPage() {
  const { token } = useAuthSession();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProducts = useMemo(() => products.filter((product) => product.is_available).length, [products]);
  const noStockProducts = useMemo(
    () => products.filter((product) => product.stock_quantity !== null && product.stock_quantity <= 0).length,
    [products]
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId]
  );

  async function load(options?: { silent?: boolean }) {
    if (!token) return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [categoryResult, productResult] = await Promise.all([
        fetchMerchantProductCategories(token),
        fetchMerchantProducts(token)
      ]);
      setCategories(categoryResult);
      setProducts(productResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los productos");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    if (!products.length) {
      if (selectedProductId !== null) {
        setSelectedProductId(null);
      }
      return;
    }

    if (selectedProductId === null || !products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  function openCreateForm() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEditForm(product: Product) {
    setSelectedProductId(product.id);
    setEditingProduct(product);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingProduct(null);
    setFormOpen(false);
  }

  async function handleSubmit(payload: ProductWrite) {
    if (!token) return;
    setSaving(true);
    try {
      if (editingProduct) {
        await updateMerchantProduct(token, editingProduct.id, payload);
        setSelectedProductId(editingProduct.id);
      } else {
        await createMerchantProduct(token, payload);
      }
      closeForm();
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: number) {
    if (!token) return;
    if (selectedProductId === productId) {
      setSelectedProductId(null);
    }
    if (editingProduct?.id === productId) {
      closeForm();
    }
    await deleteMerchantProduct(token, productId);
    await load({ silent: true });
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Productos no disponibles" description={error} />;

  const inspectorTitle = formOpen
    ? editingProduct
      ? "Editar producto"
      : "Nuevo producto"
    : selectedProduct
      ? "Detalle producto"
      : "Alta rapida";

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Comercial"
        title="Catalogo"
        description="Productos, categorias y subcategorias en un workspace operativo."
        stats={[
          { label: "Productos", value: products.length },
          { label: "Activos", value: availableProducts, tone: availableProducts ? "success" : "neutral" },
          { label: "Categorias", value: categories.length },
          { label: "Sin stock", value: noStockProducts, tone: noStockProducts ? "warning" : "neutral" }
        ]}
        action={
          <Button
            type="button"
            className="bg-brand-500 text-white"
            onClick={openCreateForm}
            disabled={!categories.length}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo producto
          </Button>
        }
      />

      {!categories.length ? (
        <section className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Primero crea al menos una categoria en Taxonomia. Despues podras cargar productos.
        </section>
      ) : null}

      <CatalogTaxonomyManager categories={categories} onRefresh={() => load({ silent: true })} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <ProductList
          products={products}
          selectedProductId={selectedProductId}
          onSelect={(product) => {
            setSelectedProductId(product.id);
            if (!formOpen) {
              setEditingProduct(null);
            }
          }}
          onEdit={openEditForm}
          onDelete={handleDelete}
        />
        <aside className="app-panel hidden p-3 xl:block xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--color-border-default)] pb-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Inspector</p>
              <h2 className="mt-1 truncate text-lg font-bold text-ink">{inspectorTitle}</h2>
            </div>
            {formOpen ? (
              <button
                type="button"
                aria-label="Cerrar inspector"
                onClick={closeForm}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {formOpen ? (
            <ProductForm
              key={editingProduct?.id ?? "new-desktop"}
              categories={categories}
              initialProduct={editingProduct}
              onSubmit={handleSubmit}
              loading={saving}
            />
          ) : selectedProduct ? (
            <div className="space-y-3">
              <div className="rounded border border-black/5 bg-zinc-50 p-3">
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-white">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                      {selectedProduct.sku}
                    </p>
                    <h3 className="mt-1 truncate text-base font-bold text-ink">{selectedProduct.name}</h3>
                    <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(selectedProduct.final_price)}</p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-white p-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Categoria</dt>
                    <dd className="mt-1 truncate text-zinc-700">{selectedProduct.product_category_name ?? "Sin categoria"}</dd>
                  </div>
                  <div className="rounded bg-white p-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Subcat.</dt>
                    <dd className="mt-1 truncate text-zinc-700">
                      {selectedProduct.product_subcategory_name ?? "Sin subcategoria"}
                    </dd>
                  </div>
                  <div className="rounded bg-white p-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Stock</dt>
                    <dd className="mt-1 text-zinc-700">{selectedProduct.stock_quantity ?? "Sin control"}</dd>
                  </div>
                  <div className="rounded bg-white p-2">
                    <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Estado</dt>
                    <dd className="mt-1 text-zinc-700">{selectedProduct.is_available ? "Activo" : "Pausado"}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={() => openEditForm(selectedProduct)}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded bg-zinc-100 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar producto
              </button>
            </div>
          ) : (
            <div className="rounded bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
              Carga un producto para ver el detalle y editarlo desde este inspector.
            </div>
          )}
        </aside>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(92,52,24,0.24)] p-4 backdrop-blur-[2px] md:items-center xl:hidden">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo</p>
                <h2 className="mt-2 text-xl font-bold text-ink">
                  {editingProduct ? "Editar producto" : "Nuevo producto"}
                </h2>
              </div>
              <button type="button" onClick={closeForm} className="kp-soft-action min-h-[44px] px-4 py-2 text-sm">
                Cerrar
              </button>
            </div>
            <ProductForm
              key={editingProduct?.id ?? "new"}
              categories={categories}
              initialProduct={editingProduct}
              onSubmit={handleSubmit}
              loading={saving}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
