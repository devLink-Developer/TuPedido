import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState, LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  disconnectMerchantMercadoPago,
  fetchMerchantMercadoPagoConnectUrl,
  fetchMerchantStore,
  updateMerchantPaymentSettings
} from "../../../shared/services/api";
import type { MerchantStore } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { deriveMercadoPagoState } from "../../../shared/utils/mercadopago";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const connectionMessages: Record<string, string> = {
  connected: "La cuenta esta vinculada y lista para cobrar directo en el comercio.",
  onboarding_pending: "La cuenta esta vinculada, pero falta completar el onboarding de Mercado Pago.",
  reconnect_required: "La vinculacion necesita renovarse para seguir cobrando online.",
  disconnected: "Conecta la cuenta Mercado Pago propia del comercio para aceptar pagos online."
};

const connectionLabels: Record<string, string> = {
  connected: "Conectado",
  onboarding_pending: "Onboarding pendiente",
  reconnect_required: "Reconectar",
  disconnected: "No conectado"
};

function statusClass(status: string) {
  if (status === "connected") return "bg-emerald-100 text-emerald-800";
  if (status === "reconnect_required") return "bg-amber-100 text-amber-900";
  if (status === "onboarding_pending") return "bg-sky-100 text-sky-800";
  return "bg-zinc-200 text-zinc-700";
}

