import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CatalogBanner, EmptyState, LoadingCard, RubroChip } from "../../../shared/components";
import { fetchCatalogBanner, fetchStores } from "../../../shared/services/api";
import { useCategoryStore, useClienteStore } from "../../../shared/stores";
import type { CatalogBanner as CatalogBannerData, StoreSummary } from "../../../shared/types";
import { subscribeCatalogStoresChanged } from "../../../shared/utils/catalogStores";
import { StoreList } from "../components/StoreList";

const LIVE_REFRESH_INTERVAL_MS = 5000;

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = useClienteStore((state) => state.categorySlug);
  const search = useClienteStore((state) => state.search);
  const deliveryMode = useClienteStore((state) => state.deliveryMode);
  const setCategorySlug = useClienteStore((state) => state.setCategorySlug);
  const setSearch = useClienteStore((state) => state.setSearch);
  const setDeliveryMode = useClienteStore((state) => state.setDeliveryMode);
  const categories = useCategoryStore((state) => state.categories);
  const categoryLoading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [catalogBanner, setCatalogBanner] = useState<CatalogBannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef({ categorySlug: "", search: "", deliveryMode: "" as "" | "delivery" | "pickup" });
  const requestIdRef = useRef(0);
  const hasLoadedStoresRef = useRef(false);

  filtersRef.current = { categorySlug, search, deliveryMode };

  useEffect(() => {
    setCategorySlug(searchParams.get("category") ?? "");
    setSearch(searchParams.get("search") ?? "");
    const delivery = searchParams.get("delivery");
    setDeliveryMode(delivery === "pickup" || delivery === "delivery" ? delivery : "");
  }, [searchParams, setCategorySlug, setDeliveryMode, setSearch]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogBanner()
      .then((result) => {
        if (!cancelled) {
          setCatalogBanner(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogBanner(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadStores(options?: { silent?: boolean }) {
    const requestId = ++requestIdRef.current;
    const { categorySlug: nextCategorySlug, search: nextSearch, deliveryMode: nextDeliveryMode } = filtersRef.current;

    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const items = await fetchStores({
        categorySlug: nextCategorySlug || undefined,
        search: nextSearch || undefined,
        deliveryMode: nextDeliveryMode || undefined
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      hasLoadedStoresRef.current = true;
      setStores(items);
      setError(null);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!options?.silent) {
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los comercios");
        setStores([]);
      }
    } finally {
      if (!options?.silent && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadStores();
  }, [categorySlug, deliveryMode, search]);

  useEffect(() => {
    const unsubscribe = subscribeCatalogStoresChanged(() => {
      void loadStores({ silent: hasLoadedStoresRef.current });
    });

    const refreshStoresSilently = () => {
      if (hasLoadedStoresRef.current) {
        void loadStores({ silent: true });
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshStoresSilently();
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      refreshStoresSilently();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshStoresSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function updateQuery(next: { categorySlug?: string; search?: string; deliveryMode?: string }) {
    const params = new URLSearchParams(searchParams);
    const nextCategory = next.categorySlug ?? categorySlug;
    const nextSearch = next.search ?? search;
    const nextDeliveryMode = next.deliveryMode ?? deliveryMode;

    nextCategory ? params.set("category", nextCategory) : params.delete("category");
    nextSearch ? params.set("search", nextSearch) : params.delete("search");
    nextDeliveryMode ? params.set("delivery", nextDeliveryMode) : params.delete("delivery");
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-6">
      <CatalogBanner
        imageUrl={catalogBanner?.catalog_banner_image_url}
        width={catalogBanner?.catalog_banner_width}
        height={catalogBanner?.catalog_banner_height}
        alt="Banner principal del catalogo"
      />

      <div className="grid gap-4 rounded-[28px] bg-white p-5 shadow-sm md:grid-cols-[1.3fr_0.7fr]">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Buscar</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateQuery({ search: event.target.value });
            }}
            placeholder="Despensa, farmacia, parrilla..."
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Entrega</span>
          <select
            value={deliveryMode}
            onChange={(event) => {
              setDeliveryMode(event.target.value as "" | "delivery" | "pickup");
              updateQuery({ deliveryMode: event.target.value });
            }}
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
          >
            <option value="">Todos</option>
            <option value="delivery">Envio</option>
            <option value="pickup">Retiro</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setCategorySlug("");
            updateQuery({ categorySlug: "" });
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            !categorySlug ? "bg-ink text-white" : "bg-white text-zinc-600 shadow-sm"
          }`}
        >
          Todos los rubros
        </button>
        {categories.map((category) => {
          const selected = categorySlug === category.slug;
          return (
            <RubroChip
              key={category.id}
              label={category.name}
              color={category.color}
              colorLight={category.color_light}
              icon={category.icon}
              selected={selected}
              onClick={() => {
                setCategorySlug(category.slug);
                updateQuery({ categorySlug: category.slug });
              }}
            />
          );
        })}
      </div>

      {loading || categoryLoading ? <LoadingCard /> : null}
      {error ? <EmptyState title="No se pudo cargar el listado" description={error} /> : null}

      {!loading && !categoryLoading && !error ? (
        stores.length ? (
          <StoreList stores={stores} />
        ) : (
          <EmptyState
            title="No hay comercios para ese filtro"
            description="Prueba cambiar el rubro, la busqueda o el modo de entrega."
          />
        )
      ) : null}
    </div>
  );
}
