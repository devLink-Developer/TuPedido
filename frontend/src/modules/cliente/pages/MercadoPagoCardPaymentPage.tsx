import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { createMercadoPagoCardPayment, fetchMercadoPagoPaymentSession } from "../../../shared/services/api";
import type { MercadoPagoPaymentSession } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";
import { Button } from "../../../shared/ui/Button";

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: Record<string, unknown>) => Promise<{ unmount?: () => void }>;
      };
    };
  }
}

const MERCADOPAGO_SDK_URL = "https://sdk.mercadopago.com/js/v2";

function loadMercadoPagoSdk(): Promise<void> {
  if (window.MercadoPago) {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${MERCADOPAGO_SDK_URL}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Mercado Pago")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MERCADOPAGO_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago"));
    document.head.appendChild(script);
  });
}

function readCardFormValue(data: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return data[snakeKey] ?? data[camelKey];
}

function isApprovedPaymentStatus(status: string | null | undefined) {
  return ["approved", "paid"].includes((status ?? "").toLowerCase());
}

export function MercadoPagoCardPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get("session") ?? "";
  const [session, setSession] = useState<MercadoPagoPaymentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [brickReady, setBrickReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brickController = useRef<{ unmount?: () => void } | null>(null);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      setError("La sesion de pago no es valida.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMercadoPagoPaymentSession(sessionToken)
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        setError(null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo abrir el pago");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!session || session.simulated || !sessionToken) {
      return;
    }
    let cancelled = false;
    setBrickReady(false);
    setError(null);

    async function mountBrick() {
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago || !session) return;
        const mp = new window.MercadoPago(session.public_key, { locale: "es-AR" });
        const bricksBuilder = mp.bricks();
        brickController.current = await bricksBuilder.create("cardPayment", "mp-card-payment-brick", {
          initialization: {
            amount: session.amount
          },
          customization: {
            visual: {
              style: {
                theme: "default"
              }
            }
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setBrickReady(true);
            },
            onSubmit: async (cardFormData: Record<string, unknown>) => {
              const payer = (cardFormData.payer as { email?: string; identification?: { type?: string; number?: string } }) ?? {};
              const result = await createMercadoPagoCardPayment({
                session_token: sessionToken,
                token: String(readCardFormValue(cardFormData, "token", "token") ?? ""),
                issuer_id: readCardFormValue(cardFormData, "issuer_id", "issuerId") as string | number | null,
                payment_method_id: String(readCardFormValue(cardFormData, "payment_method_id", "paymentMethodId") ?? ""),
                transaction_amount: session.amount,
                installments: Number(readCardFormValue(cardFormData, "installments", "installments") ?? 1),
                payer: {
                  email: payer.email ?? "",
                  identification: payer.identification ?? null
                }
              });
              if (isApprovedPaymentStatus(result.status)) {
                navigate(`/c/pedido/${result.order_id}?payment_result=${encodeURIComponent(result.status)}`, { replace: true });
              } else {
                setError("Pago no aprobado.");
              }
            },
            onError: (brickError: unknown) => {
              setError(brickError instanceof Error ? brickError.message : "Mercado Pago no pudo preparar el formulario.");
            }
          }
        });
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Pago");
        }
      }
    }

    void mountBrick();
    return () => {
      cancelled = true;
      brickController.current?.unmount?.();
      brickController.current = null;
    };
  }, [navigate, session, sessionToken]);

  async function handleSimulatedPayment() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createMercadoPagoCardPayment({
        session_token: session.session_token,
        token: "SIMULATED-CARD-TOKEN",
        payment_method_id: "simulated",
        transaction_amount: session.amount,
        installments: 1,
        payer: { email: "cliente@simulado.local" }
      });
      if (isApprovedPaymentStatus(result.status)) {
        navigate(`/c/pedido/${result.order_id}?payment_result=${encodeURIComponent(result.status)}`, { replace: true });
      } else {
        setError("Pago no aprobado.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo confirmar el pago");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingCard />;
  }
  if (error && !session) {
    return <EmptyState title="Pago no disponible" description={error} />;
  }
  if (!session) {
    return <EmptyState title="Pago no disponible" description="Faltan datos de la sesion." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow="Mercado Pago" title={`Pedido #${session.order_id}`} description={session.store_name} />

      <section className="app-panel p-5">
        <div className="rounded border border-black/10 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Total</p>
          <p className="mt-2 text-xl font-bold text-ink">{formatCurrency(session.amount)}</p>
        </div>
      </section>

      <section className="app-panel p-5">
        {session.simulated ? (
          <div className="space-y-4">
            <Button type="button" disabled={submitting} onClick={() => void handleSimulatedPayment()}>
              {submitting ? "Confirmando..." : "Aprobar pago de prueba"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!brickReady ? <p className="text-sm text-zinc-500">Cargando formulario seguro...</p> : null}
            <div id="mp-card-payment-brick" className="min-h-[520px]" />
          </div>
        )}
        {error ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
