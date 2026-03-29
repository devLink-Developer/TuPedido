import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
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
      setLoading(false);
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
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: number) {
    if (!token) return;
    await deleteMerchantProduct(token, productId);
    await load();
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Productos no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Productos"
        description="Administra un catalogo real con datos comerciales, stock, imagenes y descuentos."
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
            Agregar producto
          </Button>
        }
      />

      {!categories.length ? (
        <EmptyState
          title="Primero crea la taxonomia del catalogo"
          description="Configura categorias y subcategorias en la seccion de configuracion antes de dar de alta productos."
          action={
            <Link to="/m/configuracion" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Ir a configuracion
            </Link>
          }
        />
      ) : null}

      <ProductList
        products={products}
        onEdit={(product) => {
          setEditingProduct(product);
          setFormOpen(true);
        }}
        onDelete={handleDelete}
      />

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(17,24,39,0.48)] p-4 md:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">
                  {editingProduct ? "Editar producto" : "Nuevo producto"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(false);
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
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
