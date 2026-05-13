import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, ChevronDown, MapPin, Navigation } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { CatalogBanner, EmptyState, LoadingCard, RubroChip } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchAddresses, fetchCatalogBanner, fetchStores } from "../../../shared/services/api";
import { useCategoryStore, useClienteStore } from "../../../shared/stores";
import type { Address, CatalogBanner as CatalogBannerData, StoreSummary } from "../../../shared/types";
import { subscribeCatalogStoresChanged } from "../../../shared/utils/catalogStores";
import { StoreList } from "../components/StoreList";
import { buildCatalogTheme } from "../utils/catalogTheme";

const LIVE_REFRESH_INTERVAL_MS = 5000;
type PinnedAddress = Address & { latitude: number; longitude: number };

function hasAddressPin(address: Address): address is PinnedAddress {
  return (
    typeof address.latitude === "number" &&
    Number.isFinite(address.latitude) &&
    typeof address.longitude === "number" &&
    Number.isFinite(address.longitude)
  );
}

function pickAddressForCatalog(addresses: Address[], selectedAddressId: number | "") {
  const pinnedAddresses = addresses.filter(hasAddressPin);
  return (
    pinnedAddresses.find((address) => address.id === selectedAddressId) ??
    pinnedAddresses.find((address) => address.is_default) ??
    pinnedAddresses[0] ??
    null
  );
}

function locationFromAddress(address: PinnedAddress) {
  return {
    latitude: address.latitude,
    longitude: address.longitude,
    source: "address" as const,
    addressId: address.id
  };
}

