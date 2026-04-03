import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession, useRealtimeNotifications } from "../../../shared/hooks";
import {
  fetchAdminDeliverySettlementPayments,
  fetchAdminDeliverySettlements,
  fetchAdminSettlementHistory,
  fetchAdminSettlementNotices,
  fetchAdminSettlementPayments,
  fetchAdminSettlementStores,
  reviewAdminSettlementNotice
} from "../../../shared/services/api";
import type {
  AdminSettlementStore,
  DeliverySettlement,
  RiderSettlementPayment,
  SettlementHistoryEntry,
  SettlementNotice,
  SettlementPayment
} from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
      {statusLabels[value] ?? value}
    </span>
  );
}

function SectionTitle({ title, help }: { title: string; help: string }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <HelpTooltip label={`Ayuda sobre ${title}`}>{help}</HelpTooltip>
    </div>
  );
}

export function LiquidationsPage() {
  const { token } = useAuthSession();
  const { notifications } = useRealtimeNotifications(token);
  const [settlementStores, setSettlementStores] = useState<AdminSettlementStore[]>([]);
  const [settlementNotices, setSettlementNotices] = useState<SettlementNotice[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [deliverySettlements, setDeliverySettlements] = useState<DeliverySettlement[]>([]);
  const [deliveryPayments, setDeliveryPayments] = useState<RiderSettlementPayment[]>([]);
  const [history, setHistory] = useState<SettlementHistoryEntry[]>([]);
  const [noticeNotes, setNoticeNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingNoticeId, setReviewingNoticeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [stores, notices, payments, riderSettlements, riderPayments, historyResult] = await Promise.all([
        fetchAdminSettlementStores(token),
        fetchAdminSettlementNotices(token),
        fetchAdminSettlementPayments(token),
        fetchAdminDeliverySettlements(token),
        fetchAdminDeliverySettlementPayments(token),
        fetchAdminSettlementHistory(token)
      ]);
      setSettlementStores(stores);
      setSettlementNotices(notices);
      setSettlementPayments(payments);
      setDeliverySettlements(riderSettlements);
      setDeliveryPayments(riderPayments);
      setHistory(historyResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las liquidaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const riderPendingConfirmations = useMemo(
    () => deliveryPayments.filter((payment) => payment.receiver_status === "pending_confirmation").length,
    [deliveryPayments]
  );
  const totalPlatformPending = useMemo(
    () => settlementStores.reduce((sum, store) => sum + store.pending_balance, 0),
    [settlementStores]
  );

  async function handleReviewNotice(noticeId: number, status: "approved" | "rejected") {
    if (!token) return;
    setReviewingNoticeId(noticeId);
    try {
      await reviewAdminSettlementNotice(token, noticeId, {
        status,
        review_notes: noticeNotes[noticeId] ?? null
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo revisar el aviso");
    } finally {
      setReviewingNoticeId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando liquidaciones..." />;
  if (error) return <EmptyState title="Liquidaciones no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Liquidaciones</span>
            <HelpTooltip label="Ayuda sobre liquidaciones" variant="inverse">
              Revisa comprobantes, movimientos recientes y el historial de liquidaciones.
            </HelpTooltip>
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Saldo pendiente" value={formatCurrency(totalPlatformPending)} description="Pendiente por revisar." />
        <StatCard label="Avisos pendientes" value={String(settlementNotices.filter((notice) => notice.status === "pending_review").length)} description="Comprobantes por revisar." />
        <StatCard label="Riders por confirmar" value={String(riderPendingConfirmations)} description="Pagos esperando respuesta." />
        <StatCard label="Notificaciones" value={String(notifications.length)} description="Alertas recientes." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <SectionTitle
              title="Avisos con comprobante"
              help="Verifica el comprobante enviado por el comercio antes de aprobar o rechazar la liquidacion."
            />
            <div className="mt-4 space-y-3">
              {settlementNotices.map((notice) => (
                <div key={notice.id} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{notice.store_name ?? "Comercio"}</p>
                      <p className="mt-1 text-zinc-500">
                        {formatCurrency(notice.amount)} | {notice.bank} | {notice.reference}
                      </p>
                    </div>
                    <StatusBadge value={notice.status} />
                  </div>
                  <p className="mt-2 text-zinc-500">Enviado {formatDateTime(notice.created_at)}</p>
                  {notice.proof_url ? (
                    <div className="mt-3">
                      {notice.proof_content_type?.startsWith("image/") ? (
                        <img src={notice.proof_url} alt="Comprobante" className="max-h-48 rounded-2xl object-contain" />
                      ) : (
                        <a href={notice.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600">
                          Ver comprobante PDF
                        </a>
                      )}
                    </div>
                  ) : null}
                  <textarea
                    value={noticeNotes[notice.id] ?? notice.reviewed_notes ?? ""}
                    onChange={(event) => setNoticeNotes((current) => ({ ...current, [notice.id]: event.target.value }))}
                    rows={2}
                    className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="Notas de revision"
                    disabled={reviewingNoticeId === notice.id || notice.status !== "pending_review"}
                  />
                  {notice.status === "pending_review" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={reviewingNoticeId === notice.id}
                        onClick={() => void handleReviewNotice(notice.id, "approved")}
                        className="bg-emerald-600 px-4 py-2 text-xs"
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewingNoticeId === notice.id}
                        onClick={() => void handleReviewNotice(notice.id, "rejected")}
                        className="bg-rose-600 px-4 py-2 text-xs"
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!settlementNotices.length ? <EmptyState title="Sin avisos" description="Todavia no hay comprobantes cargados." /> : null}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <SectionTitle
              title="Comercios y riders pendientes"
              help="Muestra comercios con saldo pendiente y riders con pagos todavia sin confirmar."
            />
            <div className="mt-4 space-y-3">
              {settlementStores.map((store) => (
                <div key={store.id} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{store.store_name}</strong>
                    <span>{formatCurrency(store.pending_balance)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    {store.owner_name} | {store.pending_charges_count} cargos | {store.pending_notices_count} avisos
                  </p>
                </div>
              ))}
              {deliverySettlements.map((settlement) => (
                <div key={settlement.rider_user_id} className="rounded-[22px] border border-black/5 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{settlement.rider_name}</strong>
                    <span>{formatCurrency(settlement.pending_amount)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Ganado {formatCurrency(settlement.rider_fee_earned_total)} | Reportado pagado {formatCurrency(settlement.rider_fee_paid_total)}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <SectionTitle
              title="Movimientos recientes"
              help="Muestra los ultimos pagos y reportes informados por los comercios."
            />
            <div className="mt-4 space-y-3">
              {settlementPayments.slice(0, 4).map((payment) => (
                <div key={`platform-${payment.id}`} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{payment.store_name ?? "Comercio"}</strong>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Plataforma | {formatDateTime(payment.paid_at)} {payment.reference ? `| Ref: ${payment.reference}` : ""}
                  </p>
                </div>
              ))}
              {deliveryPayments.slice(0, 4).map((payment) => (
                <div key={`rider-${payment.id}`} className="rounded-[22px] border border-black/5 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{payment.rider_name ?? "Rider"}</strong>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Pago a rider | {formatDateTime(payment.paid_at)} | {statusLabels[payment.receiver_status] ?? payment.receiver_status}
                  </p>
                </div>
              ))}
              {!settlementPayments.length && !deliveryPayments.length ? (
                <EmptyState title="Sin pagos reportados" description="Los movimientos confirmados o reportados apareceran aqui." />
              ) : null}
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <SectionTitle
              title="Notificaciones"
              help="Eventos recientes relacionados con revisiones, pagos reportados y confirmaciones."
            />
            <div className="mt-4 space-y-3">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
                  <p className="font-semibold text-ink">{notification.title}</p>
                  <p className="mt-2 text-zinc-600">{notification.body}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>
              ))}
              {!notifications.length ? <p className="text-sm text-zinc-500">Sin notificaciones recientes.</p> : null}
            </div>
          </article>
        </section>
      </div>

      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Historial</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">Historial</h2>
              <HelpTooltip label="Ayuda sobre historial">
                Consulta el registro de revisiones, movimientos y confirmaciones.
              </HelpTooltip>
            </div>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {history.length} eventos
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {history.map((entry) => (
            <article key={entry.id} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{entry.title}</p>
                  <p className="mt-1 text-zinc-500">
                    {entry.store_name ?? entry.rider_name ?? "Sistema"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={entry.status} />
                  <strong>{formatCurrency(entry.amount)}</strong>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-zinc-500">
                <span>Creado {formatDateTime(entry.created_at)}</span>
                {entry.reviewed_at ? <span>Actualizado {formatDateTime(entry.reviewed_at)}</span> : null}
                {entry.reference ? <span>Ref: {entry.reference}</span> : null}
              </div>
              {entry.notes ? <p className="mt-2 text-zinc-600">{entry.notes}</p> : null}
            </article>
          ))}
          {!history.length ? <EmptyState title="Sin historial" description="Los eventos de liquidacion apareceran aqui." /> : null}
        </div>
      </section>
    </div>
  );
}
