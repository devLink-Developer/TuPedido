import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CatalogBanner, EmptyState, LoadingCard, RubroChip } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchAddresses, fetchCatalogBanner, fetchStores } from "../../../shared/services/api";
import { useCategoryStore, useClienteStore } from "../../../shared/stores";
import type { CatalogBanner as CatalogBannerData, StoreSummary } from "../../../shared/types";
import { subscribeCatalogStoresChanged } from "../../../shared/utils/catalogStores";
import { StoreList } from "../components/StoreList";
import { buildCatalogTheme } from "../utils/catalogTheme";

const LIVE_REFRESH_INTERVAL_MS = 5000;

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = useClienteStore((state) => state.categorySlug);
  const search = useClienteStore((state) => state.search);
  const deliveryMode = useClienteStore((state) => state.deliveryMode);
  const customerLocation = useClienteStore((state) => state.customerLocation);
  const setCategorySlug = useClienteStore((state) => state.setCategorySlug);
  const setSearch = useClienteStore((state) => state.setSearch);
  const setDeliveryMode = useClienteStore((state) => state.setDeliveryMode);
  const setCustomerLocation = useClienteStore((state) => state.setCustomerLocation);
  const { token, isAuthenticated } = useAuthSession();
  const categories = useCategoryStore((state) => state.categories);
  const categoryLoading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [catalogBanner, setCatalogBanner] = useState<CatalogBannerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef({ categorySlug: "", search: "", deliveryMode: "" as "" | "delivery" | "pickup" });
  const locationRef = useRef(customerLocation);
  const requestIdRef = useRef(0);
  const hasLoadedStoresRef = useRef(false);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug]
  );
  const catalogTheme = useMemo(() => buildCatalogTheme(selectedCategory), [selectedCategory]);

  filtersRef.current = { categorySlug, search, deliveryMode };
  locationRef.current = customerLocation;

  useEffect(() => {
    setCategorySlug(searchParams.get("category") ?? "");
    setSearch(searchParams.get("search") ?? "");
    const delivery = searchParams.get("delivery");
    setDeliveryMode(delivery === "pickup" || delivery === "delivery" ? delivery : "");
  }, [searchParams, setCategorySlug, setDeliveryMode, setSearch]);

  useEffect(() => {
    void loadCategories().catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    if (customerLocation) {
      setLocationLoading(false);
      setLocationError(null);
      return;
    }
    if (!isAuthenticated || !token) {
      setLocationLoading(false);
      return;
    }

    let cancelled = false;
    setLocationLoading(true);
    fetchAddresses(token)
      .then((addressList) => {
        if (cancelled) return;
        const geolocatedAddresses = addressList.filter(
          (address) => address.latitude !== null && address.longitude !== null
        );
        const selectedAddress = geolocatedAddresses.find((address) => address.is_default) ?? geolocatedAddresses[0];
        if (selectedAddress?.latitude !== null && selectedAddress?.longitude !== null) {
          setCustomerLocation({
            latitude: selectedAddress.latitude,
            longitude: selectedAddress.longitude,
            source: "address"
          });
          setLocationError(null);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setLocationError(requestError instanceof Error ? requestError.message : "No se pudo leer tu direccion");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerLocation, isAuthenticated, setCustomerLocation, token]);

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
    const nextLocation = locationRef.current;

    if (!nextLocation) {
      if (!options?.silent) {
        setLoading(false);
        setError(null);
        setStores([]);
      }
      return;
    }

    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const items = await fetchStores({
        categorySlug: nextCategorySlug || undefined,
        search: nextSearch || undefined,
        deliveryMode: nextDeliveryMode || undefined,
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude
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
  }, [categorySlug, customerLocation, deliveryMode, search]);

  function requestGpsLocation() {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no permite obtener ubicacion GPS.");
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "gps"
        });
        setLocationLoading(false);
      },
      () => {
        setLocationError("No pudimos obtener tu ubicacion. Revisa permisos o carga una direccion.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--catalog-accent", catalogTheme.accent);
    root.style.setProperty("--catalog-accent-light", catalogTheme.accentLight);
    root.style.setProperty("--catalog-accent-soft", catalogTheme.accentSoft);
    root.style.setProperty("--catalog-accent-border", catalogTheme.accentBorder);
    root.style.setProperty("--catalog-accent-shadow", catalogTheme.accentShadow);
    root.style.setProperty("--page-glow", catalogTheme.pageGlow);

    return () => {
      root.style.removeProperty("--catalog-accent");
      root.style.removeProperty("--catalog-accent-light");
      root.style.removeProperty("--catalog-accent-soft");
      root.style.removeProperty("--catalog-accent-border");
      root.style.removeProperty("--catalog-accent-shadow");
      root.style.removeProperty("--page-glow");
    };
  }, [catalogTheme]);

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
      <section
        className="app-panel rounded p-3 transition-[border-color,box-shadow,background] duration-300"
        style={{
          borderColor: catalogTheme.accentBorder,
          backgroundImage: catalogTheme.bannerFrame,
          boxShadow: `0 24px 52px -38px ${catalogTheme.accentShadowStrong}`
        }}
      >
        <CatalogBanner
          imageUrl={catalogBanner?.catalog_banner_image_url}
          width={catalogBanner?.catalog_banner_width}
          height={catalogBanner?.catalog_banner_height}
          alt="Banner principal del catalogo"
        />
      </section>

      <div
        className="app-panel grid gap-4 rounded p-5 transition-[border-color,box-shadow,background] duration-300 md:grid-cols-[1.3fr_0.7fr]"
        style={{
          borderColor: catalogTheme.accentBorder,
          backgroundImage: catalogTheme.filterPanel,
          boxShadow: `0 20px 44px -34px ${catalogTheme.accentShadow}`
        }}
      >
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Buscar</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateQuery({ search: event.target.value });
            }}
            placeholder="Despensa, farmacia, parrilla..."
            className="app-input"
            style={{ borderColor: catalogTheme.accentBorder }}
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
            className="app-input"
            style={{ borderColor: catalogTheme.accentBorder }}
          >
            <option value="">Todos</option>
            <option value="delivery">Envio</option>
            <option value="pickup">Retiro</option>
          </select>
        </label>
      </div>

      <section
        className="kp-client-panel p-4 transition-[border-color,box-shadow,background] duration-300"
        style={{
          borderColor: catalogTheme.accentBorder,
          backgroundImage: catalogTheme.chipPanel,
          boxShadow: `0 18px 40px -34px ${catalogTheme.accentShadow}`
        }}
      >
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Rubros destacados</p>
          <h2 className="text-xl font-black tracking-tight text-ink">
            {selectedCategory ? `Estas viendo ${selectedCategory.name}` : "Elige tu rubro"}
          </h2>
          <p className="text-sm text-zinc-600">
            {selectedCategory
              ? "El catalogo toma el tono del rubro para que encuentres opciones mas rapido."
              : "Toca un rubro y deja el catalogo mas enfocado para ese tipo de compra."}
          </p>
        </div>

        <div className="hide-scrollbar mt-4 flex flex-wrap gap-2 overflow-x-auto pb-1 sm:gap-3">
          <RubroChip
            label="Todos los rubros"
            icon="grid"
            color="#ff6a1a"
            colorLight="#fff0e5"
            selected={!categorySlug}
            onClick={() => {
              setCategorySlug("");
              updateQuery({ categorySlug: "" });
            }}
          />
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
      </section>

      {locationLoading || loading || categoryLoading ? <LoadingCard /> : null}
      {error ? <EmptyState title="No se pudo cargar el listado" description={error} /> : null}

      {!locationLoading && !customerLocation ? (
        <EmptyState
          title="Define tu ubicacion"
          description={locationError ?? "Necesitamos tu direccion o ubicacion GPS para mostrar comercios que lleguen hasta tu zona."}
          action={
            <button type="button" onClick={requestGpsLocation} className="app-button min-h-[48px] px-4 py-2 text-sm">
              Usar mi ubicacion
            </button>
          }
        />
      ) : null}

      {!locationLoading && !loading && !categoryLoading && !error && customerLocation ? (
        stores.length ? (
          <StoreList stores={stores} selectedCategoryId={selectedCategory?.id ?? null} theme={catalogTheme} />
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
