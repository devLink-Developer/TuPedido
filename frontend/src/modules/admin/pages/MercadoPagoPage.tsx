import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchAdminMercadoPagoProvider,
  fetchPlatformSettings,
  updateAdminMercadoPagoProvider
} from "../../../shared/services/api";
import type { PaymentProviderConfig, PlatformSettings } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";
import { Button } from "../../../shared/ui/Button";

type MercadoPagoProviderFormState = {
  client_id: string;
  public_key: string;
  client_secret: string;
  webhook_secret: string;
  redirect_uri: string;
  enabled: boolean;
  mode: "sandbox" | "production";
  commission_mode: "percentage" | "fixed";
  commission_value: string;
};

const emptyMercadoPagoProviderForm: MercadoPagoProviderFormState = {
  client_id: "",
  public_key: "",
  client_secret: "",
  webhook_secret: "",
  redirect_uri: "",
  enabled: false,
  mode: "sandbox",
  commission_mode: "fixed",
  commission_value: ""
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPublicHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

function isMercadoPagoCredentialToken(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("APP_USR-") || normalized.startsWith("TEST-") || normalized.startsWith("PROD-");
}

export function MercadoPagoPage() {
  const { token } = useAuthSession();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderConfig | null>(null);
  const [mercadoPagoForm, setMercadoPagoForm] = useState<MercadoPagoProviderFormState>(emptyMercadoPagoProviderForm);
  const [loading, setLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerFieldErrors, setProviderFieldErrors] = useState<Partial<Record<keyof MercadoPagoProviderFormState, string>>>({});
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const commissionPreview = useMemo(() => {
    const sampleGross = 10000;
    const value = toNumber(mercadoPagoForm.commission_value, 0);
    const fee = mercadoPagoForm.commission_mode === "percentage" ? sampleGross * (value / 100) : value;
    return {
      gross: sampleGross,
      fee: Math.min(Math.max(fee, 0), sampleGross),
      net: sampleGross - Math.min(Math.max(fee, 0), sampleGross)
    };
  }, [mercadoPagoForm.commission_mode, mercadoPagoForm.commission_value]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [platformResult, paymentProviderResult] = await Promise.all([
        fetchPlatformSettings(token),
        fetchAdminMercadoPagoProvider(token)
      ]);
      setPlatformSettings(platformResult);
      setPaymentProvider(paymentProviderResult);
      setMercadoPagoForm({
        client_id: paymentProviderResult.client_id ?? "",
        public_key: paymentProviderResult.public_key ?? "",
        client_secret: "",
        webhook_secret: "",
        redirect_uri: paymentProviderResult.redirect_uri ?? "",
        enabled: paymentProviderResult.enabled,
        mode: paymentProviderResult.mode,
        commission_mode: paymentProviderResult.commission_mode ?? "fixed",
        commission_value:
          paymentProviderResult.commission_value !== null && paymentProviderResult.commission_value !== undefined
            ? String(paymentProviderResult.commission_value)
            : String(platformResult.service_fee_amount)
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Pago");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleMercadoPagoProviderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !paymentProvider) return;
    const nextErrors: Partial<Record<keyof MercadoPagoProviderFormState, string>> = {};
    if (mercadoPagoForm.enabled) {
      if (!mercadoPagoForm.client_id.trim()) nextErrors.client_id = "El Client ID es obligatorio.";
      if (isMercadoPagoCredentialToken(mercadoPagoForm.client_id)) {
        nextErrors.client_id = "Usa el Client ID/Application ID de OAuth, no la Public Key ni el Access Token.";
      }
      if (!paymentProvider.simulated && !mercadoPagoForm.public_key.trim()) {
        nextErrors.public_key = "La Public Key del integrador es obligatoria para Card Payment Brick.";
      }
      if (!mercadoPagoForm.client_secret.trim() && !paymentProvider.client_secret_masked) {
        nextErrors.client_secret = "El Client Secret es obligatorio.";
      }
      if (!paymentProvider.simulated && !mercadoPagoForm.webhook_secret.trim() && !paymentProvider.webhook_secret_masked) {
        nextErrors.webhook_secret = "El Webhook Secret es obligatorio para pagos reales.";
      }
      if (!mercadoPagoForm.redirect_uri.trim() || !isValidHttpUrl(mercadoPagoForm.redirect_uri.trim())) {
        nextErrors.redirect_uri = "Ingresa una URL http/https valida.";
      }
      if (!paymentProvider.simulated && isPublicHttpUrl(mercadoPagoForm.redirect_uri)) {
        nextErrors.redirect_uri = "Mercado Pago requiere HTTPS para callbacks OAuth publicos.";
      }
      if (!mercadoPagoForm.commission_value.trim()) {
        nextErrors.commission_value = "Define la comision que retendra la plataforma.";
      }
      if (mercadoPagoForm.commission_mode === "percentage" && toNumber(mercadoPagoForm.commission_value, 0) > 100) {
        nextErrors.commission_value = "La comision porcentual no puede superar 100%.";
      }
    }
    if (Object.keys(nextErrors).length) {
      setProviderFieldErrors(nextErrors);
      setProviderError("Revisa los campos marcados antes de guardar Mercado Pago.");
      return;
    }
    if (paymentProvider.enabled && !mercadoPagoForm.enabled && !window.confirm("Desactivar Mercado Pago ocultara este medio de pago para todos los comercios. Continuar?")) {
      return;
    }
    if (paymentProvider.mode !== "production" && mercadoPagoForm.mode === "production" && !window.confirm("Pasar a Produccion usara credenciales reales de Mercado Pago. Continuar?")) {
      return;
    }
    setProviderSaving(true);
    setProviderError(null);
    setProviderMessage(null);
    setProviderFieldErrors({});
    try {
      await updateAdminMercadoPagoProvider(token, {
        client_id: mercadoPagoForm.client_id.trim() || null,
        public_key: mercadoPagoForm.public_key.trim() || null,
        client_secret: mercadoPagoForm.client_secret.trim() || null,
        webhook_secret: mercadoPagoForm.webhook_secret.trim() || null,
        redirect_uri: mercadoPagoForm.redirect_uri.trim() || null,
        enabled: mercadoPagoForm.enabled,
        mode: mercadoPagoForm.mode,
        commission_mode: mercadoPagoForm.commission_mode,
        commission_value: mercadoPagoForm.commission_value.trim() ? Number(mercadoPagoForm.commission_value) : null
      });
      setProviderMessage("Configuracion de Mercado Pago guardada.");
      await load();
    } catch (requestError) {
      setProviderError(requestError instanceof Error ? requestError.message : "No se pudo guardar Mercado Pago");
    } finally {
      setProviderSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error || !platformSettings || !paymentProvider) {
    return <EmptyState title="Mercado Pago no disponible" description={error ?? "Sin datos"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Mercado Pago"
        description="Configuracion operativa unica para el marketplace. Los comercios solo conectan o desconectan su propia cuenta."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado</p>
          <h2 className="mt-2 text-lg font-bold text-ink">{paymentProvider.enabled ? "Activo" : "Inactivo"}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Modo {paymentProvider.mode === "production" ? "Produccion" : "Sandbox"}.
          </p>
        </div>
        <div className="rounded bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Credenciales</p>
          <h2 className="mt-2 text-lg font-bold text-ink">
            {paymentProvider.client_secret_masked && paymentProvider.public_key_masked && paymentProvider.webhook_configured
              ? "Completas"
              : "Incompletas"}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Public key {paymentProvider.public_key_masked ? "lista" : "pendiente"}, secret {paymentProvider.client_secret_masked ? "listo" : "pendiente"}.
          </p>
        </div>
        <div className="rounded bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Comision</p>
          <h2 className="mt-2 text-lg font-bold text-ink">
            {paymentProvider.commission_mode === "percentage"
              ? `${paymentProvider.commission_value ?? 0}%`
              : formatCurrency(paymentProvider.commission_value ?? platformSettings.service_fee_amount)}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">Se envia como application_fee en cada pago.</p>
        </div>
      </section>

      <form onSubmit={(event) => void handleMercadoPagoProviderSave(event)} className="rounded bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Marketplace</p>
            <h3 className="mt-2 text-lg font-bold text-ink">Credenciales de la app Mercado Pago</h3>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Guarda aqui los datos de la cuenta marketplace. Esta pantalla reemplaza la configuracion manual de credenciales en archivos de entorno.
            </p>
          </div>
          <div className="rounded bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <p className="font-semibold text-ink">{paymentProvider.enabled ? "Provider activo" : "Provider inactivo"}</p>
            <p className="mt-1">Public key: {paymentProvider.public_key_masked ? "Si" : "No"}</p>
            <p className="mt-1">Secret: {paymentProvider.client_secret_masked ? "Si" : "No"}</p>
            <p className="mt-1">Webhook secret: {paymentProvider.webhook_configured ? "Si" : "No"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Client ID
            <input
              value={mercadoPagoForm.client_id}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, client_id: event.target.value }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder="Ej: 7906728616621997"
              aria-invalid={Boolean(providerFieldErrors.client_id)}
            />
            <p className="text-xs font-normal text-zinc-500">
              Debe ser el Client ID/Application ID de OAuth, no Public Key ni Access Token.
            </p>
            {providerFieldErrors.client_id ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.client_id}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Public Key del integrador
            <input
              value={mercadoPagoForm.public_key}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, public_key: event.target.value }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder="APP_USR-... o TEST-..."
              aria-invalid={Boolean(providerFieldErrors.public_key)}
            />
            <p className="text-xs font-normal text-zinc-500">
              Inicializa Card Payment Brick. El cobro se crea en backend con el token OAuth del comercio.
            </p>
            {paymentProvider.public_key_masked ? (
              <p className="text-xs font-normal text-zinc-500">Valor actual enmascarado: {paymentProvider.public_key_masked}</p>
            ) : null}
            {providerFieldErrors.public_key ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.public_key}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            <span className="flex items-center justify-between gap-3">
              Client Secret
              <button
                type="button"
                onClick={() => setShowClientSecret((current) => !current)}
                className="text-xs font-semibold text-brand-700"
                aria-label={showClientSecret ? "Ocultar Client Secret" : "Mostrar Client Secret"}
                aria-pressed={showClientSecret}
              >
                {showClientSecret ? "Ocultar" : "Mostrar"}
              </button>
            </span>
            <input
              type={showClientSecret ? "text" : "password"}
              value={mercadoPagoForm.client_secret}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, client_secret: event.target.value }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.client_secret_masked ? "Dejar vacio para conservar el actual" : "Ingresa el secret"}
              aria-invalid={Boolean(providerFieldErrors.client_secret)}
            />
            {paymentProvider.client_secret_masked ? (
              <p className="text-xs font-normal text-zinc-500">Valor actual enmascarado: {paymentProvider.client_secret_masked}</p>
            ) : null}
            {providerFieldErrors.client_secret ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.client_secret}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            <span className="flex items-center justify-between gap-3">
              Webhook Secret
              <button
                type="button"
                onClick={() => setShowWebhookSecret((current) => !current)}
                className="text-xs font-semibold text-brand-700"
                aria-label={showWebhookSecret ? "Ocultar Webhook Secret" : "Mostrar Webhook Secret"}
                aria-pressed={showWebhookSecret}
              >
                {showWebhookSecret ? "Ocultar" : "Mostrar"}
              </button>
            </span>
            <input
              type={showWebhookSecret ? "text" : "password"}
              value={mercadoPagoForm.webhook_secret}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, webhook_secret: event.target.value }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.webhook_secret_masked ? "Dejar vacio para conservar el actual" : "Secret de Webhooks"}
              aria-invalid={Boolean(providerFieldErrors.webhook_secret)}
            />
            {paymentProvider.webhook_secret_masked ? (
              <p className="text-xs font-normal text-zinc-500">Valor actual enmascarado: {paymentProvider.webhook_secret_masked}</p>
            ) : null}
            {providerFieldErrors.webhook_secret ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.webhook_secret}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600 md:col-span-2">
            Redirect URI
            <input
              value={mercadoPagoForm.redirect_uri}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, redirect_uri: event.target.value }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.oauth_callback_url ?? "https://.../api/v1/oauth/mercadopago/callback"}
              aria-invalid={Boolean(providerFieldErrors.redirect_uri)}
            />
            {paymentProvider.oauth_callback_url ? (
              <p className="text-xs font-normal text-zinc-500">
                Callback OAuth detectado: <span className="break-all font-mono">{paymentProvider.oauth_callback_url}</span>
              </p>
            ) : null}
            {paymentProvider.redirect_uri_internal && paymentProvider.oauth_callback_url && !paymentProvider.oauth_callback_url.includes("localhost") ? (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs font-normal text-amber-800" role="alert">
                El Redirect URI actual usa localhost. Para conectar comercios desde una URL publica, guarda el callback detectado aqui y registralo igual en la app de Mercado Pago.
              </p>
            ) : null}
            {!paymentProvider.simulated && isPublicHttpUrl(mercadoPagoForm.redirect_uri) ? (
              <p className="rounded bg-rose-50 px-3 py-2 text-xs font-normal text-rose-800" role="alert">
                Mercado Pago no acepta callbacks OAuth publicos con HTTP. Configura un dominio con HTTPS y registra exactamente esa URL en la app.
              </p>
            ) : null}
            {providerFieldErrors.redirect_uri ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.redirect_uri}</p> : null}
          </label>
          <div className="space-y-2 rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:col-span-2">
            <p className="font-semibold text-zinc-700">Webhook URL</p>
            <p className="break-all font-mono text-xs text-zinc-600">{paymentProvider.webhook_url ?? "Configura BACKEND_BASE_URL para calcularla."}</p>
            <p className="text-xs">Usa esta URL en la app de Mercado Pago para validar notificaciones con x-signature.</p>
          </div>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Modo
            <select
              value={mercadoPagoForm.mode}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, mode: event.target.value as "sandbox" | "production" }))}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Produccion</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input
              type="checkbox"
              checked={mercadoPagoForm.enabled}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Activar Mercado Pago
          </label>
        </div>

        <div className="mt-4 grid gap-3 rounded border border-black/10 bg-zinc-50 px-4 py-3 md:grid-cols-[220px_1fr]">
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Modo de comision
            <select
              value={mercadoPagoForm.commission_mode}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, commission_mode: event.target.value as "percentage" | "fixed" }))}
              className="w-full rounded border border-black/10 bg-white px-4 py-3"
            >
              <option value="fixed">Monto fijo</option>
              <option value="percentage">Porcentaje</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Valor de comision
            <input
              type="number"
              min="0"
              max={mercadoPagoForm.commission_mode === "percentage" ? "100" : undefined}
              step="0.01"
              value={mercadoPagoForm.commission_value}
              onChange={(event) => setMercadoPagoForm((current) => ({ ...current, commission_value: event.target.value }))}
              className="w-full rounded border border-black/10 bg-white px-4 py-3"
              aria-invalid={Boolean(providerFieldErrors.commission_value)}
            />
            {providerFieldErrors.commission_value ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.commission_value}</p> : null}
          </label>
          <div className="rounded bg-white px-4 py-3 text-sm text-zinc-600 md:col-span-2">
            <p className="font-semibold text-ink">Preview con pedido de {formatCurrency(commissionPreview.gross)}</p>
            <p className="mt-1">
              Comercio recibe {formatCurrency(commissionPreview.net)} y marketplace retiene {formatCurrency(commissionPreview.fee)}.
            </p>
          </div>
        </div>

        {providerError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{providerError}</p> : null}
        {providerMessage ? <p className="mt-4 rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{providerMessage}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={providerSaving}>
            {providerSaving ? "Guardando..." : "Guardar Mercado Pago"}
          </Button>
        </div>
      </form>
    </div>
  );
}
