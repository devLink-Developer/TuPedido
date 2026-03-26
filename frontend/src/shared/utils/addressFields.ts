export function splitStreetLine(street: string) {
  const compact = street.trim().replace(/\s+/g, " ");
  if (!compact) {
    return { streetName: "", streetNumber: "" };
  }

  const match = compact.match(/^(.*?)(?:\s+(\d[\w/-]*))$/);
  if (!match) {
    return { streetName: compact, streetNumber: "" };
  }

  return {
    streetName: match[1].trim() || compact,
    streetNumber: match[2].trim(),
  };
}

export function buildStreetLine(streetName: string, streetNumber: string) {
  return [streetName.trim(), streetNumber.trim()].filter(Boolean).join(" ");
}

export function buildStructuredAddress(
  streetName: string,
  streetNumber: string,
  locality?: string | null,
  province?: string | null,
  postalCode?: string | null
) {
  return [
    buildStreetLine(streetName, streetNumber),
    locality?.trim() ?? "",
    province?.trim() ?? "",
    postalCode?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function normalizePostalCodeInput(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 8);
}

export function extractArgentinePostalCode(value: string) {
  const match = normalizePostalCodeInput(value).match(/(\d{4})/);
  return match ? match[1] : "";
}

export function buildAddressGeocodeRequest(fields: {
  postal_code: string;
  province: string;
  locality: string;
  street_name: string;
  street_number: string;
}) {
  const postalCode = extractArgentinePostalCode(fields.postal_code);
  const province = fields.province.trim();
  const locality = fields.locality.trim();
  const streetName = fields.street_name.trim();
  const streetNumber = fields.street_number.trim();

  if (!postalCode || !province || !locality || !streetName || !streetNumber) {
    return null;
  }

  return {
    postal_code: postalCode,
    province,
    locality,
    street_name: streetName,
    street_number: streetNumber,
  };
}