export function MercadoPagoPage() {
  const { token } = useAuthSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthResult, setOauthResult] = useState<{ status: string; detail: string | null } | null>(null);

  const mercadoPagoState = useMemo(() => (store ? deriveMercadoPagoState(store.payment_settings) : null), [store]);
  const connectionStatus = mercadoPagoState?.status ?? "disconnected";
  const providerEnabled = store?.payment_settings.mercadopago_provider_enabled ?? false;
  const providerMode = store?.payment_settings.mercadopago_provider_mode ?? "sandbox";
  const modeLabel = providerMode === "production" ? "Produccion" : "Sandbox";
  const hasAccount = connectionStatus !== "disconnected";
  const canOperate = Boolean(mercadoPagoState?.canOperate);
  const mpUserId = store?.payment_settings.mercadopago_mp_user_id ?? null;
  const onboardingDone = Boolean(store?.payment_settings.mercadopago_onboarding_completed);
  const oauthBanner = useMemo(() => {
    if (oauthResult?.status === "connected") {
      return {
        className: "rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950",
        message: "La cuenta de Mercado Pago quedo conectada correctamente."
      };
    }
    if (oauthResult?.status === "error") {
      return {
        className: "rounded border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900",
        message: oauthResult.detail || "No se pudo completar la conexion con Mercado Pago."
      };
    }
    return null;
  }, [oauthResult]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setStore(await fetchMerchantStore(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Pago");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    const status = searchParams.get("mercadopago_oauth");
    if (!status) return;

    setOauthResult({
      status,
      detail: searchParams.get("detail")
    });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mercadopago_oauth");
    nextParams.delete("detail");
    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash
      },
      { replace: true }
    );
  }, [location.hash, location.pathname, navigate, searchParams]);

  useMerchantStoreStatusSync({ paused: saving || action !== null, store, setStore });

  async function handleConnect() {
    if (!token) return;
    setAction("connect");
    setError(null);
    try {
      const response = await fetchMerchantMercadoPagoConnectUrl(token);
      window.location.assign(response.connect_url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo iniciar la conexion con Mercado Pago");
      setAction(null);
    }
  }

  async function handleDisconnect() {
    if (!token) return;
    if (!window.confirm("Desconectar Mercado Pago deshabilitara los cobros online hasta volver a conectar la cuenta. Continuar?")) {
      return;
    }
    setAction("disconnect");
    setError(null);
    try {
      await disconnectMerchantMercadoPago(token);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo desconectar la cuenta de Mercado Pago");
    } finally {
      setAction(null);
    }
  }

  async function handleSavePaymentMethod() {
    if (!token || !store) return;
    setSaving(true);
    setError(null);
    try {
      if (store.payment_settings.mercadopago_enabled && !canOperate) {
        setError("Conecta una cuenta activa antes de habilitar Mercado Pago para clientes.");
        return;
      }
      if (!store.payment_settings.cash_enabled && !store.payment_settings.mercadopago_enabled) {
        setError("No puede quedar el comercio sin medios de cobro. Activa efectivo en Configuracion o Mercado Pago aqui.");
        return;
      }
      const result = await updateMerchantPaymentSettings(token, {
        cash_enabled: store.payment_settings.cash_enabled,
        mercadopago_enabled: store.payment_settings.mercadopago_enabled
      });
      setStore(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el medio de cobro");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard label="Cargando Mercado Pago..." />;
  if (!store) return <EmptyState title="Mercado Pago no disponible" description={error ?? "Faltan datos del comercio"} />;

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Finanzas"
        title="Mercado Pago"
        description="Conecta la cuenta propia del comercio y habilita el cobro online con split automatico de marketplace."
        stats={[
          {
            label: "Conexion",
            value: connectionLabels[connectionStatus] ?? connectionLabels.disconnected,
            tone: canOperate ? "success" : connectionStatus === "reconnect_required" ? "warning" : "neutral"
          },
          { label: "Operacion", value: canOperate ? "Listo" : "No operativo", tone: canOperate ? "success" : "warning" },
          { label: "Modo", value: modeLabel }
        ]}
      />

      {oauthBanner ? <p className={oauthBanner.className}>{oauthBanner.message}</p> : null}
      {error ? <p className="rounded border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">{error}</p> : null}

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
      <section className="rounded bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cuenta del comercio</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-ink">Conexion OAuth</h2>
                <span className={`rounded px-2.5 py-1 text-xs font-semibold ${statusClass(connectionStatus)}`}>
                  {connectionLabels[connectionStatus] ?? connectionLabels.disconnected}
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm text-zinc-600">
                {providerEnabled
                  ? connectionMessages[connectionStatus] ?? connectionMessages.disconnected
                  : "Mercado Pago esta desactivado por la plataforma."}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
              <p className="rounded bg-zinc-50 px-4 py-3">
                MP user id: <span className="font-semibold text-ink">{mpUserId ?? "Sin cuenta conectada"}</span>
              </p>
              <p className="rounded bg-zinc-50 px-4 py-3">
                Onboarding: <span className="font-semibold text-ink">{onboardingDone ? "Completo" : "Pendiente"}</span>
              </p>
              <p className="rounded bg-zinc-50 px-4 py-3">
                Estado tecnico:{" "}
                <span className="font-semibold text-ink">{store.payment_settings.mercadopago_account_status ?? connectionStatus}</span>
              </p>
              <p className="rounded bg-zinc-50 px-4 py-3">
                Public key:{" "}
                <span className="font-semibold text-ink">{store.payment_settings.mercadopago_public_key_masked ?? "No disponible"}</span>
              </p>
            </div>
            {store.payment_settings.mercadopago_last_error ? (
              <p className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                Ultimo error: {store.payment_settings.mercadopago_last_error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" onClick={() => void handleConnect()} disabled={!providerEnabled || action !== null} className="shadow-none">
              {action === "connect"
                ? "Conectando..."
                : connectionStatus === "reconnect_required"
                  ? "Reconectar Mercado Pago"
                  : hasAccount
                    ? "Cambiar cuenta"
                    : "Conectar con Mercado Pago"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={!hasAccount || action !== null}
              className="bg-rose-700 shadow-none hover:bg-rose-800"
            >
              {action === "disconnect" ? "Desconectando..." : "Desconectar"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Clientes</p>
            <h2 className="mt-1.5 text-lg font-bold text-ink">Cobro online</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-zinc-600">
              Esta opcion muestra Mercado Pago en el checkout del cliente cuando la cuenta esta operativa. Efectivo se administra en Configuracion.
            </p>
          </div>
          <Button type="button" onClick={() => void handleSavePaymentMethod()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Mercado Pago"}
          </Button>
        </div>

        <div className="mt-3 grid gap-2">
          <label
            className={`flex items-center gap-3 rounded border border-black/5 bg-zinc-50 px-4 py-4 text-sm font-semibold ${
              canOperate ? "text-zinc-700" : "cursor-not-allowed text-zinc-400"
            }`}
          >
            <input
              type="checkbox"
              checked={store.payment_settings.mercadopago_enabled}
              disabled={!canOperate}
              onChange={(event) =>
                setStore((current) =>
                  current
                    ? {
                        ...current,
                        payment_settings: {
                          ...current.payment_settings,
                          mercadopago_enabled: event.target.checked
                        }
                      }
                    : current
                )
              }
            />
            Mercado Pago visible para clientes
          </label>
          <div className="rounded border border-black/5 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
            Efectivo actual:{" "}
            <span className="font-semibold text-ink">{store.payment_settings.cash_enabled ? "Activo" : "Inactivo"}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/m/pedidos")}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Ver pagos en pedidos
          </button>
          <button
            type="button"
            onClick={() => navigate("/m/liquidaciones")}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Ver comisiones y liquidaciones
          </button>
          <button
            type="button"
            onClick={() => navigate("/m/configuracion")}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Configurar efectivo
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
