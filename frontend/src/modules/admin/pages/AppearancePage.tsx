import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandWordmark, CatalogBanner, EmptyState, ImageAssetField, LoadingCard, PageHeader } from "../../../shared/components";
import { CATALOG_BANNER_RECOMMENDATION, formatCatalogBannerRatio, resolveCatalogBannerDimensions } from "../../../shared/config/catalogBanner";
import { useAuthSession } from "../../../shared/hooks";
import { fetchPlatformSettings, updatePlatformSettings } from "../../../shared/services/api";
import { resolveApiMediaUrl } from "../../../shared/services/api/client";
import type { PlatformSettings } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

export function AppearancePage() {
  const { token } = useAuthSession();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [platformLogoUrl, setPlatformLogoUrl] = useState("");
  const [platformWordmarkUrl, setPlatformWordmarkUrl] = useState("");
  const [platformFaviconUrl, setPlatformFaviconUrl] = useState("");
  const [platformUseLogoAsFavicon, setPlatformUseLogoAsFavicon] = useState(false);
  const [catalogBannerImageUrl, setCatalogBannerImageUrl] = useState("");
  const [catalogBannerWidth, setCatalogBannerWidth] = useState(String(CATALOG_BANNER_RECOMMENDATION.width));
  const [catalogBannerHeight, setCatalogBannerHeight] = useState(String(CATALOG_BANNER_RECOMMENDATION.height));
  const [loading, setLoading] = useState(true);
  const [brandSaving, setBrandSaving] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const previewBannerDimensions = useMemo(
    () => resolveCatalogBannerDimensions(Number(catalogBannerWidth), Number(catalogBannerHeight)),
    [catalogBannerHeight, catalogBannerWidth]
  );
  const previewBannerRatio = useMemo(
    () => formatCatalogBannerRatio(previewBannerDimensions.width, previewBannerDimensions.height),
    [previewBannerDimensions.height, previewBannerDimensions.width]
  );
  const previewWordmarkUrl = platformWordmarkUrl || platformLogoUrl || null;
  const previewLogoUrl = platformLogoUrl ? resolveApiMediaUrl(platformLogoUrl) : null;
  const previewFaviconUrl = (platformUseLogoAsFavicon ? platformLogoUrl : platformFaviconUrl)
    ? resolveApiMediaUrl(platformUseLogoAsFavicon ? platformLogoUrl : platformFaviconUrl)
    : null;

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const platformResult = await fetchPlatformSettings(token);
      setPlatformSettings(platformResult);
      setPlatformLogoUrl(platformResult.platform_logo_url ?? "");
      setPlatformWordmarkUrl(platformResult.platform_wordmark_url ?? "");
      setPlatformFaviconUrl(platformResult.platform_favicon_url ?? "");
      setPlatformUseLogoAsFavicon(Boolean(platformResult.platform_use_logo_as_favicon));
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

  async function handleBrandSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !platformSettings) return;
    setBrandSaving(true);
    setBrandError(null);
    try {
      await updatePlatformSettings(token, {
        service_fee_amount: platformSettings.service_fee_amount,
        platform_logo_url: platformLogoUrl.trim() || null,
        platform_wordmark_url: platformWordmarkUrl.trim() || null,
        platform_favicon_url: platformFaviconUrl.trim() || null,
        platform_use_logo_as_favicon: platformUseLogoAsFavicon,
        catalog_banner_image_url: platformSettings.catalog_banner_image_url ?? null,
        catalog_banner_width: platformSettings.catalog_banner_width ?? CATALOG_BANNER_RECOMMENDATION.width,
        catalog_banner_height: platformSettings.catalog_banner_height ?? CATALOG_BANNER_RECOMMENDATION.height,
      });
      window.dispatchEvent(new Event("platform-branding-updated"));
      await load();
    } catch (requestError) {
      setBrandError(requestError instanceof Error ? requestError.message : "No se pudo guardar la marca");
    } finally {
      setBrandSaving(false);
    }
  }

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
        <form onSubmit={(event) => void handleBrandSave(event)} className="app-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Identidad</p>
          <h2 className="mt-2 text-lg font-bold text-ink">Marca visual</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Carga los assets visibles de la plataforma. El wordmark se usa en headers y pantallas de acceso; el logo queda disponible para usos compactos.
          </p>
          <div className="mt-4 grid gap-4">
            <ImageAssetField
              label="Wordmark principal"
              value={platformWordmarkUrl}
              onChange={setPlatformWordmarkUrl}
              folder="platform-branding"
              placeholder="https://..."
              description="Imagen horizontal de la marca. Recomendado: PNG/WebP transparente con proporcion aproximada 4:1."
              previewClassName="h-full w-full object-contain p-4"
              previewWrapperStyle={{ aspectRatio: "4 / 1" }}
              emptyLabel="Sin wordmark cargado"
            />
            <ImageAssetField
              label="Logo compacto"
              value={platformLogoUrl}
              onChange={setPlatformLogoUrl}
              folder="platform-branding"
              placeholder="https://..."
              description="Version compacta para navegacion o favicon si activas esa opcion. Recomendado: imagen cuadrada transparente."
              previewClassName="h-full w-full object-contain p-5"
              previewWrapperStyle={{ aspectRatio: "1 / 1", maxWidth: 220 }}
              emptyLabel="Sin logo cargado"
            />
            <ImageAssetField
              label="Favicon"
              value={platformFaviconUrl}
              onChange={setPlatformFaviconUrl}
              folder="platform-branding"
              placeholder="https://..."
              description="Icono del navegador. Si activas usar logo como favicon, este campo queda como respaldo."
              previewClassName="h-full w-full object-contain p-5"
              previewWrapperStyle={{ aspectRatio: "1 / 1", maxWidth: 160 }}
              emptyLabel="Sin favicon cargado"
            />
            <label className="flex items-center gap-3 rounded border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={platformUseLogoAsFavicon}
                onChange={(event) => setPlatformUseLogoAsFavicon(event.target.checked)}
              />
              Usar logo compacto como favicon
            </label>
            {brandError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{brandError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={brandSaving}>
                {brandSaving ? "Guardando..." : "Guardar marca"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setPlatformWordmarkUrl("");
                  setPlatformLogoUrl("");
                  setPlatformFaviconUrl("");
                  setPlatformUseLogoAsFavicon(false);
                }}
                className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
              >
                Limpiar marca
              </button>
            </div>
          </div>
        </form>

        <section className="app-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview</p>
          <h2 className="mt-2 text-lg font-bold text-ink">Como se ve la marca</h2>
          <div className="mt-4 border border-[var(--color-border-default)] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <BrandWordmark size="title" wordmarkUrl={previewWordmarkUrl} />
              <span className="border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                Ingresar
              </span>
            </div>
          </div>
          <div className="kp-install-banner mt-4 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Acceso</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-2xl font-bold leading-tight text-ink">
              <span>Ingresar a</span>
              <BrandWordmark size="hero" className="min-w-0" wordmarkUrl={previewWordmarkUrl} />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Logo compacto</p>
              <div className="mt-3 h-16 w-16 overflow-hidden border border-black/10 bg-zinc-50 p-2">
                {previewLogoUrl ? <img src={previewLogoUrl} alt="Logo compacto" className="h-full w-full object-contain" /> : null}
              </div>
            </div>
            <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Favicon</p>
              <div className="mt-3 h-16 w-16 overflow-hidden border border-black/10 bg-zinc-50 p-2">
                {previewFaviconUrl ? <img src={previewFaviconUrl} alt="Favicon" className="h-full w-full object-contain" /> : null}
              </div>
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
