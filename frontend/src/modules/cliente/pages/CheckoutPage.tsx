import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession, useCart } from "../../../shared/hooks";
import { checkout, createAddress, fetchAddresses, fetchStoreById } from "../../../shared/services/api";
import { ApiError } from "../../../shared/services/api/client";
import { useClienteStore } from "../../../shared/stores";
import type { Address, StoreDetail } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { notifyCustomerAddressesChanged } from "../../../shared/utils/customerAddresses";
import { formatCurrency } from "../../../shared/utils/format";
import { deriveMercadoPagoState } from "../../../shared/utils/mercadopago";
import { normalizePath } from "../../../shared/utils/routing";
import {
  AddressFormCard,
  emptyAddressForm,
  getAddressMissingFields,
  hasAddressGeolocation,
  toAddressPayload,
  type AddressFormState,
} from "../components/AddressFormCard";

function hashCheckoutSignature(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildCheckoutAttemptSignature(
  cart: NonNullable<ReturnType<typeof useCart>["cart"]>,
  selectedPaymentMethod: "cash" | "mercadopago",
  selectedAddressId: number | ""
) {
  const items = cart.items.map((item) => [item.product_id, item.quantity, item.note ?? ""].join(":")).join("|");
  return hashCheckoutSignature(
    JSON.stringify({
      store_id: cart.store_id,
      delivery_mode: cart.delivery_mode,
      address_id: cart.delivery_mode === "delivery" ? selectedAddressId : null,
      payment_method: selectedPaymentMethod,
      items
    })
  );
}

function createCheckoutIdempotencyKey(storeId: number) {
  const randomValue =
    typeof window !== "undefined" && window.crypto && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `checkout_${storeId}_${randomValue}`;
}

function readCheckoutIdempotencyKey(signature: string, storeId: number) {
  const storageKey = `checkout_idempotency_${signature}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const next = createCheckoutIdempotencyKey(storeId);
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

function clearCheckoutIdempotencyKey(signature: string) {
  window.sessionStorage.removeItem(`checkout_idempotency_${signature}`);
}

function formatMissingAddressFields(fields: string[]) {
  if (!fields.length) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0];
  }

  return `${fields.slice(0, -1).join(", ")} y ${fields[fields.length - 1]}`;
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function CheckoutPage() {
  const { cart, resetCart, setDeliveryMode } = useCart();
  const { token } = useAuthSession();
  const navigate = useNavigate();
  const selectedAddressId = useClienteStore((state) => state.selectedAddressId);
  const selectedPaymentMethod = useClienteStore((state) => state.selectedPaymentMethod);
  const customerLocation = useClienteStore((state) => state.customerLocation);
  const setSelectedAddressId = useClienteStore((state) => state.setSelectedAddressId);
  const setSelectedPaymentMethod = useClienteStore((state) => state.setSelectedPaymentMethod);
  const setCustomerLocation = useClienteStore((state) => state.setCustomerLocation);
  const resetCheckout = useClienteStore((state) => state.resetCheckout);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [paymentRedirectUrl, setPaymentRedirectUrl] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !cart?.store_id) {
      setLoading(false);
      return;
    }
    const cartStoreId = cart.store_id;
    const cartDeliveryMode = cart.delivery_mode;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAddresses(token)
      .then(async (addressList) => {
        if (cancelled) return;
        setAddresses(addressList);
        const geolocatedAddresses = addressList.filter((address) => address.latitude !== null && address.longitude !== null);
        const selectedCatalogAddress =
          typeof selectedAddressId === "number"
            ? geolocatedAddresses.find((address) => address.id === selectedAddressId)
            : null;
        const defaultAddress = selectedCatalogAddress ?? geolocatedAddresses.find((address) => address.is_default) ?? geolocatedAddresses[0];
        const checkoutLocation =
          cartDeliveryMode === "delivery"
            ? defaultAddress
              ? { latitude: defaultAddress.latitude, longitude: defaultAddress.longitude, source: "address" as const }
              : null
            : customerLocation ??
              (defaultAddress
                ? { latitude: defaultAddress.latitude, longitude: defaultAddress.longitude, source: "address" as const }
                : null);
        setSelectedAddressId(cartDeliveryMode === "delivery" ? defaultAddress?.id ?? "" : "");
        if (checkoutLocation && checkoutLocation.latitude !== null && checkoutLocation.longitude !== null && !customerLocation) {
          setCustomerLocation({
            latitude: checkoutLocation.latitude,
            longitude: checkoutLocation.longitude,
            source: checkoutLocation.source
          });
        }
        const coverageLatitude = checkoutLocation?.latitude;
        const coverageLongitude = checkoutLocation?.longitude;
        if (coverageLatitude == null || coverageLongitude == null) {
          setStore(null);
          if (cartDeliveryMode === "pickup") {
            setError("Define tu ubicacion para validar si puedes retirar en este comercio.");
          }
          return;
        }
        const storeData = await fetchStoreById(cartStoreId, {
          latitude: coverageLatitude,
          longitude: coverageLongitude,
          deliveryMode: cartDeliveryMode
        });
        if (cancelled) return;
        setStore(storeData);
        const mercadoPagoState = deriveMercadoPagoState(storeData.payment_settings);
        setSelectedPaymentMethod(mercadoPagoState.customerAvailable ? "mercadopago" : storeData.payment_settings.cash_enabled ? "cash" : "mercadopago");
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo preparar el checkout");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cart?.delivery_mode, cart?.store_id, customerLocation, selectedAddressId, setCustomerLocation, setSelectedAddressId, setSelectedPaymentMethod, token]);

  const paymentOptions = useMemo(() => {
    if (!store) {
      return [
        { method: "cash" as const, available: true, reason: null },
        { method: "mercadopago" as const, available: true, reason: null }
      ];
    }
    const mercadoPagoState = deriveMercadoPagoState(store.payment_settings);
    return [
      {
        method: "cash" as const,
        available: store.payment_settings.cash_enabled,
        reason: store.payment_settings.cash_enabled ? null : "El comercio no acepta efectivo."
      },
      {
        method: "mercadopago" as const,
        available: mercadoPagoState.customerAvailable,
        reason: mercadoPagoState.customerAvailable ? null : mercadoPagoState.reason
      }
    ];
  }, [store]);
  const availableMethods = useMemo(
    () => paymentOptions.filter((option) => option.available).map((option) => option.method),
    [paymentOptions]
  );
  const availableDeliveryModes = useMemo(() => {
    if (!cart) return [];
    return [
      cart.delivery_settings?.delivery_enabled ? ("delivery" as const) : null,
      cart.delivery_settings?.pickup_enabled ? ("pickup" as const) : null
    ].filter(Boolean) as Array<"delivery" | "pickup">;
  }, [cart]);

  useEffect(() => {
    if (!store || availableMethods.includes(selectedPaymentMethod)) return;
    setPaymentRedirectUrl(null);
    setSelectedPaymentMethod(availableMethods[0] ?? "cash");
  }, [availableMethods, selectedPaymentMethod, setSelectedPaymentMethod, store]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  async function handleDeliveryModeChange(nextMode: "delivery" | "pickup") {
    if (!cart || cart.delivery_mode === nextMode) return;
    setError(null);
    setPaymentRedirectUrl(null);

    const selectedAddressForMode = addresses.find((address) => address.id === selectedAddressId) ?? null;
    const location =
      nextMode === "delivery"
        ? selectedAddressForMode?.latitude != null && selectedAddressForMode.longitude != null
          ? { latitude: selectedAddressForMode.latitude, longitude: selectedAddressForMode.longitude }
          : null
        : customerLocation ??
          (selectedAddressForMode?.latitude != null && selectedAddressForMode.longitude != null
            ? { latitude: selectedAddressForMode.latitude, longitude: selectedAddressForMode.longitude }
            : null);

    if (!location) {
      setError(nextMode === "delivery" ? "Selecciona una direccion con pin." : "Define tu ubicacion para validar la zona de retiro.");
      return;
    }

    await setDeliveryMode(nextMode, location);
  }

  async function handleAddressSelect(address: Address) {
    setSelectedAddressId(address.id);
    setPaymentRedirectUrl(null);
    if (address.latitude == null || address.longitude == null) return;
    setCustomerLocation({ latitude: address.latitude, longitude: address.longitude, source: "address" });
    if (cart?.delivery_mode === "delivery") {
      await setDeliveryMode("delivery", { latitude: address.latitude, longitude: address.longitude });
    }
  }

  if (!cart || !cart.items.length) {
    return (
      <EmptyState
        title="No hay items para pagar"
        description="Primero agrega productos al carrito."
        action={
          <Link className="app-button min-h-[48px] px-4 py-2 text-sm" to="/c">
            Volver al catalogo
          </Link>
        }
      />
    );
  }

  async function handleCreateAddress(nextForm: AddressFormState) {
    if (!token) return;
    const missingFields = getAddressMissingFields(nextForm);
    if (missingFields.length) {
      setError(`Completa ${formatMissingAddressFields(missingFields)}.`);
      return;
    }
    if (!hasAddressGeolocation(nextForm)) {
      setError("No pudimos ubicar la direccion todavia. Revisa calle y altura o ajusta el pin en el mapa.");
      return;
    }

    const payload = toAddressPayload(nextForm);
    if (!payload) {
      setError("No se pudo leer la geolocalizacion seleccionada.");
      return;
    }

    setError(null);

    try {
      const created = await createAddress(token, payload);
      setAddresses((current) => [created, ...current]);
      setSelectedAddressId(created.id);
      if (created.latitude !== null && created.longitude !== null) {
        setCustomerLocation({ latitude: created.latitude, longitude: created.longitude, source: "address" });
      }
      setAddressForm(emptyAddressForm);
      setShowAddressForm(false);
      notifyCustomerAddressesChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la direccion");
    }
  }

  function requestGpsLocation() {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite obtener ubicacion GPS.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "gps"
        } as const;
        setCustomerLocation(nextLocation);
        if (cart?.delivery_mode === "pickup") {
          void setDeliveryMode("pickup", nextLocation);
        }
        setLoading(false);
      },
      () => {
        setError("No pudimos obtener tu ubicacion. Revisa permisos o carga una direccion.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }

  function openExternalPayment(url: string) {
    setRedirectingToPayment(true);
    setError(null);
    try {
      window.location.assign(url);
      window.setTimeout(() => {
        setRedirectingToPayment(false);
        setError("No pudimos abrir Mercado Pago automaticamente. Toca Abrir Mercado Pago para continuar.");
      }, 2500);
    } catch {
      setRedirectingToPayment(false);
      setError("No pudimos abrir Mercado Pago automaticamente. Toca Abrir Mercado Pago para continuar.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !cart?.store_id) return;
    if (paymentRedirectUrl) {
      openExternalPayment(paymentRedirectUrl);
      return;
    }

    const currentCart = cart;
    const storeId = currentCart.store_id;
    if (storeId == null) return;

    if (currentCart.delivery_mode === "delivery" && !selectedAddressId) {
      setError("Selecciona una direccion para el envio");
      return;
    }
    if (currentCart.delivery_mode === "delivery" && (selectedAddress?.latitude == null || selectedAddress.longitude == null)) {
      setError("La direccion seleccionada debe tener geolocalizacion.");
      return;
    }
    if (currentCart.delivery_mode === "pickup" && !customerLocation) {
      setError("Define tu ubicacion para validar la zona de retiro.");
      return;
    }
    if (!availableMethods.length) {
      setError("El comercio no tiene medios de pago disponibles en este momento.");
      return;
    }
    if (!availableMethods.includes(selectedPaymentMethod)) {
      setError("Selecciona un medio de pago disponible.");
      return;
    }

    setSubmitting(true);
    setRedirectingToPayment(false);
    setPaymentRedirectUrl(null);
    setError(null);

    const checkoutAttemptSignature = buildCheckoutAttemptSignature(
      currentCart,
      selectedPaymentMethod,
      selectedAddressId
    );
    const idempotencyKey = readCheckoutIdempotencyKey(checkoutAttemptSignature, storeId);

    try {
      const result = await checkout(token, {
        store_id: storeId,
        address_id: currentCart.delivery_mode === "delivery" ? Number(selectedAddressId) : null,
        delivery_mode: currentCart.delivery_mode,
        payment_method: selectedPaymentMethod,
        idempotency_key: idempotencyKey,
        customer_latitude:
          currentCart.delivery_mode === "delivery" ? selectedAddress?.latitude ?? null : customerLocation?.latitude ?? null,
        customer_longitude:
          currentCart.delivery_mode === "delivery" ? selectedAddress?.longitude ?? null : customerLocation?.longitude ?? null
      });

      if (result.checkout_url) {
        const path = normalizePath(result.checkout_url);
        if (path.startsWith("/")) {
          clearCheckoutIdempotencyKey(checkoutAttemptSignature);
          resetCart();
          resetCheckout();
          navigate(path);
        } else {
          setPaymentRedirectUrl(result.checkout_url);
          openExternalPayment(result.checkout_url);
        }
        return;
      }

      clearCheckoutIdempotencyKey(checkoutAttemptSignature);
      resetCart();
      resetCheckout();
      navigate(`/c/pedido/${result.order_id}`, { replace: true });
    } catch (requestError) {
      setPaymentRedirectUrl(null);
      if (requestError instanceof ApiError && selectedPaymentMethod === "mercadopago") {
        const fallback = availableMethods.includes("cash") ? " Puedes elegir efectivo y volver a confirmar." : "";
        if (requestError.status === 409) {
          setError(`Mercado Pago ya no esta disponible para este comercio.${fallback}`);
        } else if (requestError.status === 502) {
          setError(`Mercado Pago no respondio correctamente. Intenta de nuevo en unos segundos.${fallback}`);
        } else {
          setError(`${requestError.message}${fallback}`);
        }
      } else {
        setError(requestError instanceof Error ? requestError.message : "No se pudo completar el checkout");
      }
      setRedirectingToPayment(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingCard />;

  const commercialDiscount = numberOrZero(cart.pricing.commercialDiscountTotal);
  const financialDiscount = numberOrZero(cart.pricing.financialDiscountTotal);
  const deliveryFee = cart.delivery_mode === "delivery" ? numberOrZero(cart.pricing.deliveryFee) : 0;
  const serviceFee = numberOrZero(cart.pricing.serviceFee);
  const productsTotal = Math.max(0, numberOrZero(cart.pricing.subtotal) - commercialDiscount - financialDiscount);
  const checkoutTotal = productsTotal + deliveryFee + serviceFee;
  const selectedPaymentLabel = selectedPaymentMethod === "cash" ? "Efectivo" : "Mercado Pago";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Checkout" title="Confirmar pedido" />

      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="app-panel p-5">
            <h3 className="text-lg font-bold">Entrega</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["delivery", "pickup"] as const).map((mode) => {
                const available = availableDeliveryModes.includes(mode);
                const active = cart.delivery_mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={!available || submitting || redirectingToPayment}
                    onClick={() => void handleDeliveryModeChange(mode)}
                    className={`min-h-14 border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-900"
                        : available
                          ? "border-black/10 bg-zinc-50 text-zinc-700 hover:border-brand-200"
                          : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                    }`}
                    style={{ borderRadius: 18 }}
                  >
                    {mode === "delivery" ? "Envio" : "Retiro"}
                  </button>
                );
              })}
            </div>
          </div>

          {cart.delivery_mode === "delivery" ? (
            <div className="app-panel p-5">
              <h3 className="text-lg font-bold">Direccion</h3>
              <div className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    disabled={address.latitude === null || address.longitude === null}
                    onClick={() => void handleAddressSelect(address)}
                    className={`block w-full border px-4 py-3 text-left text-sm ${
                      address.latitude === null || address.longitude === null
                        ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-900"
                        : selectedAddressId === address.id
                          ? "border-brand-500 bg-brand-50 text-brand-900"
                          : "border-black/10 bg-zinc-50 text-zinc-700"
                    }`}
                    style={{ borderRadius: 18 }}
                  >
                    <p className="font-semibold">{address.label}</p>
                    <p className="mt-1 text-zinc-500">{address.street}</p>
                    {address.locality || address.province || address.postal_code ? (
                      <p className="mt-1 text-zinc-500">{[address.locality, address.province, address.postal_code].filter(Boolean).join(" - ")}</p>
                    ) : null}
                    {address.details ? <p className="mt-1 text-zinc-500">{address.details}</p> : null}
                    {address.latitude === null || address.longitude === null ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Requiere geolocalizacion. Editala desde tu perfil.
                      </p>
                    ) : null}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowAddressForm((current) => !current)}
                  className="kp-soft-action min-h-[44px] px-4 py-2 text-sm"
                >
                  {showAddressForm ? "Cancelar" : "Agregar direccion"}
                </button>

                {showAddressForm ? (
                  <AddressFormCard
                    title="Nueva direccion"
                    submitLabel="Guardar direccion"
                    lookupToken={token}
                    form={addressForm}
                    error={error}
                    onChange={(value) => {
                      setAddressForm(value);
                      setError(null);
                    }}
                    onSubmit={handleCreateAddress}
                    onCancel={() => {
                      setShowAddressForm(false);
                      setAddressForm(emptyAddressForm);
                      setError(null);
                    }}
                  />
                ) : null}

                {!addresses.length && !showAddressForm ? <p className="text-sm text-zinc-500">Aun no tienes direcciones guardadas.</p> : null}
              </div>
            </div>
          ) : (
            <div className="app-panel p-5">
              <h3 className="text-lg font-bold">Retiro</h3>
              <p className="mt-3 text-sm font-semibold text-zinc-700">{store?.name ?? cart.store_name}</p>
              {!customerLocation ? (
                <button type="button" onClick={requestGpsLocation} className="kp-soft-action mt-4 min-h-[44px] px-4 py-2 text-sm">
                  Usar mi ubicacion
                </button>
              ) : null}
            </div>
          )}

          <div className="app-panel p-5">
            <h3 className="text-lg font-bold">Pago</h3>
            <fieldset className="mt-4 grid gap-3" role="radiogroup" aria-label="Metodo de pago">
              <legend className="sr-only">Metodo de pago</legend>
              {paymentOptions.map(({ method, available, reason }) => (
                <label
                  key={method}
                  className={`min-h-14 border px-4 py-3 text-left text-sm transition focus-within:ring-2 focus-within:ring-brand-400 ${
                    selectedPaymentMethod === method
                      ? "border-brand-500 bg-brand-50 text-brand-900"
                      : available
                        ? "border-black/10 bg-zinc-50 text-zinc-700 hover:border-brand-200"
                        : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                  }`}
                  style={{ borderRadius: 18 }}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method}
                    checked={selectedPaymentMethod === method}
                    disabled={!available}
                    onChange={() => {
                      setSelectedPaymentMethod(method);
                      setPaymentRedirectUrl(null);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{method === "cash" ? "Efectivo" : "Mercado Pago"}</span>
                    <span className={`h-4 w-4 rounded border ${selectedPaymentMethod === method ? "border-brand-500 bg-brand-500" : "border-zinc-300 bg-white"}`} />
                  </span>
                  {reason ? <span className="mt-1 block text-xs text-zinc-500">{reason}</span> : null}
                </label>
              ))}
            </fieldset>
            {!availableMethods.length ? (
              <p className="mt-3 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                El comercio no tiene medios de pago disponibles.
              </p>
            ) : null}
          </div>

          {error ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
        </div>

        <aside className="space-y-4">
          <div className="app-panel p-5">
            <h3 className="text-lg font-bold">Resumen</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <div className="flex items-center justify-between gap-4">
                <span>Modalidad</span>
                <span className="font-semibold text-ink">{cart.delivery_mode === "delivery" ? "Envio" : "Retiro"}</span>
              </div>
              {cart.delivery_mode === "delivery" ? (
                <div className="flex items-center justify-between gap-4">
                  <span>Direccion</span>
                  <span className="max-w-[12rem] text-right font-semibold text-ink">{selectedAddress?.street ?? ""}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span>Pago</span>
                <span className="font-semibold text-ink">{selectedPaymentLabel}</span>
              </div>
              <div className="border-t border-black/5 pt-3" />
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(numberOrZero(cart.pricing.subtotal))}</span>
              </div>
              {commercialDiscount > 0 ? (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Descuentos del comercio</span>
                  <span>-{formatCurrency(commercialDiscount)}</span>
                </div>
              ) : null}
              {financialDiscount > 0 ? (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Promociones</span>
                  <span>-{formatCurrency(financialDiscount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>{cart.delivery_mode === "delivery" ? "Envio" : "Retiro"}</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicio</span>
                <span>{formatCurrency(serviceFee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base font-bold text-ink">
                <span>Total a pagar</span>
                <span>{formatCurrency(checkoutTotal)}</span>
              </div>
            </div>
          </div>
          <Button
            type={paymentRedirectUrl ? "button" : "submit"}
            className="w-full"
            disabled={submitting || redirectingToPayment || !availableMethods.length}
            onClick={paymentRedirectUrl ? () => openExternalPayment(paymentRedirectUrl) : undefined}
          >
            {redirectingToPayment
              ? "Abriendo Mercado Pago..."
              : paymentRedirectUrl
                ? "Abrir Mercado Pago"
                : submitting
                  ? "Confirmando..."
                  : "Confirmar pedido"}
          </Button>
        </aside>
      </form>
    </div>
  );
}
