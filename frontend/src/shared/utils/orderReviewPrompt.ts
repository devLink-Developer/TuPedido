const DISMISSED_ORDER_REVIEW_KEY = "kepedimos.order-review.dismissed";

export const ORDER_REVIEW_PROMPT_REFRESH_EVENT = "kepedimos.order-review.refresh";

export function getDismissedOrderReviewId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(DISMISSED_ORDER_REVIEW_KEY);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function dismissOrderReviewPrompt(orderId: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(DISMISSED_ORDER_REVIEW_KEY, String(orderId));
}

export function clearDismissedOrderReviewPrompt() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(DISMISSED_ORDER_REVIEW_KEY);
}

export function dispatchOrderReviewPromptRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ORDER_REVIEW_PROMPT_REFRESH_EVENT));
}
