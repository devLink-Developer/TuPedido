import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandWordmark, CatalogBanner, EmptyState, ImageAssetField, LoadingCard, PageHeader } from "../../../shared/components";
import { CATALOG_BANNER_RECOMMENDATION, formatCatalogBannerRatio, resolveCatalogBannerDimensions } from "../../../shared/config/catalogBanner";
import { useAuthSession } from "../../../shared/hooks";
import { fetchPlatformSettings, updatePlatformSettings } from "../../../shared/services/api";
import type { PlatformSettings } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

export function AppearancePage() {
  const { token } = useAuthSession();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [catalogBannerImageUrl, setCatalogBannerImageUrl] = useState("");
  const [catalogBannerWidth, setCatalogBannerWidth] = useState(String(CATALOG_BANNER_RECOMMENDATION.width));
  const [catalogBannerHeight, setCatalogBannerHeight] = useState(String(CATALOG_BANNER_RECOMMENDATION.height));
  const [loading, setLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const previewBannerDimensions = useMemo(
    () => resolveCatalogBannerDimensions(Number(catalogBannerWidth), Number(catalogBannerHeight)),
    [catalogBannerHeight, catalogBannerWidth]
  );
  const previewBannerRatio = useMemo(
    () => formatCatalogBannerRatio(previewBannerDimensions.width, previewBannerDimensions.height),
    [previewBannerDimensions.height, previewBannerDimensions.width]
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const platformResult = await fetchPlatformSettings(token);
      setPlatformSettings(platformResult);
      setCatalogBannerImageUrl(platformResult.catalog_banner_image_url ?? "");
      setCatalogBannerWidth(String(platformResult.catalog_banner_width ?? CATALOG_BANNER_RECOMMENDATION.width));
      setCatalogBannerHeight(String(platformResult.catalog_banner_height ?? CATALOG_BANNER_RECOMMENDATION.height));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar apariencia");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleCatalogBannerSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !platformSettings) return;
    const nextWidth = Number(catalogBannerWidth);
    const nextHeight = Number(catalogBannerHeight);
    if (!Number.isInteger(nextWidth) || nextWidth <= 0) {
      setBannerError("El ancho del banner debe ser un numero entero positivo.");
      return;
    }
    if (!Number.isInteger(nextHeight) || nextHeight <= 0) {
      setBannerError("El alto del banner debe ser un numero entero positivo.");
      return;
    }
    setBannerSaving(true);
    setBannerError(null);
    try {
      await updatePlatformSettings(token, {
        service_fee_amount: platformSettings.service_fee_amount,
        catalog_banner_image_url: catalogBannerImageUrl.trim() || null,
        catalog_banner_width: nextWidth,
        catalog_banner_height: nextHeight,
      });
      await load();
    } catch (requestError) {
      setBannerError(requestError instanceof Error ? requestError.message : "No se pudo guardar el banner");
    } finally {
      setBannerSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error || !platformSettings) {
    return <EmptyState title="Apariencia no disponible" description={error ?? "Sin datos"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Apariencia"
        description="Gestiona la identidad visible y el banner principal del catalogo cliente desde un solo lugar."
      />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="app-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Identidad</p>
          <h2 className="mt-2 text-lg font-bold text-ink">Marca visual</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            La marca publica del producto queda fija como KePedimos para mantener consistencia entre landing, catalogo, paneles y PWA.
          </p>
          <div className="mt-4 grid gap-4">
            <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Marca visible</p>
              <p className="mt-2 text-lg font-bold text-ink">KePedimos</p>
            </div>
            <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Assets</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Wordmark, logo de navegacion y favicon usan los archivos versionados del frontend.</p>
            </div>
            <div className="border border-[var(--color-border-default)] bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
              Los campos de carga de identidad quedan deshabilitados por decision de producto.
            </div>
          </div>
        </section>

        <section className="app-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview</p>
          <h2 className="mt-2 text-lg font-bold text-ink">Como se ve la marca</h2>
          <div className="mt-4 border border-[var(--color-border-default)] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <BrandWordmark size="title" />
              <span className="border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                Ingresar
              </span>
            </div>
          </div>
          <div className="kp-install-banner mt-4 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Acceso</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-2xl font-bold leading-tight text-ink">
              <span>Ingresar a</span>
              <BrandWordmark size="hero" className="min-w-0" />
            </div>
          </div>
        </section>
      </section>

      <form onSubmit={(event) => void handleCatalogBannerSave(event)} className="rounded bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo cliente</p>
            <h2 className="mt-2 text-lg font-bold text-ink">Banner principal</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Reemplaza por completo el texto de la cabecera en <code>/c</code>. Define imagen, tamano base y relacion visual desde esta pantalla.
            </p>
          </div>
          <span className="rounded bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            Relacion actual: {previewBannerRatio}
          </span>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <ImageAssetField
              label="Imagen del banner"
              value={catalogBannerImageUrl}
              onChange={setCatalogBannerImageUrl}
              folder="platform-banners"
              placeholder="https://..."
              description="Carga un archivo desde tu dispositivo o pega una URL. Si dejas el campo vacio, el catalogo usa el banner por defecto de la app."
              previewClassName="h-full w-full object-cover"
              previewWrapperStyle={{ aspectRatio: `${previewBannerDimensions.width} / ${previewBannerDimensions.height}` }}
              emptyLabel="Sin banner configurado"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ancho base</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={catalogBannerWidth}
                  onChange={(event) => setCatalogBannerWidth(event.target.value)}
                  className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Alto base</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={catalogBannerHeight}
                  onChange={(event) => setCatalogBannerHeight(event.target.value)}
                  className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                />
              </label>
            </div>
            <p className="text-sm text-zinc-500">
              Recomendado: {CATALOG_BANNER_RECOMMENDATION.width} x {CATALOG_BANNER_RECOMMENDATION.height} px.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview banner</p>
            <CatalogBanner imageUrl={catalogBannerImageUrl} width={previewBannerDimensions.width} height={previewBannerDimensions.height} />
          </div>
        </div>

        {bannerError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{bannerError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={bannerSaving}>
            {bannerSaving ? "Guardando..." : "Guardar banner"}
          </Button>
          <button
            type="button"
            onClick={() => setCatalogBannerImageUrl("")}
            className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
          >
            Quitar banner
          </button>
        </div>
      </form>
    </div>
  );
}
