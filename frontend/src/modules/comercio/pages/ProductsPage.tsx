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
import type { Product, ProductCategory } from "../../../shared/types";
import { ProductForm } from "../components/ProductForm";
import { ProductList } from "../components/ProductList";

export function ProductsPage() {
  const { token } = useAuthSession();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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

  async function handleSubmit(payload: {
    name: string;
    description: string;
    price: number;
    compare_at_price: number | null;
    image_url: string | null;
    product_category_id: number | null;
    is_available: boolean;
    sort_order: number;
  }) {
    if (!token) return;
    setSaving(true);
    try {
      if (editingProduct) {
        await updateMerchantProduct(token, editingProduct.id, payload);
      } else {
        await createMerchantProduct(token, payload);
      }
      setEditingProduct(null);
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
      <PageHeader eyebrow="Comercio" title="Productos" description="Alta, edición y catálogo operativo del dominio /m/productos." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ProductForm key={editingProduct?.id ?? "new"} categories={categories} initialProduct={editingProduct} onSubmit={handleSubmit} loading={saving} />
        <ProductList products={products} onEdit={setEditingProduct} onDelete={handleDelete} />
      </div>
    </div>
  );
}
