import type { StorePaymentSettings } from "../types";

export type MercadoPagoConnectionStatus = NonNullable<StorePaymentSettings["mercadopago_connection_status"]>;

export type MercadoPagoDerivedState = {
  status: MercadoPagoConnectionStatus;
  canOperate: boolean;
  customerAvailable: boolean;
  reason: string | null;
};

export function deriveMercadoPagoState(paymentSettings: StorePaymentSettings): MercadoPagoDerivedState {
  const status =
    paymentSettings.mercadopago_connection_status ??
    (paymentSettings.mercadopago_configured ? "connected" : "disconnected");
  const reconnectRequired = status === "reconnect_required" || Boolean(paymentSettings.mercadopago_reconnect_required);
  const onboardingPending =
    status === "onboarding_pending" ||
    (status === "connected" && paymentSettings.mercadopago_onboarding_completed === false);

  let reason: string | null = null;
  if (!paymentSettings.mercadopago_provider_enabled) {
    reason = "Mercado Pago esta desactivado por la plataforma.";
  } else if (reconnectRequired) {
    reason = "El comercio debe reconectar su cuenta de Mercado Pago.";
  } else if (onboardingPending) {
    reason = "El comercio debe completar el onboarding de Mercado Pago.";
  } else if (status !== "connected" || !paymentSettings.mercadopago_configured) {
    reason = "El comercio todavia no conecto una cuenta de Mercado Pago.";
  }

  const canOperate = reason === null;
  return {
    status: reconnectRequired ? "reconnect_required" : onboardingPending ? "onboarding_pending" : status,
    canOperate,
    customerAvailable: canOperate && paymentSettings.mercadopago_enabled,
    reason
  };
}

