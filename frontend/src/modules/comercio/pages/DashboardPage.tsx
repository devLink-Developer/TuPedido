import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, LoadingCard, PageHeader, StatCard, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantSettlementNotice,
  fetchMerchantOrders,
  fetchMerchantSettlementCharges,
  fetchMerchantSettlementNotices,
  fetchMerchantSettlementOverview,
  fetchMerchantStore,
  uploadProofAsset
} from "../../../shared/services/api";
import type { MerchantStore, Order, SettlementCharge, SettlementNotice, SettlementOverview } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

const dashboardMessages: Record<string, { title: string; description: string }> = {
  pending_review: {
    title: "Solicitud en revision",
    description:
      "Tu panel ya esta activo para cargar productos, branding y medios de cobro. El local seguira cerrado hasta que el equipo apruebe el alta."
  },
  approved: {
    title: "Listo para operar",
    description: "Tu comercio ya puede recibir pedidos cuando actives la operacion desde configuracion."
  },
  rejected: {
    title: "Alta rechazada",
    description: "Revisa la informacion cargada y actualiza tu comercio antes de volver a solicitar aprobacion."
  },
  suspended: {
    title: "Operacion suspendida",
    description: "Puedes revisar la configuracion del negocio, pero el local no recibira nuevos pedidos hasta nueva autorizacion."
  }
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildNoticeForm(amount = 0) {
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

export function DashboardPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [charges, setCharges] = useState<SettlementCharge[]>([]);
  const [notices, setNotices] = useState<SettlementNotice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [noticeForm, setNoticeForm] = useState(() => buildNoticeForm());
  const [loading, setLoading] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    let nextOverview: SettlementOverview | null = null;
    setLoading(true);
    try {
      const [storeResult, overviewResult, orderResult, chargeResult, noticeResult] = await Promise.all([
        fetchMerchantStore(token),
        fetchMerchantSettlementOverview(token),
        fetchMerchantOrders(token),
        fetchMerchantSettlementCharges(token),
        fetchMerchantSettlementNotices(token)
      ]);
      nextOverview = overviewResult;
      setStore(storeResult);
      setOverview(overviewResult);
      setOrders(orderResult);
      setCharges(chargeResult);
      setNotices(noticeResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
      if (nextOverview) {
        const pendingBalance = Number(nextOverview.pending_balance.toFixed(2));
        setNoticeForm((current) => ({
          ...current,
          amount: pendingBalance
        }));
      }
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const approvalMessage = useMemo(() => {
    if (!store) return null;
    return dashboardMessages[store.status] ?? dashboardMessages.pending_review;
  }, [store]);

  const pendingNotice = useMemo(
    () => notices.find((notice) => notice.status === "pending_review") ?? null,
    [notices]
  );
  const outstandingBalance = Number((overview?.pending_balance ?? 0).toFixed(2));
  const noticeFormDisabled = savingNotice || uploadingProof || Boolean(pendingNotice) || outstandingBalance <= 0;
  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);

  async function handleProofUpload(file: File | null) {
    if (!token || !file) return;
    setUploadingProof(true);
    setNoticeError(null);
    setNoticeSuccess(null);
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
    if (!token) return;
    setSavingNotice(true);
    setNoticeError(null);
    setNoticeSuccess(null);
    try {
      await createMerchantSettlementNotice(token, {
        amount: outstandingBalance,
        transfer_date: noticeForm.transfer_date,
        bank: noticeForm.bank.trim(),
        reference: noticeForm.reference.trim(),
        notes: noticeForm.notes.trim() || null,
        proof_url: noticeForm.proof_url,
        proof_content_type: noticeForm.proof_content_type,
        proof_original_name: noticeForm.proof_original_name
      });
      setNoticeForm(buildNoticeForm(outstandingBalance));
      setNoticeSuccess("Aviso enviado. Queda pendiente de revision por el equipo.");
      await load();
    } catch (requestError) {
      setNoticeError(requestError instanceof Error ? requestError.message : "No se pudo registrar la transferencia");
    } finally {
      setSavingNotice(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Error" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={store?.name ?? "Panel de comercio"}
        description="Sigue la cuenta corriente del fee de plataforma cobrado al comprador y envia tus liquidaciones con comprobante."
        backgroundImageUrl={store?.cover_image_url}
      />

      {store && approvalMessage ? (
        <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado comercial</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">{approvalMessage.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">{approvalMessage.description}</p>
            </div>
            <StatusPill value={store.status} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Saldo pendiente"
          value={formatCurrency(outstandingBalance)}
          description={`${overview?.pending_charges_count ?? 0} cargos abiertos por fee de plataforma`}
        />
        <StatCard
          label="Fee vigente"
          value={formatCurrency(overview?.service_fee_amount ?? 0)}
          description="Monto global cobrado al cliente por cada compra."
        />
        <StatCard
          label="Liquidado"
          value={formatCurrency(overview?.paid_balance)}
          description="Transferencias ya aplicadas a tu cuenta corriente."
        />
        <StatCard label="Pedidos" value={String(orders.length)} description="Pedidos visibles para el comercio" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-ink">Cuenta corriente</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Aqui ves el fee de plataforma que cobraste en efectivo al cliente por cuenta de Tu Pedido. El costo de delivery sigue siendo ingreso de tu comercio.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>Comercio: {store?.name ?? "-"}</p>
              <p>Saldo pendiente: {formatCurrency(outstandingBalance)}</p>
              <p>Liquidado: {formatCurrency(overview?.paid_balance)}</p>
              <p>Avisos pendientes: {overview?.pending_notices_count ?? 0}</p>
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-ink">Ultimos cargos por fee</h3>
            <div className="mt-4 space-y-3">
              {charges.slice(0, 5).map((charge) => (
                <div key={charge.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">Pedido #{charge.order_id}</p>
                      <p className="text-zinc-500">{charge.payment_method === "cash" ? "Cobrado en efectivo" : "Cobrado por Mercado Pago"}</p>
                    </div>
                    <strong>{formatCurrency(charge.service_fee)}</strong>
                  </div>
                  <p className="mt-2 text-zinc-500">
                    Estado: {statusLabels[charge.status] ?? charge.status} {charge.settled_at ? `| Liquidado ${formatDateTime(charge.settled_at)}` : ""}
                  </p>
                </div>
              ))}
              {!charges.length ? <p className="text-sm text-zinc-500">Todavia no hay cargos generados.</p> : null}
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-ink">Ultimos pedidos</h3>
            <div className="mt-4 space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">Pedido #{order.id}</span>
                    <strong>{formatCurrency(order.total - order.service_fee)}</strong>
                  </div>
                  <p className="mt-1 text-zinc-500">{order.customer_name} | Neto comercio</p>
                  <p className="mt-2 text-zinc-500">
                    Delivery: {formatCurrency(order.delivery_fee_customer)} | Fee plataforma: {formatCurrency(order.service_fee)}
                  </p>
                </div>
              ))}
              {!recentOrders.length ? <p className="text-sm text-zinc-500">Todavia no hay pedidos.</p> : null}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <form onSubmit={(event) => void handleNoticeSubmit(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-ink">Liquidar fee cobrado al cliente</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              El monto se liquida por saldo total. Adjunta el comprobante de transferencia para que el equipo lo revise.
            </p>

            {pendingNotice ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                Ya enviaste un aviso pendiente por {formatCurrency(pendingNotice.amount)}. Espera su revision antes de cargar otro.
              </div>
            ) : null}

            {!pendingNotice && outstandingBalance <= 0 ? (
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                No tienes saldo pendiente para liquidar en este momento.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Monto a liquidar</span>
                <input
                  type="number"
                  value={noticeForm.amount}
                  readOnly
                  className="w-full rounded-2xl border border-black/10 bg-zinc-100 px-4 py-3 text-zinc-600"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Fecha de transferencia</span>
                <input
                  type="date"
                  value={noticeForm.transfer_date}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, transfer_date: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  disabled={noticeFormDisabled}
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Banco</span>
                <input
                  value={noticeForm.bank}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, bank: event.target.value }))}
                  placeholder="Banco emisor"
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  disabled={noticeFormDisabled}
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Referencia</span>
                <input
                  value={noticeForm.reference}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="Numero o referencia de transferencia"
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  disabled={noticeFormDisabled}
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Notas</span>
                <textarea
                  value={noticeForm.notes}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Notas opcionales para el equipo"
                  rows={3}
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  disabled={noticeFormDisabled}
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>Comprobante</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="w-full rounded-2xl border border-dashed border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600"
                  onChange={(event) => void handleProofUpload(event.target.files?.[0] ?? null)}
                  disabled={noticeFormDisabled}
                />
              </label>
              {uploadingProof ? <p className="text-sm text-zinc-500">Subiendo comprobante...</p> : null}
              {noticeForm.proof_url ? (
                <div className="rounded-[24px] border border-black/5 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-ink">{noticeForm.proof_original_name}</p>
                  <div className="mt-3">
                    {noticeForm.proof_content_type.startsWith("image/") ? (
                      <img src={noticeForm.proof_url} alt="Comprobante" className="max-h-56 rounded-2xl object-contain" />
                    ) : (
                      <a href={noticeForm.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600">
                        Ver comprobante PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {noticeError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{noticeError}</p> : null}
            {noticeSuccess ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{noticeSuccess}</p> : null}

            <Button
              type="submit"
              disabled={
                noticeFormDisabled ||
                !noticeForm.transfer_date ||
                !noticeForm.bank.trim() ||
                !noticeForm.reference.trim() ||
                !noticeForm.proof_url
              }
              className="mt-4"
            >
              {savingNotice ? "Enviando..." : "Enviar aviso de transferencia"}
            </Button>
          </form>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-ink">Avisos enviados</h3>
            <div className="mt-4 space-y-3">
              {notices.map((notice) => (
                <div key={notice.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{formatCurrency(notice.amount)}</p>
                      <p className="text-zinc-500">{notice.bank} | {notice.reference}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                      {statusLabels[notice.status] ?? notice.status}
                    </span>
                  </div>
                  <p className="mt-2 text-zinc-500">Enviado {formatDateTime(notice.created_at)}</p>
                  {notice.reviewed_notes ? <p className="mt-2 text-zinc-600">Revision: {notice.reviewed_notes}</p> : null}
                  {notice.proof_url ? (
                    <div className="mt-3">
                      {isImageProof(notice) ? (
                        <img src={notice.proof_url} alt="Comprobante enviado" className="max-h-44 rounded-2xl object-contain" />
                      ) : (
                        <a href={notice.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600">
                          Ver comprobante adjunto
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {!notices.length ? <p className="text-sm text-zinc-500">Aun no enviaste avisos de transferencia.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
