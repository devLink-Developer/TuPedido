import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
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
import { CatalogTaxonomyManager } from "../components/CatalogTaxonomyManager";
import { ProductForm } from "../components/ProductForm";
import { ProductList } from "../components/ProductList";

export function ProductsPage() {
  const { token } = useAuthSession();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(payload: ProductWrite) {
    if (!token) return;
    setSaving(true);
    try {
      if (editingProduct) {
        await updateMerchantProduct(token, editingProduct.id, payload);
      } else {
        await createMerchantProduct(token, payload);
      }
      setEditingProduct(null);
      setFormOpen(false);
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: number) {
    if (!token) return;
    await deleteMerchantProduct(token, productId);
    await load({ silent: true });
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Productos no disponibles" description={error} />;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        eyebrow="Comercial"
        compact
        title="Catálogo"
        description="Gestiona productos, categorías y subcategorías desde una sola pantalla compacta."
        action={
          <Button
            type="button"
            className="bg-brand-500 text-white"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            disabled={!categories.length}
          >
            Nuevo producto
          </Button>
        }
      />

      {!categories.length ? (
        <section className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Primero crea al menos una categoría en el bloque de taxonomía. Después podrás cargar productos.
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <ProductList
          products={products}
          onEdit={(product) => {
            setEditingProduct(product);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
        />
        <CatalogTaxonomyManager categories={categories} onRefresh={() => load({ silent: true })} />
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(92,52,24,0.24)] p-4 backdrop-blur-[2px] md:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catálogo</p>
                <h2 className="mt-2 text-xl font-bold text-ink">
                  {editingProduct ? "Editar producto" : "Nuevo producto"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(false);
                }}
                className="kp-soft-action min-h-[40px] px-4 py-2 text-sm"
              >
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
