import { useEffect, useMemo, useRef, useState } from "react";
import { AddressLocationPicker } from "../../../shared/components/maps/AddressLocationPicker";
import { geocodeAddress, lookupPostalCode } from "../../../shared/services/api";
import type { AddressLookupLocality, MerchantStore } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import {
  buildAddressGeocodeRequest,
  buildStructuredAddress,
  extractArgentinePostalCode,
  normalizePostalCodeInput,
  splitStreetLine,
} from "../../../shared/utils/addressFields";

export type StoreAddressFormState = {
  postal_code: string;
  province: string;
  locality: string;
  street_name: string;
  street_number: string;
  latitude: string;
  longitude: string;
};

export const emptyStoreAddressForm: StoreAddressFormState = {
  postal_code: "",
  province: "",
  locality: "",
  street_name: "",
  street_number: "",
  latitude: "",
  longitude: "",
};

function formatCoordinate(value: number | null | undefined) {
  return value == null ? "" : value.toFixed(7);
}

function toCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toStoreAddressFormState(
  store?: Pick<MerchantStore, "address" | "postal_code" | "province" | "locality" | "latitude" | "longitude"> | null
): StoreAddressFormState {
  if (!store) return emptyStoreAddressForm;

  const streetLine = (store.address ?? "").split(",")[0]?.trim() ?? "";
  const street = splitStreetLine(streetLine);
  return {
    postal_code: store.postal_code ?? "",
    province: store.province ?? "",
    locality: store.locality ?? "",
    street_name: street.streetName,
    street_number: street.streetNumber,
    latitude: formatCoordinate(store.latitude),
    longitude: formatCoordinate(store.longitude),
  };
}

export function hasStoreAddressConfiguration(form: StoreAddressFormState) {
  return Boolean(
    extractArgentinePostalCode(form.postal_code) &&
      form.province.trim() &&
      form.locality.trim() &&
      form.street_name.trim() &&
      form.street_number.trim() &&
      toCoordinate(form.latitude) !== null &&
      toCoordinate(form.longitude) !== null
  );
}

export function toStoreAddressPayload(form: StoreAddressFormState) {
  const latitude = toCoordinate(form.latitude);
  const longitude = toCoordinate(form.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    address: buildStructuredAddress(
      form.street_name,
      form.street_number,
      form.locality,
      form.province,
      extractArgentinePostalCode(form.postal_code) || form.postal_code
    ),
    postal_code: extractArgentinePostalCode(form.postal_code) || form.postal_code.trim(),
    province: form.province.trim(),
    locality: form.locality.trim(),
    latitude,
    longitude,
  };
}

