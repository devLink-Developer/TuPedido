from __future__ import annotations

MERCADOPAGO_PAYMENT_CONCEPT_MAX_LENGTH = 256
PAYMENT_CONCEPT_PREFIX = "PAGO"
PAYMENT_CONCEPT_SUFFIX = ""
DEFAULT_PAYMENT_CONCEPT_STORE = "Comercio"


def _normalize_store_name(value: object) -> str:
    normalized = " ".join(str(value or "").split())
    return normalized or DEFAULT_PAYMENT_CONCEPT_STORE


def build_payment_concept(store_name: object, *, max_length: int = MERCADOPAGO_PAYMENT_CONCEPT_MAX_LENGTH) -> str:
    normalized_store_name = _normalize_store_name(store_name)
    concept = f"{PAYMENT_CONCEPT_PREFIX}{normalized_store_name}{PAYMENT_CONCEPT_SUFFIX}"
    if len(concept) <= max_length:
        return concept

    store_name_max_length = max_length - len(PAYMENT_CONCEPT_PREFIX) - len(PAYMENT_CONCEPT_SUFFIX)
    if store_name_max_length <= 0:
        return concept[:max_length].rstrip()

    truncated_store_name = normalized_store_name[:store_name_max_length].rstrip()
    return f"{PAYMENT_CONCEPT_PREFIX}{truncated_store_name}{PAYMENT_CONCEPT_SUFFIX}"
