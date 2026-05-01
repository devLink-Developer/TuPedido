import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession, useRealtimeNotifications } from "../../../shared/hooks";
import {
  confirmDeliverySettlementPayment,
  disputeDeliverySettlementPayment,
  fetchDeliverySettlementPayments,
  fetchDeliverySettlements
} from "../../../shared/services/api";
import type { DeliverySettlement, DeliverySettlementPayment } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { EarningsSummary } from "../components/EarningsSummary";

export function EarningsPage() {
  const { token } = useAuthSession();
  const { notifications } = useRealtimeNotifications(token);
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [payments, setPayments] = useState<DeliverySettlementPayment[]>([]);
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyPaymentId, setBusyPaymentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [settlementResult, paymentResults] = await Promise.all([
        fetchDeliverySettlements(token),
        fetchDeliverySettlementPayments(token)
      ]);
      setSettlement(settlementResult);
      setPayments(paymentResults);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la liquidacion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleConfirm(paymentId: number) {
    if (!token) return;
    setBusyPaymentId(paymentId);
    try {
      await confirmDeliverySettlementPayment(token, paymentId, {
        notes: draftNotes[paymentId] ?? null
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo confirmar el pago");
    } finally {
      setBusyPaymentId(null);
    }
  }

  async function handleDispute(paymentId: number) {
    if (!token) return;
    setBusyPaymentId(paymentId);
    try {
      await disputeDeliverySettlementPayment(token, paymentId, {
        notes: draftNotes[paymentId] ?? null
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo observar el pago");
    } finally {
      setBusyPaymentId(null);
    }
  }

  if (loading) return <LoadingCard />;
  if (error || !settlement) return <EmptyState title="Ganancias no disponibles" description={error ?? "Sin liquidacion"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rider"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Ganancias</span>
            <HelpTooltip label="Ayuda sobre ganancias" variant="inverse">
              Revisa tus pagos y confirma si ya recibiste cada liquidacion.
            </HelpTooltip>
          </span>
        }
      />

      <EarningsSummary settlement={settlement} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pagos registrados</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{payments.length}</h3>
        </div>
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pendiente de confirmar</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            {payments.filter((payment) => payment.receiver_status === "pending_confirmation").length}
          </h3>
        </div>
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Notificaciones</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{notifications.length}</h3>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Historial</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">Pagos recibidos</h2>
            <HelpTooltip label="Ayuda sobre pagos recibidos">
              Confirma o reporta cualquier problema con los pagos que te registren.
            </HelpTooltip>
          </div>
        </div>
        {payments.length ? (
          <div className="space-y-4">
            {payments.map((payment) => (
              <article key={payment.id} className="rounded bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{payment.store_name ?? "Comercio"}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatCurrency(payment.amount)} | {formatDateTime(payment.paid_at)}
                    </p>
                  </div>
                  <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {statusLabels[payment.receiver_status] ?? payment.receiver_status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                  <p>Referencia: {payment.reference ?? "Sin referencia"}</p>
                  <p>Registrado: {formatDateTime(payment.created_at)}</p>
                </div>
                {payment.notes ? <p className="mt-3 text-sm text-zinc-600">Nota del emisor: {payment.notes}</p> : null}
                {payment.receiver_response_notes ? (
                  <p className="mt-2 text-sm text-zinc-600">Tu respuesta: {payment.receiver_response_notes}</p>
                ) : null}
                <textarea
                  value={draftNotes[payment.id] ?? payment.receiver_response_notes ?? ""}
                  onChange={(event) => setDraftNotes((current) => ({ ...current, [payment.id]: event.target.value }))}
                  rows={2}
                  placeholder="Agrega una nota para confirmar o disputar este pago"
                  className="mt-4 w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busyPaymentId === payment.id}
                    onClick={() => void handleConfirm(payment.id)}
                    className="bg-emerald-600 shadow-none"
                  >
                    {busyPaymentId === payment.id ? "Guardando..." : "Confirmar recepcion"}
                  </Button>
                  <Button
                    type="button"
                    disabled={busyPaymentId === payment.id}
                    onClick={() => void handleDispute(payment.id)}
                    className="bg-rose-600 shadow-none"
                  >
                    {busyPaymentId === payment.id ? "Guardando..." : "Disputar pago"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin pagos registrados" description="Las liquidaciones recibidas apareceran aqui." />
        )}
      </section>
    </div>
  );
}
