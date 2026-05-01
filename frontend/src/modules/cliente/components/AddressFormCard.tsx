import { useEffect, useMemo, useRef, useState } from "react";
import { AddressLocationPicker, type AddressLocationChangeSource } from "../../../shared/components/maps/AddressLocationPicker";
import { geocodeAddress, lookupPostalCode, reverseGeocodeAddress } from "../../../shared/services/api";
import type { Address, AddressLookupLocality, AddressWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import {
  buildAddressGeocodeRequest,
  buildStreetLine,
  extractArgentinePostalCode,
  normalizePostalCodeInput,
  splitStreetLine,
} from "../../../shared/utils/addressFields";

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

function getAddressLabel(form: AddressFormState) {
  return form.label.trim() || "Mi direccion";
}

export function getAddressMissingFields(form: AddressFormState) {
  return [
    !form.postal_code.trim() ? "CP" : null,
    !form.province.trim() ? "provincia" : null,
    !form.locality.trim() ? "localidad" : null,
    !form.street_name.trim() ? "calle" : null,
    !form.street_number.trim() ? "altura" : null,
  ].filter((value): value is string => Boolean(value));
}

export function toAddressPayload(form: AddressFormState): AddressWrite | null {
  const coordinates = getAddressCoordinates(form);
  if (coordinates.latitude === null || coordinates.longitude === null) {
    return null;
  }

  return {
    label: getAddressLabel(form),
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
  onSubmit: (value: AddressFormState) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const latitude = getAddressCoordinates(form).latitude;
  const longitude = getAddressCoordinates(form).longitude;
  const formRef = useRef(form);
  const localChangeRef = useRef(false);
  const lastResolvedGeocodeKeyRef = useRef<string | null>(null);
  const inFlightGeocodeKeyRef = useRef<string | null>(null);
  const geocodePromiseRef = useRef<Promise<AddressFormState | null> | null>(null);
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
  const geocodeRequest = useMemo(() => buildAddressGeocodeRequest(form), [form]);
  const geocodeKey = useMemo(
    () =>
      geocodeRequest
        ? [
            geocodeRequest.postal_code,
            geocodeRequest.province,
            geocodeRequest.locality,
            geocodeRequest.street_name,
            geocodeRequest.street_number,
          ].join("|")
        : null,
    [geocodeRequest]
  );
  const canEditStreet = Boolean(form.locality.trim());
  const canGeocodeAddress = Boolean(lookupToken && geocodeRequest);

  useEffect(() => {
    formRef.current = form;
    if (!localChangeRef.current) {
      if (geocodeKey && hasAddressGeolocation(form)) {
        lastResolvedGeocodeKeyRef.current = geocodeKey;
      } else {
        lastResolvedGeocodeKeyRef.current = null;
      }
    }
    localChangeRef.current = false;
  }, [form, geocodeKey]);

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
    const nextValue = { ...formRef.current, [field]: value };
    formRef.current = nextValue;
    localChangeRef.current = true;
    onChange(nextValue);
  }

  function updateAddressFields(nextFields: Partial<AddressFormState>, clearCoordinates = false) {
    const nextValue: AddressFormState = { ...formRef.current, ...nextFields };
    if (clearCoordinates) {
      nextValue.latitude = "";
      nextValue.longitude = "";
      lastResolvedGeocodeKeyRef.current = null;
    }
    formRef.current = nextValue;
    localChangeRef.current = true;
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
      const selectedLocalityName = result.localities.find((item) => item.name === form.locality.trim())?.name ?? "";
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

  function handleLocalityChange(localityName: string) {
    const locality = localities.find((item) => item.name === localityName) ?? null;
    setGeocodingError(null);
    setGeocodingSuccess(null);
    lastResolvedGeocodeKeyRef.current = null;
    updateAddressFields({
      locality: localityName,
      street_name: "",
      street_number: "",
      latitude: formatCoordinate(locality?.latitude ?? null),
      longitude: formatCoordinate(locality?.longitude ?? null),
    });

    if (localityName && locality?.latitude !== null && locality?.longitude !== null) {
      setGeocodingSuccess(`Localidad ubicada en el mapa: ${localityName}. Ahora completa calle y altura o ajusta el pin.`);
    }
  }

  async function handleMapLocationChange(
    coordinates: { latitude: number; longitude: number },
    source: AddressLocationChangeSource
  ) {
    const nextLatitude = coordinates.latitude.toFixed(7);
    const nextLongitude = coordinates.longitude.toFixed(7);

    updateAddressFields({
      latitude: nextLatitude,
      longitude: nextLongitude,
    });
    setGeocodingError(null);
    setGeocodingSuccess(null);

    if (!lookupToken || !formRef.current.locality.trim()) {
      return;
    }

    try {
      const result = await reverseGeocodeAddress(lookupToken, coordinates);
      updateAddressFields({
        street_name: result.street_name ?? "",
        street_number: result.street_number ?? "",
        latitude: nextLatitude,
        longitude: nextLongitude,
      });
      setGeocodingSuccess(
        result.street_name && result.street_number
          ? `Direccion detectada desde el mapa: ${buildStreetLine(result.street_name, result.street_number)}`
          : result.street_name
            ? `Calle detectada desde el mapa: ${result.street_name}. Completa la altura si falta.`
            : result.display_name
              ? `Ubicacion detectada desde el mapa: ${result.display_name}`
              : "Ubicacion tomada desde el mapa."
      );
    } catch (requestError) {
      setGeocodingError(
        requestError instanceof Error
          ? requestError.message
          : source === "current_location"
            ? "Tomamos tu ubicacion, pero no pudimos completar calle y altura."
            : "Tomamos el pin del mapa, pero no pudimos completar calle y altura."
      );
    }
  }

  async function handleGeocodeAddress(mode: "manual" | "auto" = "manual", options?: { force?: boolean }) {
    if (!lookupToken) {
      if (mode === "manual") {
        setGeocodingError("Tu sesion vencio. Vuelve a iniciar sesion para ubicar la direccion.");
      }
      return;
    }

    const currentRequest = buildAddressGeocodeRequest(formRef.current);
    if (!currentRequest) {
      if (mode === "manual") {
        setGeocodingError("Primero valida el CP, elige una localidad y completa calle y altura.");
      }
      return null;
    }

    const currentGeocodeKey = [
      currentRequest.postal_code,
      currentRequest.province,
      currentRequest.locality,
      currentRequest.street_name,
      currentRequest.street_number,
    ].join("|");

    if (!options?.force && lastResolvedGeocodeKeyRef.current === currentGeocodeKey && hasAddressGeolocation(formRef.current)) {
      return formRef.current;
    }

    if (inFlightGeocodeKeyRef.current === currentGeocodeKey && geocodePromiseRef.current) {
      return geocodePromiseRef.current;
    }

    if (geocodePromiseRef.current) {
      await geocodePromiseRef.current;
      return handleGeocodeAddress(mode);
    }

    setGeocoding(true);
    setGeocodingError(null);
    setGeocodingSuccess(null);
    inFlightGeocodeKeyRef.current = currentGeocodeKey;

    const geocodePromise = (async () => {
      try {
        const result = await geocodeAddress(lookupToken, currentRequest);
        const latestRequest = buildAddressGeocodeRequest(formRef.current);
        const latestGeocodeKey = latestRequest
          ? [
              latestRequest.postal_code,
              latestRequest.province,
              latestRequest.locality,
              latestRequest.street_name,
              latestRequest.street_number,
            ].join("|")
          : null;

        if (latestGeocodeKey !== currentGeocodeKey) {
          return null;
        }

        const nextForm: AddressFormState = {
          ...formRef.current,
          latitude: result.latitude.toFixed(7),
          longitude: result.longitude.toFixed(7),
        };
        formRef.current = nextForm;
        localChangeRef.current = true;
        onChange(nextForm);
        lastResolvedGeocodeKeyRef.current = currentGeocodeKey;
        setGeocodingSuccess(
          result.display_name ? `Ubicacion encontrada: ${result.display_name}` : "Direccion ubicada correctamente en el mapa."
        );
        return nextForm;
      } catch (requestError) {
        setGeocodingError(requestError instanceof Error ? requestError.message : "No se pudo ubicar la direccion en el mapa.");
        return null;
      } finally {
        if (inFlightGeocodeKeyRef.current === currentGeocodeKey) {
          inFlightGeocodeKeyRef.current = null;
          geocodePromiseRef.current = null;
        }
        setGeocoding(false);
      }
    })();

    geocodePromiseRef.current = geocodePromise;
    return geocodePromise;
  }

  async function handleStreetNumberBlur() {
    if (!lookupToken || !buildAddressGeocodeRequest(formRef.current)) {
      return;
    }

    await handleGeocodeAddress("auto", { force: true });
  }

  useEffect(() => {
    if (!lookupToken || !geocodeKey) {
      return;
    }

    if (lastResolvedGeocodeKeyRef.current === geocodeKey && hasAddressGeolocation(form)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleGeocodeAddress("auto");
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form, geocodeKey, lookupToken]);

  async function handleSubmitClick() {
    let nextForm = formRef.current;

    if (!hasAddressGeolocation(nextForm) && lookupToken && buildAddressGeocodeRequest(nextForm)) {
      const geocodedForm = await handleGeocodeAddress("auto");
      if (!geocodedForm) {
        return;
      }
      nextForm = geocodedForm;
    }

    await onSubmit(nextForm);
  }

  return (
    <article className="rounded bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={form.label}
          onChange={(event) => updateField("label", event.target.value)}
          placeholder="Etiqueta opcional: casa, trabajo, consultorio"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
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
            className="min-w-0 flex-1 rounded border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <Button type="button" onClick={() => void handlePostalCodeLookup()} disabled={lookupLoading || !lookupToken} className="px-4 py-3 text-sm">
            {lookupLoading ? "Buscando..." : "Buscar CP"}
          </Button>
        </div>
        <input
          value={form.province}
          readOnly
          placeholder="Provincia"
          className="rounded border border-black/10 bg-zinc-100 px-4 py-3 text-zinc-700"
        />
        <select
          value={form.locality}
          onChange={(event) => {
            handleLocalityChange(event.target.value);
          }}
          disabled={!localities.length}
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
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
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        <input
          value={form.street_number}
          onChange={(event) => {
            setGeocodingError(null);
            setGeocodingSuccess(null);
            updateAddressFields({ street_number: event.target.value }, true);
          }}
          onBlur={() => void handleStreetNumberBlur()}
          placeholder="Altura"
          disabled={!canEditStreet}
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        <textarea
          value={form.details}
          onChange={(event) => updateField("details", event.target.value)}
          rows={4}
          placeholder="Piso, depto, referencia, timbre (opcional)"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
        />
        <div className="rounded bg-zinc-50 p-4 text-sm text-zinc-600 md:col-span-2">
          <div>
            <p className="font-semibold text-ink">Geolocalizacion automatica</p>
            <p className="mt-1">
              Al salir del campo de altura ubicamos la direccion automaticamente. Si necesitas corregir el punto, puedes mover el pin en el mapa.
            </p>
            {canGeocodeAddress && geocoding ? <p className="mt-2 text-xs font-semibold text-brand-600">Ubicando direccion...</p> : null}
          </div>
        </div>
        <AddressLocationPicker
          latitude={latitude}
          longitude={longitude}
          fallbackLatitude={selectedLocality?.latitude ?? null}
          fallbackLongitude={selectedLocality?.longitude ?? null}
          onChange={(coordinates, source) => void handleMapLocationChange(coordinates, source)}
        />
        <label className="flex items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 md:col-span-2">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) => updateField("is_default", event.target.checked)}
          />
          Usar como direccion predeterminada
        </label>
      </div>

      {lookupError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{lookupError}</p> : null}
      {geocodingError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{geocodingError}</p> : null}
      {geocodingSuccess ? <p className="mt-4 rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{geocodingSuccess}</p> : null}
      {error ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSubmitClick()} disabled={saving || geocoding}>
          {saving ? "Guardando..." : submitLabel}
        </Button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </article>
  );
}