function sameCustomerLocation(
  current: ReturnType<typeof useClienteStore.getState>["customerLocation"],
  next: ReturnType<typeof locationFromAddress>
) {
  return (
    current?.latitude === next.latitude &&
    current.longitude === next.longitude &&
    current.source === next.source &&
    current.addressId === next.addressId
  );
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = useClienteStore((state) => state.categorySlug);
  const search = useClienteStore((state) => state.search);
  const deliveryMode = useClienteStore((state) => state.deliveryMode);
  const customerLocation = useClienteStore((state) => state.customerLocation);
  const selectedAddressId = useClienteStore((state) => state.selectedAddressId);
  const setCategorySlug = useClienteStore((state) => state.setCategorySlug);
  const setSearch = useClienteStore((state) => state.setSearch);
  const setDeliveryMode = useClienteStore((state) => state.setDeliveryMode);
  const setSelectedAddressId = useClienteStore((state) => state.setSelectedAddressId);
  const setCustomerLocation = useClienteStore((state) => state.setCustomerLocation);
  const { token, isAuthenticated } = useAuthSession();
  const categories = useCategoryStore((state) => state.categories);
  const categoryLoading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [catalogBanner, setCatalogBanner] = useState<CatalogBannerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef({ categorySlug: "", search: "", deliveryMode: "" as "" | "delivery" | "pickup" });
  const locationRef = useRef(customerLocation);
  const requestIdRef = useRef(0);
  const activeLoadingRequestIdRef = useRef<number | null>(null);
  const inFlightStoresKeyRef = useRef<string | null>(null);
  const loadedStoresKeyRef = useRef<string | null>(null);
  const hasLoadedStoresRef = useRef(false);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug]
  );
  const catalogTheme = useMemo(() => buildCatalogTheme(selectedCategory), [selectedCategory]);
  const pinnedAddresses = useMemo(() => addresses.filter(hasAddressPin), [addresses]);
  const selectedAddress = useMemo(
    () => pinnedAddresses.find((address) => address.id === selectedAddressId) ?? null,
    [pinnedAddresses, selectedAddressId]
  );
  const selectedLocationLabel =
    customerLocation?.source === "gps"
      ? "Ubicacion actual"
      : selectedAddress
        ? `${selectedAddress.label || "Direccion"} - ${selectedAddress.street}`
        : customerLocation?.source === "address"
          ? "Direccion guardada"
          : "Sin ubicacion";
  const hasConfiguredAddress = pinnedAddresses.length > 0;

  filtersRef.current = { categorySlug, search, deliveryMode };
  locationRef.current = customerLocation;

  useEffect(() => {
    const nextCategorySlug = searchParams.get("category") ?? "";
    const nextSearch = searchParams.get("search") ?? "";
    const delivery = searchParams.get("delivery");
    const nextDeliveryMode = delivery === "pickup" || delivery === "delivery" ? delivery : "";

    if (categorySlug !== nextCategorySlug) setCategorySlug(nextCategorySlug);
    if (search !== nextSearch) setSearch(nextSearch);
    if (deliveryMode !== nextDeliveryMode) setDeliveryMode(nextDeliveryMode);
  }, [categorySlug, deliveryMode, search, searchParams, setCategorySlug, setDeliveryMode, setSearch]);

  useEffect(() => {
    void loadCategories().catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAddresses([]);
      setLocationLoading(false);
      return;
    }

    let cancelled = false;
    setLocationLoading(true);
    fetchAddresses(token)
      .then((addressList) => {
        if (cancelled) return;
        setAddresses(addressList);
        const addressForCatalog = pickAddressForCatalog(addressList, selectedAddressId);

        if (!addressForCatalog) {
          if (!customerLocation || customerLocation.source === "address") {
            setCustomerLocation(null);
            setSelectedAddressId("");
          }
          return;
        }

        if (customerLocation?.source === "gps") {
          return;
        }

        const nextLocation = locationFromAddress(addressForCatalog);
        setSelectedAddressId(addressForCatalog.id);
        if (!sameCustomerLocation(customerLocation, nextLocation)) {
          setCustomerLocation(nextLocation);
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
  }, [customerLocation, isAuthenticated, selectedAddressId, setCustomerLocation, setSelectedAddressId, token]);

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
    const { categorySlug: nextCategorySlug, search: nextSearch, deliveryMode: nextDeliveryMode } = filtersRef.current;
    const nextLocation = locationRef.current;

    if (!nextLocation) {
      loadedStoresKeyRef.current = null;
      if (!options?.silent) {
        setLoading(false);
        setError(null);
        setStores([]);
      }
      return;
    }

    const requestKey = JSON.stringify({
      categorySlug: nextCategorySlug,
      search: nextSearch,
      deliveryMode: nextDeliveryMode,
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude
    });
    if (inFlightStoresKeyRef.current === requestKey) {
      return;
    }
    if (!options?.silent && loadedStoresKeyRef.current === requestKey) {
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightStoresKeyRef.current = requestKey;

    if (!options?.silent) {
      activeLoadingRequestIdRef.current = requestId;
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
      loadedStoresKeyRef.current = requestKey;
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
      if (inFlightStoresKeyRef.current === requestKey) {
        inFlightStoresKeyRef.current = null;
      }
      if (!options?.silent && activeLoadingRequestIdRef.current === requestId) {
        activeLoadingRequestIdRef.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (locationLoading) return;
    void loadStores();
  }, [categorySlug, customerLocation, deliveryMode, locationLoading, search]);

  function requestGpsLocation() {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no permite obtener ubicacion GPS.");
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedAddressId("");
        setAddressSelectorOpen(false);
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

  function selectAddress(address: PinnedAddress) {
    setSelectedAddressId(address.id);
    setCustomerLocation(locationFromAddress(address));
    setLocationError(null);
    setAddressSelectorOpen(false);
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
        className="app-panel space-y-4 rounded p-5 transition-[border-color,box-shadow,background] duration-300"
        style={{
          borderColor: catalogTheme.accentBorder,
          backgroundImage: catalogTheme.filterPanel,
          boxShadow: `0 20px 44px -34px ${catalogTheme.accentShadow}`
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            aria-label="Cambiar ubicacion de catalogo"
            aria-expanded={addressSelectorOpen}
            disabled={!hasConfiguredAddress}
            onClick={() => setAddressSelectorOpen((current) => !current)}
            className="inline-flex min-h-[44px] min-w-0 items-center gap-2 rounded border bg-white/86 px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-default disabled:opacity-80"
            style={{ borderColor: catalogTheme.accentBorder }}
          >
            {customerLocation?.source === "gps" ? <Navigation className="h-4 w-4 shrink-0 text-brand-600" /> : <MapPin className="h-4 w-4 shrink-0 text-brand-600" />}
            <span className="truncate">{selectedLocationLabel}</span>
            {hasConfiguredAddress ? <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition ${addressSelectorOpen ? "rotate-180" : ""}`} /> : null}
          </button>
          <button type="button" onClick={requestGpsLocation} className="kp-soft-action min-h-[44px] px-4 py-2 text-sm">
            Usar GPS
          </button>
        </div>

        {addressSelectorOpen && hasConfiguredAddress ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedAddresses.map((address) => {
              const active = selectedAddressId === address.id;
              return (
                <button
                  key={address.id}
                  type="button"
                  aria-label={`Usar ${address.label || address.street} para filtrar comercios`}
                  aria-pressed={active}
                  onClick={() => selectAddress(address)}
                  className={`min-h-[62px] rounded border px-3 py-2 text-left text-sm transition ${
                    active ? "bg-white text-ink shadow-sm" : "bg-white/64 text-zinc-600 hover:bg-white"
                  }`}
                  style={{ borderColor: active ? catalogTheme.accentBorderStrong : catalogTheme.accentBorder }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{address.label || "Direccion"}</span>
                    {active ? <CheckCircle className="h-4 w-4 shrink-0 text-brand-600" /> : null}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {[address.street, address.locality].filter(Boolean).join(" - ")}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
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
