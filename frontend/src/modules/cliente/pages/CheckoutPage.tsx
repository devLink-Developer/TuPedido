import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession, useCart } from "../../../shared/hooks";
import { checkout, createAddress, fetchAddresses, fetchStoreById } from "../../../shared/services/api";
import { useClienteStore } from "../../../shared/stores";
import type { Address, StoreDetail } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { notifyCustomerAddressesChanged } from "../../../shared/utils/customerAddresses";
import { normalizePath } from "../../../shared/utils/routing";
import { CheckoutSummary } from "../components/CheckoutSummary";
import { AddressFormCard, emptyAddressForm, hasAddressGeolocation, toAddressPayload, type AddressFormState } from "../components/AddressFormCard";

function hasMercadoPago(paymentSettings: StoreDetail["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

export function CheckoutPage() {
  const { cart } = useCart();
  const { token } = useAuthSession();
  const navigate = useNavigate();
  const selectedAddressId = useClienteStore((state) => state.selectedAddressId);
  const selectedPaymentMethod = useClienteStore((state) => state.selectedPaymentMethod);
  const setSelectedAddressId = useClienteStore((state) => state.setSelectedAddressId);
  const setSelectedPaymentMethod = useClienteStore((state) => state.setSelectedPaymentMethod);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !cart?.store_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([fetchAddresses(token), fetchStoreById(cart.store_id)])
      .then(([addressList, storeData]) => {
        if (cancelled) return;
        setAddresses(addressList);
        setStore(storeData);
        const geolocatedAddresses = addressList.filter((address) => address.latitude !== null && address.longitude !== null);
        const defaultAddress = geolocatedAddresses.find((address) => address.is_default) ?? geolocatedAddresses[0];
        setSelectedAddressId(cart.delivery_mode === "delivery" ? defaultAddress?.id ?? "" : "");
        setSelectedPaymentMethod(hasMercadoPago(storeData.payment_settings) ? "mercadopago" : "cash");
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
  }, [cart?.delivery_mode, cart?.store_id, setSelectedAddressId, setSelectedPaymentMethod, token]);

  const availableMethods = useMemo(() => {
    if (!store) return ["cash", "mercadopago"] as const;
    return [
      store.payment_settings.cash_enabled ? ("cash" as const) : null,
      hasMercadoPago(store.payment_settings) ? ("mercadopago" as const) : null
    ].filter(Boolean) as Array<"cash" | "mercadopago">;
  }, [store]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  if (!cart || !cart.items.length) {
    return (
      <EmptyState
        title="No hay items para pagar"
        description="Primero agrega productos al carrito."
        action={
          <Link className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white" to="/c">
            Volver al catalogo
          </Link>
        }
      />
    );
  }

  async function handleCreateAddress() {
    if (!token) return;
    if (
      !addressForm.label.trim() ||
      !addressForm.postal_code.trim() ||
      !addressForm.province.trim() ||
      !addressForm.locality.trim() ||
      !addressForm.street_name.trim() ||
      !addressForm.street_number.trim() ||
      !addressForm.details.trim()
    ) {
      setError("Completa etiqueta, CP, provincia, localidad, calle, altura y detalle de la direccion.");
      return;
    }
    if (!hasAddressGeolocation(addressForm)) {
      setError("Debes ubicar la direccion en el mapa antes de guardarla.");
      return;
    }

    const payload = toAddressPayload(addressForm);
    if (!payload) {
      setError("No se pudo leer la geolocalizacion seleccionada.");
      return;
    }

    setError(null);

    try {
      const created = await createAddress(token, payload);
      setAddresses((current) => [created, ...current]);
      setSelectedAddressId(created.id);
      setAddressForm(emptyAddressForm);
      setShowAddressForm(false);
      notifyCustomerAddressesChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la direccion");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !cart?.store_id) return;

    const currentCart = cart;
    const storeId = currentCart.store_id;
    if (storeId == null) return;

    if (currentCart.delivery_mode === "delivery" && !selectedAddressId) {
      setError("Selecciona una direccion para el envio");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await checkout(token, {
        store_id: storeId,
        address_id: currentCart.delivery_mode === "delivery" ? Number(selectedAddressId) : null,
        delivery_mode: currentCart.delivery_mode,
        payment_method: selectedPaymentMethod
      });

      if (result.checkout_url) {
        const path = normalizePath(result.checkout_url);
        if (path.startsWith("/")) {
          navigate(path);
        } else {
          window.location.assign(result.checkout_url);
        }
        return;
      }

      navigate(`/c/pedido/${result.order_id}`, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo completar el checkout");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Checkout" title="Confirmar pedido" description="Revisa tu direccion, tu metodo de pago y confirma tu pedido." />

      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Entrega</h3>
            <p className="mt-1 text-sm text-zinc-500">{cart.delivery_mode === "delivery" ? "Envio a domicilio" : "Retiro en local"}</p>

            {cart.delivery_mode === "delivery" ? (
              <div className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    disabled={address.latitude === null || address.longitude === null}
                    onClick={() => setSelectedAddressId(address.id)}
                    className={`block w-full rounded-[24px] border px-4 py-3 text-left text-sm ${
                      address.latitude === null || address.longitude === null
                        ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-900"
                        : selectedAddressId === address.id
                          ? "border-brand-500 bg-brand-50 text-brand-900"
                          : "border-black/10 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <p className="font-semibold">{address.label}</p>
                    <p className="mt-1 text-zinc-500">{address.street}</p>
                    {address.locality || address.province || address.postal_code ? (
                      <p className="mt-1 text-zinc-500">{[address.locality, address.province, address.postal_code].filter(Boolean).join(" - ")}</p>
                    ) : null}
                    <p className="mt-1 text-zinc-500">{address.details}</p>
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
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700"
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
                    onChange={setAddressForm}
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
            ) : (
              <p className="mt-4 rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-600">El pedido se retirara en {store?.name ?? cart.store_name}.</p>
            )}
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Pago</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(method)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    selectedPaymentMethod === method ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {method === "cash" ? "Efectivo" : "Mercado Pago"}
                </button>
              ))}
            </div>
          </div>

          {selectedAddress ? (
            <div className="rounded-[28px] bg-white p-5 text-sm text-zinc-600 shadow-sm">
              <h3 className="text-lg font-bold text-ink">Confirmacion</h3>
              <p className="mt-3">Direccion: {selectedAddress.street}</p>
              {selectedAddress.locality || selectedAddress.province || selectedAddress.postal_code ? (
                <p className="mt-1">{[selectedAddress.locality, selectedAddress.province, selectedAddress.postal_code].filter(Boolean).join(" - ")}</p>
              ) : null}
              <p className="mt-1">Detalle: {selectedAddress.details}</p>
            </div>
          ) : null}

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        </div>

        <aside className="space-y-4">
          <CheckoutSummary pricing={cart.pricing} title="Resumen del pedido" />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Confirmando..." : "Confirmar pedido"}
          </Button>
        </aside>
      </form>
    </div>
  );
}
