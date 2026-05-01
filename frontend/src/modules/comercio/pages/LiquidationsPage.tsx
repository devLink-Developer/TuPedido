import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession, useRealtimeNotifications } from "../../../shared/hooks";
import {
  createMerchantRiderSettlementPayment,
  createMerchantSettlementNotice,
  fetchMerchantRiderSettlementPayments,
  fetchMerchantRiderSettlements,
  fetchMerchantSettlementCharges,
  fetchMerchantSettlementHistory,
  fetchMerchantSettlementNotices,
  fetchMerchantSettlementOverview,
  fetchMerchantStore,
  uploadProofAsset
} from "../../../shared/services/api";
import type {
  DeliverySettlement,
  RiderSettlementPayment,
  SettlementCharge,
  SettlementHistoryEntry,
  SettlementNotice,
  SettlementOverview
} from "../../../shared/types";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

type NoticeFormState = {
  amount: number;
  transfer_date: string;
  bank: string;
  reference: string;
  notes: string;
  proof_url: string;
  proof_content_type: string;
  proof_original_name: string;
};

type RiderPaymentDraft = {
  amount: string;
  paid_at: string;
  reference: string;
  notes: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function nowLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function buildNoticeForm(amount = 0): NoticeFormState {
  return {
    amount,
    transfer_date: todayInputValue(),
    bank: "",
    reference: "",
    notes: "",
    proof_url: "",
    proof_content_type: "",
    proof_original_name: ""
  };
}

function isImageProof(notice: Pick<SettlementNotice, "proof_content_type"> | { proof_content_type?: string | null }) {
  return Boolean(notice.proof_content_type?.startsWith("image/"));
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
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
  const [storeName, setStoreName] = useState("Comercio");
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [charges, setCharges] = useState<SettlementCharge[]>([]);
  const [notices, setNotices] = useState<SettlementNotice[]>([]);
  const [riderSettlements, setRiderSettlements] = useState<DeliverySettlement[]>([]);
  const [riderPayments, setRiderPayments] = useState<RiderSettlementPayment[]>([]);
  const [history, setHistory] = useState<SettlementHistoryEntry[]>([]);
  const [noticeForm, setNoticeForm] = useState<NoticeFormState>(() => buildNoticeForm());
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, RiderPaymentDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [store, overviewResult, chargeResults, noticeResults, settlementResults, paymentResults, historyResults] =
        await Promise.all([
          fetchMerchantStore(token),
          fetchMerchantSettlementOverview(token),
          fetchMerchantSettlementCharges(token),
          fetchMerchantSettlementNotices(token),
          fetchMerchantRiderSettlements(token),
          fetchMerchantRiderSettlementPayments(token),
          fetchMerchantSettlementHistory(token)
        ]);
      setStoreName(store.name);
      setOverview(overviewResult);
      setCharges(chargeResults);
      setNotices(noticeResults);
      setRiderSettlements(settlementResults);
      setRiderPayments(paymentResults);
      setHistory(historyResults);
      setNoticeForm((current) => ({
        ...current,
        amount: Number(overviewResult.pending_balance.toFixed(2))
      }));
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

  useEffect(() => {
    setPaymentDrafts((current) => {
      const next = { ...current };
      for (const settlement of riderSettlements) {
        if (!next[settlement.rider_user_id]) {
          next[settlement.rider_user_id] = {
            amount: settlement.pending_amount > 0 ? settlement.pending_amount.toFixed(2) : "",
            paid_at: nowLocalDateTime(),
            reference: "",
            notes: ""
          };
        }
      }
      return next;
    });
  }, [riderSettlements]);

  const pendingNotice = useMemo(
    () => notices.find((notice) => notice.status === "pending_review") ?? null,
    [notices]
  );
  const ridersPendingTotal = useMemo(
    () => riderSettlements.reduce((sum, settlement) => sum + settlement.pending_amount, 0),
    [riderSettlements]
  );
  const paymentsByRider = useMemo(() => {
    const map = new Map<number, RiderSettlementPayment[]>();
    for (const payment of riderPayments) {
      const current = map.get(payment.rider_user_id) ?? [];
      current.push(payment);
      map.set(payment.rider_user_id, current);
    }
    return map;
  }, [riderPayments]);
  const noticeFormDisabled =
    savingNotice || uploadingProof || Boolean(pendingNotice) || (overview?.pending_balance ?? 0) <= 0;

  async function handleProofUpload(file: File | null) {
    if (!token || !file) return;
    setUploadingProof(true);
    setNoticeError(null);
    try {
      const uploaded = await uploadProofAsset(token, file);
      setNoticeForm((current) => ({
        ...current,
        proof_url: uploaded.url,
        proof_content_type: uploaded.content_type,
        proof_original_name: uploaded.original_name
      }));
    } catch (requestError) {
      setNoticeError(requestError instanceof Error ? requestError.message : "No se pudo subir el comprobante");
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleNoticeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;
    setSavingNotice(true);
    setNoticeError(null);
    try {
      await createMerchantSettlementNotice(token, {
        amount: Number(overview.pending_balance.toFixed(2)),
        transfer_date: noticeForm.transfer_date,
        bank: noticeForm.bank.trim(),
        reference: noticeForm.reference.trim(),
        notes: noticeForm.notes.trim() || null,
        proof_url: noticeForm.proof_url,
        proof_content_type: noticeForm.proof_content_type,
        proof_original_name: noticeForm.proof_original_name
      });
      setNoticeForm(buildNoticeForm(Number(overview.pending_balance.toFixed(2))));
      await load();
    } catch (requestError) {
      setNoticeError(requestError instanceof Error ? requestError.message : "No se pudo enviar el aviso");
    } finally {
      setSavingNotice(false);
    }
  }

  async function handleRegisterRiderPayment(riderUserId: number) {
    if (!token) return;
    const draft = paymentDrafts[riderUserId];
    if (!draft?.amount || Number(draft.amount) <= 0) {
      return;
    }
    setBusyPaymentId(riderUserId);
    setPaymentError(null);
    try {
      await createMerchantRiderSettlementPayment(token, {
        rider_user_id: riderUserId,
        amount: Number(draft.amount),
        paid_at: new Date(draft.paid_at || nowLocalDateTime()).toISOString(),
        reference: draft.reference.trim() || null,
        notes: draft.notes.trim() || null
      });
      setPaymentDrafts((current) => ({
        ...current,
        [riderUserId]: { amount: "", paid_at: nowLocalDateTime(), reference: "", notes: "" }
      }));
      await load();
    } catch (requestError) {
      setPaymentError(requestError instanceof Error ? requestError.message : "No se pudo registrar el pago");
    } finally {
      setBusyPaymentId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando liquidaciones..." />;
  if (error || !overview) return <EmptyState title="Liquidaciones no disponibles" description={error ?? "Sin datos"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Liquidaciones</span>
            <HelpTooltip label="Ayuda sobre liquidaciones" variant="inverse">
              Informa pagos a la plataforma, registra pagos a repartidores y revisa el historial.
            </HelpTooltip>
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Pendiente plataforma"
          value={formatCurrency(overview.pending_balance)}
          description={`${overview.pending_notices_count} avisos pendientes.`}
        />
        <StatCard
          label="Pagado plataforma"
          value={formatCurrency(overview.paid_balance)}
          description="Pagos ya revisados."
        />
        <StatCard
          label="Pendiente repartidores"
          value={formatCurrency(ridersPendingTotal)}
          description="Saldo por pagar."
        />
        <StatCard
          label="Notificaciones"
          value={String(notifications.length)}
          description="Alertas recientes."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-4">
          <article className="rounded bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Plataforma</p>
                <div className="mt-2 flex items-center gap-2">
                  <SectionTitle
                    title="Avisar transferencia"
                    help="Carga el comprobante del pago enviado a la plataforma."
                  />
                </div>
              </div>
              {pendingNotice ? <StatusBadge value={pendingNotice.status} /> : null}
            </div>

            {pendingNotice ? (
              <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                Ya existe un aviso pendiente por {formatCurrency(pendingNotice.amount)}. Espera revisión antes de enviar
                otro.
              </p>
            ) : null}

            <form onSubmit={(event) => void handleNoticeSubmit(event)} className="mt-4 grid gap-3">
              <input
                type="number"
                value={Number(overview.pending_balance.toFixed(2))}
                readOnly
                className="rounded border border-black/10 bg-zinc-100 px-4 py-3 text-zinc-600"
              />
              <input
                type="date"
                value={noticeForm.transfer_date}
                onChange={(event) => setNoticeForm((current) => ({ ...current, transfer_date: event.target.value }))}
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                disabled={noticeFormDisabled}
              />
              <input
                value={noticeForm.bank}
                onChange={(event) => setNoticeForm((current) => ({ ...current, bank: event.target.value }))}
                placeholder="Banco emisor"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                disabled={noticeFormDisabled}
              />
              <input
                value={noticeForm.reference}
                onChange={(event) => setNoticeForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder="Referencia o número de transferencia"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                disabled={noticeFormDisabled}
              />
              <textarea
                value={noticeForm.notes}
                onChange={(event) => setNoticeForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Notas opcionales"
                rows={3}
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                disabled={noticeFormDisabled}
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                onChange={(event) => void handleProofUpload(event.target.files?.[0] ?? null)}
                className="rounded border border-dashed border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600"
                disabled={noticeFormDisabled}
              />
              {noticeForm.proof_url ? (
                <div className="rounded bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-ink">{noticeForm.proof_original_name}</p>
                  <div className="mt-3">
                    {noticeForm.proof_content_type.startsWith("image/") ? (
                      <img src={noticeForm.proof_url} alt="Comprobante" className="max-h-48 rounded object-contain" />
                    ) : (
                      <a href={noticeForm.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600">
                        Ver comprobante PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : null}
              {noticeError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{noticeError}</p> : null}
              <Button
                type="submit"
                disabled={
                  noticeFormDisabled ||
                  !noticeForm.bank.trim() ||
                  !noticeForm.reference.trim() ||
                  !noticeForm.proof_url
                }
              >
                {savingNotice ? "Enviando..." : "Enviar aviso"}
              </Button>
            </form>
          </article>

          <article className="rounded bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Acciones</p>
                <div className="mt-2 flex items-center gap-2">
                  <SectionTitle title="Cargos y avisos" help="Consulta cargos del comercio y avisos ya enviados." />
                </div>
              </div>
              <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {charges.length} cargos
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {charges.slice(0, 5).map((charge) => (
                <div key={charge.id} className="rounded bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">Pedido #{charge.order_id}</p>
                      <p className="text-zinc-500">{charge.customer_name ?? "Cliente"}</p>
                    </div>
                    <strong>{formatCurrency(charge.service_fee)}</strong>
                  </div>
                  <p className="mt-2 text-zinc-500">
                    {statusLabels[charge.status] ?? charge.status} | {formatDateTime(charge.created_at)}
                  </p>
                </div>
              ))}
              {notices.map((notice) => (
                <div key={notice.id} className="rounded border border-black/5 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{formatCurrency(notice.amount)}</p>
                      <p className="text-zinc-500">
                        {notice.bank} | {notice.reference}
                      </p>
                    </div>
                    <StatusBadge value={notice.status} />
                  </div>
                  <p className="mt-2 text-zinc-500">Enviado {formatDateTime(notice.created_at)}</p>
                  {notice.reviewed_notes ? <p className="mt-2 text-zinc-600">{notice.reviewed_notes}</p> : null}
                  {notice.proof_url ? (
                    <div className="mt-3">
                      {isImageProof(notice) ? (
                        <img src={notice.proof_url} alt="Comprobante enviado" className="max-h-40 rounded object-contain" />
                      ) : (
                        <a href={notice.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600">
                          Ver comprobante adjunto
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {!charges.length && !notices.length ? (
                <EmptyState title="Sin movimientos de plataforma" description="Los cargos y avisos aparecerán aquí." />
              ) : null}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Repartidores</p>
                <div className="mt-2 flex items-center gap-2">
                  <SectionTitle
                    title="Pagos a repartidores"
                    help="Registra el pago hecho al repartidor y revisa si ya lo confirmó."
                  />
                </div>
              </div>
              <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {riderSettlements.length} repartidores
              </span>
            </div>
            {paymentError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{paymentError}</p> : null}
            <div className="mt-4 space-y-4">
              {riderSettlements.map((settlement) => {
                const draft = paymentDrafts[settlement.rider_user_id] ?? {
                  amount: "",
                  paid_at: nowLocalDateTime(),
                  reference: "",
                  notes: ""
                };
                const latestPayments = paymentsByRider.get(settlement.rider_user_id) ?? [];
                const latestPayment = latestPayments[0] ?? null;
                return (
                  <article key={settlement.rider_user_id} className="rounded bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{settlement.rider_name}</p>
                        <p className="text-sm text-zinc-500">{settlement.vehicle_type}</p>
                      </div>
                      {latestPayment ? <StatusBadge value={latestPayment.receiver_status} /> : null}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Ganado</p>
                        <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(settlement.rider_fee_earned_total)}</p>
                      </div>
                      <div className="rounded bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Pagado</p>
                        <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(settlement.rider_fee_paid_total)}</p>
                      </div>
                      <div className="rounded bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Pendiente</p>
                        <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(settlement.pending_amount)}</p>
                      </div>
                    </div>
                    {latestPayment ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        Último pago: {formatCurrency(latestPayment.amount)} | {statusLabels[latestPayment.receiver_status] ?? latestPayment.receiver_status}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[160px_220px_1fr_1fr_auto]">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.amount}
                        onChange={(event) =>
                          setPaymentDrafts((current) => ({
                            ...current,
                            [settlement.rider_user_id]: { ...draft, amount: event.target.value }
                          }))
                        }
                        placeholder="Monto"
                        className="rounded border border-black/10 bg-white px-4 py-3"
                      />
                      <input
                        type="datetime-local"
                        value={draft.paid_at}
                        onChange={(event) =>
                          setPaymentDrafts((current) => ({
                            ...current,
                            [settlement.rider_user_id]: { ...draft, paid_at: event.target.value }
                          }))
                        }
                        className="rounded border border-black/10 bg-white px-4 py-3"
                      />
                      <input
                        value={draft.reference}
                        onChange={(event) =>
                          setPaymentDrafts((current) => ({
                            ...current,
                            [settlement.rider_user_id]: { ...draft, reference: event.target.value }
                          }))
                        }
                        placeholder="Referencia"
                        className="rounded border border-black/10 bg-white px-4 py-3"
                      />
                      <input
                        value={draft.notes}
                        onChange={(event) =>
                          setPaymentDrafts((current) => ({
                            ...current,
                            [settlement.rider_user_id]: { ...draft, notes: event.target.value }
                          }))
                        }
                        placeholder="Notas"
                        className="rounded border border-black/10 bg-white px-4 py-3"
                      />
                      <Button
                        type="button"
                        disabled={!draft.amount || Number(draft.amount) <= 0 || busyPaymentId === settlement.rider_user_id}
                        onClick={() => void handleRegisterRiderPayment(settlement.rider_user_id)}
                      >
                        {busyPaymentId === settlement.rider_user_id ? "Registrando..." : "Registrar pago"}
                      </Button>
                    </div>
                  </article>
                );
              })}
              {!riderSettlements.length ? (
                <EmptyState title="Sin repartidores para liquidar" description="Los pagos a repartidores aparecerán aquí cuando existan entregas." />
              ) : null}
            </div>
          </article>

          <article className="rounded bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Notificaciones</p>
            <div className="mt-2 flex items-center gap-2">
              <SectionTitle title="Alertas" help="Aquí aparecen avisos recientes relacionados con tus liquidaciones." />
            </div>
            <div className="mt-4 space-y-3">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded bg-zinc-50 p-4 text-sm">
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

      <section className="rounded bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pagos y revisiones</p>
            <div className="mt-2 flex items-center gap-2">
              <SectionTitle title="Movimientos" help="Consulta el registro de avisos, revisiones y pagos." />
            </div>
          </div>
          <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {history.length} eventos
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {history.map((entry) => (
            <article key={entry.id} className="rounded bg-zinc-50 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{entry.title}</p>
                  <p className="mt-1 text-zinc-500">
                    {entry.kind === "rider_payment" ? entry.rider_name ?? "Rider" : storeName}
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
          {!history.length ? <EmptyState title="Sin historial" description="Los movimientos auditables aparecerán en esta lista." /> : null}
        </div>
      </section>
    </div>
  );
}