export function StoreAddressSection({
  token,
  form,
  onChange,
}: {
  token: string | null;
  form: StoreAddressFormState;
  onChange: (value: StoreAddressFormState) => void;
}) {
  const formRef = useRef(form);
  const lastResolvedGeocodeKeyRef = useRef<string | null>(null);
  const inFlightGeocodeKeyRef = useRef<string | null>(null);
  const geocodePromiseRef = useRef<Promise<StoreAddressFormState | null> | null>(null);
  const [localities, setLocalities] = useState<AddressLookupLocality[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [geocodingSuccess, setGeocodingSuccess] = useState<string | null>(null);

  const latitude = toCoordinate(form.latitude);
  const longitude = toCoordinate(form.longitude);
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
  const canGeocode = Boolean(token && geocodeRequest);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

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

  useEffect(() => {
    if (geocodeKey && latitude !== null && longitude !== null) {
      lastResolvedGeocodeKeyRef.current = geocodeKey;
      return;
    }

    if (latitude === null || longitude === null) {
      lastResolvedGeocodeKeyRef.current = null;
    }
  }, [geocodeKey, latitude, longitude]);

  function updateFields(nextFields: Partial<StoreAddressFormState>, clearCoordinates = false) {
    const nextValue = { ...formRef.current, ...nextFields };
    if (clearCoordinates) {
      nextValue.latitude = "";
      nextValue.longitude = "";
      lastResolvedGeocodeKeyRef.current = null;
    }
    formRef.current = nextValue;
    onChange(nextValue);
  }

  async function handlePostalCodeLookup() {
    if (!token) {
      setLookupError("Tu sesion vencio. Vuelve a iniciar sesion para buscar codigos postales.");
      return;
    }

    const postalCode = extractArgentinePostalCode(form.postal_code);
    if (!postalCode) {
      setLookupError("Ingresa un codigo postal argentino valido de 4 digitos.");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setGeocodingError(null);
    setGeocodingSuccess(null);

    try {
      const result = await lookupPostalCode(token, postalCode);
      const selectedLocalityName =
        result.localities.find((item) => item.name === form.locality.trim())?.name ?? result.localities[0]?.name ?? "";
      setLocalities(result.localities);
      updateFields(
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

  async function handleGeocode(mode: "manual" | "auto" = "manual") {
    if (!token) {
      if (mode === "manual") {
        setGeocodingError("Tu sesion vencio. Vuelve a iniciar sesion para ubicar la direccion.");
      }
      return null;
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

    if (
      lastResolvedGeocodeKeyRef.current === currentGeocodeKey &&
      toCoordinate(formRef.current.latitude) !== null &&
      toCoordinate(formRef.current.longitude) !== null
    ) {
      return formRef.current;
    }

    if (inFlightGeocodeKeyRef.current === currentGeocodeKey && geocodePromiseRef.current) {
      return geocodePromiseRef.current;
    }

    if (geocodePromiseRef.current) {
      await geocodePromiseRef.current;
      return handleGeocode(mode);
    }

    setGeocoding(true);
    setGeocodingError(null);
    setGeocodingSuccess(null);
    inFlightGeocodeKeyRef.current = currentGeocodeKey;

    const geocodePromise = (async () => {
      try {
        const result = await geocodeAddress(token, currentRequest);
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

        const nextValue: StoreAddressFormState = {
          ...formRef.current,
          latitude: result.latitude.toFixed(7),
          longitude: result.longitude.toFixed(7),
        };
        formRef.current = nextValue;
        onChange(nextValue);
        lastResolvedGeocodeKeyRef.current = currentGeocodeKey;
        setGeocodingSuccess(
          result.display_name ? `Ubicacion encontrada: ${result.display_name}` : "Direccion ubicada correctamente en el mapa."
        );
        return nextValue;
      } catch (requestError) {
        setGeocodingError(requestError instanceof Error ? requestError.message : "No se pudo ubicar la direccion del local.");
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
    if (!token || !buildAddressGeocodeRequest(formRef.current)) {
      return;
    }

    await handleGeocode("auto");
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Direccion del local</p>
        <h2 className="mt-2 text-xl font-bold text-ink">Ubicacion comercial</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Configura CP, provincia, localidad, calle y altura para geolocalizar el local. El delivery solo se puede activar con esta direccion completa.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex gap-2">
          <input
            value={form.postal_code}
            onChange={(event) => {
              setLocalities([]);
              setLookupError(null);
              setGeocodingError(null);
              setGeocodingSuccess(null);
              updateFields(
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
          <Button type="button" onClick={() => void handlePostalCodeLookup()} disabled={lookupLoading || !token} className="px-4 py-3 text-sm">
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
            updateFields({ locality: event.target.value }, true);
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
            updateFields({ street_name: event.target.value }, true);
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
            updateFields({ street_number: event.target.value }, true);
          }}
          onBlur={() => void handleStreetNumberBlur()}
          placeholder="Altura"
          disabled={!canEditStreet}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />

        <div className="rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600 md:col-span-2">
          <div>
            <p className="font-semibold text-ink">Geolocalizacion automatica del local</p>
            <p className="mt-1">
              Al salir del campo de altura ubicamos el local automaticamente. Si hace falta, puedes ajustar el pin en el mapa antes de guardar.
            </p>
            {canGeocode && geocoding ? <p className="mt-2 text-xs font-semibold text-brand-600">Ubicando local...</p> : null}
          </div>
        </div>

        <AddressLocationPicker
          latitude={latitude}
          longitude={longitude}
          fallbackLatitude={selectedLocality?.latitude ?? null}
          fallbackLongitude={selectedLocality?.longitude ?? null}
          onChange={(coordinates) =>
            updateFields({
              latitude: coordinates.latitude.toFixed(7),
              longitude: coordinates.longitude.toFixed(7),
            })
          }
        />
      </div>

      {lookupError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{lookupError}</p> : null}
      {geocodingError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{geocodingError}</p> : null}
      {geocodingSuccess ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{geocodingSuccess}</p> : null}
    </section>
  );
}
