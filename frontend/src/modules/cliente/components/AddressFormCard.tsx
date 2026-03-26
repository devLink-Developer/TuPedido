import { useEffect, useMemo, useState } from "react";
import { AddressLocationPicker } from "../../../shared/components/maps/AddressLocationPicker";
import { geocodeAddress, lookupPostalCode } from "../../../shared/services/api";
import type { Address, AddressLookupLocality, AddressWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { buildStreetLine, extractArgentinePostalCode, normalizePostalCodeInput, splitStreetLine } from "../../../shared/utils/addressFields";

export type AddressFormState = {
  label: string;
  postal_code: string;
  province: string;
  locality: string;
  street_name: string;
  street_number: string;
  details: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
};

export const emptyAddressForm: AddressFormState = {
  label: "",
  postal_code: "",
  province: "",
  locality: "",
  street_name: "",
  street_number: "",
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

  const streetParts = splitStreetLine(address.street);
  return {
    label: address.label,
    postal_code: address.postal_code ?? "",
    province: address.province ?? "",
    locality: address.locality ?? "",
    street_name: streetParts.streetName,
    street_number: streetParts.streetNumber,
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

export function toAddressPayload(form: AddressFormState): AddressWrite | null {
  const coordinates = getAddressCoordinates(form);
  if (coordinates.latitude === null || coordinates.longitude === null) {
    return null;
  }

  return {
    label: form.label.trim(),
    postal_code: extractArgentinePostalCode(form.postal_code) || form.postal_code.trim(),
    province: form.province.trim(),
    locality: form.locality.trim(),
    street: buildStreetLine(form.street_name, form.street_number),
    details: form.details.trim(),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    is_default: form.is_default,
  };
}

export function AddressFormCard({
  title,
  submitLabel,
  lookupToken,
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  lookupToken: string | null;
  form: AddressFormState;
  saving?: boolean;
  error?: string | null;
  onChange: (value: AddressFormState) => void;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const latitude = getAddressCoordinates(form).latitude;
  const longitude = getAddressCoordinates(form).longitude;
  const [localities, setLocalities] = useState<AddressLookupLocality[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [geocodingSuccess, setGeocodingSuccess] = useState<string | null>(null);

  const selectedLocality = useMemo(
    () => localities.find((item) => item.name === form.locality.trim()) ?? null,
    [form.locality, localities]
  );
  const canEditStreet = Boolean(form.locality.trim());
  const canGeocodeAddress = Boolean(
    lookupToken &&
      extractArgentinePostalCode(form.postal_code) &&
      form.province.trim() &&
      form.locality.trim() &&
      form.street_name.trim() &&
      form.street_number.trim()
  );

  useEffect(() => {
    if (!form.locality.trim()) {
      setLocalities([]);
      return;
    }

    setLocalities((current) => {
      if (current.some((item) => item.name === form.locality.trim())) {
        return current;
      }
      return [{ name: form.locality.trim(), latitude: null, longitude: null }, ...current];
    });
  }, [form.locality]);

  function updateField<Key extends keyof AddressFormState>(field: Key, value: AddressFormState[Key]) {
    onChange({ ...form, [field]: value });
  }

  function updateAddressFields(nextFields: Partial<AddressFormState>, clearCoordinates = false) {
    const nextValue: AddressFormState = { ...form, ...nextFields };
    if (clearCoordinates) {
      nextValue.latitude = "";
      nextValue.longitude = "";
    }
    onChange(nextValue);
  }

  async function handlePostalCodeLookup() {
    if (!lookupToken) {
      setLookupError("Tu sesion vencio. Vuelve a iniciar sesion para buscar codigos postales.");
      return;
    }

    const normalizedPostalCode = extractArgentinePostalCode(form.postal_code);
    if (!normalizedPostalCode) {
      setLookupError("Ingresa un codigo postal argentino valido de 4 digitos.");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setGeocodingError(null);
    setGeocodingSuccess(null);

    try {
      const result = await lookupPostalCode(lookupToken, normalizedPostalCode);
      const selectedLocalityName =
        result.localities.find((item) => item.name === form.locality.trim())?.name ?? result.localities[0]?.name ?? "";
      setLocalities(result.localities);
      updateAddressFields(
        {
          postal_code: result.postal_code,
          province: result.province,
          locality: selectedLocalityName,
        },
        true
      );
    } catch (requestError) {
      setLocalities([]);
      setLookupError(requestError instanceof Error ? requestError.message : "No se pudo validar el codigo postal.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleGeocodeAddress() {
    if (!lookupToken) {
      setGeocodingError("Tu sesion vencio. Vuelve a iniciar sesion para ubicar la direccion.");
      return;
    }
    if (!canGeocodeAddress) {
      setGeocodingError("Primero valida el CP, elige una localidad y completa calle y altura.");
      return;
    }

    setGeocoding(true);
    setGeocodingError(null);
    setGeocodingSuccess(null);

    try {
      const result = await geocodeAddress(lookupToken, {
        postal_code: extractArgentinePostalCode(form.postal_code),
        province: form.province.trim(),
        locality: form.locality.trim(),
        street_name: form.street_name.trim(),
        street_number: form.street_number.trim(),
      });

      updateAddressFields({
        latitude: result.latitude.toFixed(7),
        longitude: result.longitude.toFixed(7),
      });
      setGeocodingSuccess(result.display_name ? `Ubicacion encontrada: ${result.display_name}` : "Direccion ubicada correctamente en el mapa.");
    } catch (requestError) {
      setGeocodingError(requestError instanceof Error ? requestError.message : "No se pudo ubicar la direccion en el mapa.");
    } finally {
      setGeocoding(false);
    }
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
        <div className="flex gap-2">
          <input
            value={form.postal_code}
            onChange={(event) => {
              setLocalities([]);
              setLookupError(null);
              setGeocodingError(null);
              setGeocodingSuccess(null);
              updateAddressFields(
                {
                  postal_code: normalizePostalCodeInput(event.target.value),
                  province: "",
                  locality: "",
                  street_name: "",
                  street_number: "",
                },
                true
              );
            }}
            placeholder="CP"
            className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <Button type="button" onClick={() => void handlePostalCodeLookup()} disabled={lookupLoading || !lookupToken} className="px-4 py-3 text-sm">
            {lookupLoading ? "Buscando..." : "Buscar CP"}
          </Button>
        </div>
        <input
          value={form.province}
          readOnly
          placeholder="Provincia"
          className="rounded-2xl border border-black/10 bg-zinc-100 px-4 py-3 text-zinc-700"
        />
        <select
          value={form.locality}
          onChange={(event) => {
            setGeocodingError(null);
            setGeocodingSuccess(null);
            updateAddressFields({ locality: event.target.value }, true);
          }}
          disabled={!localities.length}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          <option value="">{localities.length ? "Selecciona una localidad" : "Primero busca el CP"}</option>
          {localities.map((locality) => (
            <option key={locality.name} value={locality.name}>
              {locality.name}
            </option>
          ))}
        </select>
        <input
          value={form.street_name}
          onChange={(event) => {
            setGeocodingError(null);
            setGeocodingSuccess(null);
            updateAddressFields({ street_name: event.target.value }, true);
          }}
          placeholder="Calle"
          disabled={!canEditStreet}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        <input
          value={form.street_number}
          onChange={(event) => {
            setGeocodingError(null);
            setGeocodingSuccess(null);
            updateAddressFields({ street_number: event.target.value }, true);
          }}
          placeholder="Altura"
          disabled={!canEditStreet}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        <textarea
          value={form.details}
          onChange={(event) => updateField("details", event.target.value)}
          rows={4}
          placeholder="Piso, depto, referencia, timbre"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
        />
        <div className="rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Geolocalizacion por direccion</p>
              <p className="mt-1">Primero valida el CP, luego elige la localidad y completa calle con altura para ubicar el punto exacto.</p>
            </div>
            <Button type="button" onClick={() => void handleGeocodeAddress()} disabled={!canGeocodeAddress || geocoding} className="px-4 py-3 text-sm">
              {geocoding ? "Ubicando..." : "Ubicar en mapa"}
            </Button>
          </div>
        </div>
        <AddressLocationPicker
          latitude={latitude}
          longitude={longitude}
          fallbackLatitude={selectedLocality?.latitude ?? null}
          fallbackLongitude={selectedLocality?.longitude ?? null}
          onChange={(coordinates) =>
            updateAddressFields({
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

      {lookupError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{lookupError}</p> : null}
      {geocodingError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{geocodingError}</p> : null}
      {geocodingSuccess ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{geocodingSuccess}</p> : null}
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
