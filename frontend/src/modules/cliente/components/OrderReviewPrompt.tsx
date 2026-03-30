import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import type { CreateOrderReviewPayload, PendingOrderReview } from "../../../shared/types";
import { formatDateTime } from "../../../shared/utils/format";

type RatingFieldProps = {
  label: string;
  helper: string;
  value: number | null;
  onChange: (value: number) => void;
  name: string;
};

type OrderReviewPromptProps = {
  review: PendingOrderReview;
  submitError: string | null;
  submitting: boolean;
  onSkip: () => void;
  onSubmit: (payload: CreateOrderReviewPayload) => Promise<void>;
};

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${active ? "fill-current" : "fill-none"}`}>
      <path
        d="M12 2.75l2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.03 6.44 19.85l1.06-6.19L3 9.28l6.22-.9L12 2.75z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RatingField({ label, helper, value, onChange, name }: RatingFieldProps) {
  return (
    <div className="rounded-[24px] border border-black/8 bg-zinc-50 px-4 py-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-sm text-zinc-500">{helper}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((starValue) => {
          const active = value !== null && starValue <= value;
          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={value === starValue}
              aria-label={`${name} ${starValue} estrellas`}
              onClick={() => onChange(starValue)}
              className={`rounded-full border px-3 py-2 transition ${
                active
                  ? "border-amber-300 bg-amber-50 text-amber-500"
                  : "border-black/10 bg-white text-zinc-300 hover:border-amber-200 hover:text-amber-400"
              }`}
            >
              <StarIcon active={active} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OrderReviewPrompt({
  review,
  submitError,
  submitting,
  onSkip,
  onSubmit
}: OrderReviewPromptProps) {
  const [storeRating, setStoreRating] = useState<number | null>(null);
  const [riderRating, setRiderRating] = useState<number | null>(null);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    setStoreRating(null);
    setRiderRating(null);
    setReviewEnabled(false);
    setReviewText("");
  }, [review.order_id]);

  const canSubmit = useMemo(
    () => storeRating !== null && (!review.requires_rider_rating || riderRating !== null),
    [review.requires_rider_rating, riderRating, storeRating]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }

    if (storeRating === null || (review.requires_rider_rating && riderRating === null)) {
      return;
    }

    await onSubmit({
      store_rating: storeRating,
      rider_rating: review.requires_rider_rating ? riderRating : null,
      review_text: reviewEnabled ? reviewText.trim() || null : null
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(17,12,11,0.56)] p-4 sm:items-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-xl rounded-[32px] bg-white p-5 shadow-[0_28px_70px_rgba(17,12,11,0.32)] sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-500">Calificacion pendiente</p>
        <h2 className="mt-3 font-display text-[1.9rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-3xl">
          Contanos como fue el pedido
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {review.store_name}
          {review.delivered_at ? ` | Entregado ${formatDateTime(review.delivered_at)}` : ""}
        </p>

        <div className="mt-6 space-y-4">
          <RatingField
            label="Comercio"
            helper={`Califica la experiencia con ${review.store_name}.`}
            value={storeRating}
            onChange={setStoreRating}
            name="Comercio"
          />

          {review.requires_rider_rating ? (
            <RatingField
              label="Rider"
              helper={`Califica la entrega de ${review.rider_name ?? "tu rider"}.`}
              value={riderRating}
              onChange={setRiderRating}
              name="Rider"
            />
          ) : null}
        </div>

        <div className="mt-5">
          {!reviewEnabled ? (
            <button
              type="button"
              onClick={() => setReviewEnabled(true)}
              className="rounded-full border border-black/10 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-ink"
            >
              Agregar resena
            </button>
          ) : (
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Resena opcional</span>
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={4}
                placeholder="Cuenta brevemente como fue tu experiencia."
                className="w-full rounded-[24px] border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500"
              />
            </label>
          )}
        </div>

        {submitError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-black/20 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Saltar por ahora
          </button>
          <Button type="submit" disabled={!canSubmit || submitting} className="sm:min-w-[220px]">
            {submitting ? "Guardando..." : "Enviar calificacion"}
          </Button>
        </div>
      </form>
    </div>
  );
}
