import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { OrderReviewModal } from "../components/OrderReviewModal";
import { createOrderReview, fetchPendingOrderReview } from "../services/api";
import { useAppFeedback } from "./AppFeedbackContext";
import { useAuth } from "./AuthContext";
import type { CreateOrderReviewPayload, PendingOrderReview } from "../types/api";
import { friendlyErrorMessage } from "../utils/apiMessages";

type OrderReviewPromptContextValue = {
  openReviewPrompt: (target: PendingOrderReview) => void;
  refreshPendingReview: () => Promise<void>;
};

const OrderReviewPromptContext = createContext<OrderReviewPromptContextValue | null>(null);

export function OrderReviewPromptProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const { showError, showSuccess } = useAppFeedback();
  const [target, setTarget] = useState<PendingOrderReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dismissedIds = useRef<Set<number>>(new Set());
  const isCustomer = user?.role === "customer";

  const openReviewPrompt = useCallback((nextTarget: PendingOrderReview) => {
    dismissedIds.current.delete(nextTarget.order_id);
    setTarget(nextTarget);
  }, []);

  const refreshPendingReview = useCallback(async () => {
    if (!token || !isCustomer || target || submitting) return;
    const pending = await fetchPendingOrderReview(token);
    if (!pending || dismissedIds.current.has(pending.order_id)) return;
    setTarget(pending);
  }, [isCustomer, submitting, target, token]);

  useEffect(() => {
    if (!token || !isCustomer) {
      setTarget(null);
      dismissedIds.current.clear();
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        if (!cancelled) await refreshPendingReview();
      } catch {
        // The prompt must never block navigation if the review endpoint is temporarily unavailable.
      }
    }

    void load();
    const timer = setInterval(() => void load(), 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [isCustomer, refreshPendingReview, token]);

  async function submitReview(payload: CreateOrderReviewPayload) {
    if (!token || !target) return;
    setSubmitting(true);
    try {
      await createOrderReview(token, target.order_id, payload);
      dismissedIds.current.add(target.order_id);
      setTarget(null);
      showSuccess("Gracias por calificar", "Tu opinión nos ayuda a mejorar KePedimos.");
      await refreshPendingReview();
    } catch (error) {
      showError("No pudimos guardar la calificación", friendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function closePrompt() {
    if (target) dismissedIds.current.add(target.order_id);
    setTarget(null);
  }

  return (
    <OrderReviewPromptContext.Provider value={{ openReviewPrompt, refreshPendingReview }}>
      {children}
      <OrderReviewModal visible={Boolean(target)} target={target} submitting={submitting} onClose={closePrompt} onSubmit={submitReview} />
    </OrderReviewPromptContext.Provider>
  );
}

export function useOrderReviewPrompt() {
  const value = useContext(OrderReviewPromptContext);
  if (!value) throw new Error("useOrderReviewPrompt must be used inside OrderReviewPromptProvider");
  return value;
}
