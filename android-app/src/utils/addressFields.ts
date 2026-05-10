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
  is_default: false
};

export function normalizePostalCodeInput(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 4);
}

export function extractArgentinePostalCode(value: string) {
  const match = value.match(/\d{4}/);
  return match?.[0] ?? "";
}

export function buildStreetLine(streetName: string, streetNumber: string) {
  return [streetName.trim(), streetNumber.trim()].filter(Boolean).join(" ");
}

export function splitStreetLine(value: string | null | undefined) {
  const street = value?.trim() ?? "";
  const match = street.match(/^(.*?)(\d+\w*)\s*$/);
  return {
    streetName: match?.[1]?.trim() || street,
    streetNumber: match?.[2]?.trim() || ""
  };
}

export function toCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(7) : "";
}

export function hasAddressGeolocation(form: AddressFormState) {
  return toCoordinate(form.latitude) !== null && toCoordinate(form.longitude) !== null;
}

export function buildAddressGeocodeRequest(form: AddressFormState) {
  const postalCode = extractArgentinePostalCode(form.postal_code);
  const province = form.province.trim();
  const locality = form.locality.trim();
  const streetName = form.street_name.trim();
  const streetNumber = form.street_number.trim();

  if (!postalCode || !province || !locality || !streetName || !streetNumber) {
    return null;
  }

  return {
    postal_code: postalCode,
    province,
    locality,
    street_name: streetName,
    street_number: streetNumber
  };
}

export function getAddressMissingFields(form: AddressFormState) {
  return [
    !extractArgentinePostalCode(form.postal_code) ? "CP" : null,
    !form.province.trim() ? "provincia" : null,
    !form.locality.trim() ? "localidad" : null,
    !form.street_name.trim() ? "calle" : null,
    !form.street_number.trim() ? "altura" : null
  ].filter((value): value is string => Boolean(value));
}
