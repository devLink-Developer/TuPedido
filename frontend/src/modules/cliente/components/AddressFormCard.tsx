import { AddressLocationPicker } from "../../../shared/components/maps/AddressLocationPicker";
import type { Address } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

export type AddressFormState = {
  label: string;
  street: string;
  details: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
};

export const emptyAddressForm: AddressFormState = {
  label: "",
  street: "",
  details: "",
  latitude: "",
  longitude: "",
  is_default: false,
};

function formatCoordinate(value: number | null) {
  return value === null ? "" : value.toFixed(7);
}

function toCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toAddressFormState(address?: Address | null): AddressFormState {
  if (!address) return emptyAddressForm;
  return {
    label: address.label,
    street: address.street,
    details: address.details,
    latitude: formatCoordinate(address.latitude),
    longitude: formatCoordinate(address.longitude),
    is_default: address.is_default,
  };
}

export function hasAddressGeolocation(form: AddressFormState) {
  return toCoordinate(form.latitude) !== null && toCoordinate(form.longitude) !== null;
}

export function getAddressCoordinates(form: AddressFormState) {
  return {
    latitude: toCoordinate(form.latitude),
    longitude: toCoordinate(form.longitude),
  };
}

export function AddressFormCard({
  title,
  submitLabel,
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  form: AddressFormState;
  saving?: boolean;
  error?: string | null;
  onChange: (value: AddressFormState) => void;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const latitude = getAddressCoordinates(form).latitude;
  const longitude = getAddressCoordinates(form).longitude;

  function updateField<Key extends keyof AddressFormState>(field: Key, value: AddressFormState[Key]) {
    onChange({ ...form, [field]: value });
  }

  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={form.label}
          onChange={(event) => updateField("label", event.target.value)}
          placeholder="Casa, trabajo, consultorio"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <input
          value={form.street}
          onChange={(event) => updateField("street", event.target.value)}
          placeholder="Calle y numero"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <textarea
          value={form.details}
          onChange={(event) => updateField("details", event.target.value)}
          rows={4}
          placeholder="Piso, depto, referencia, timbre"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
        />
        <AddressLocationPicker
          latitude={latitude}
          longitude={longitude}
          onChange={(coordinates) =>
            onChange({
              ...form,
              latitude: coordinates.latitude.toFixed(7),
              longitude: coordinates.longitude.toFixed(7),
            })
          }
        />
        <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 md:col-span-2">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) => updateField("is_default", event.target.checked)}
          />
          Usar como direccion predeterminada
        </label>
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
          {saving ? "Guardando..." : submitLabel}
        </Button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </article>
  );
}
