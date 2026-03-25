export type PricingSummary = {
  subtotal: number | null;
  commercialDiscountTotal: number | null;
  financialDiscountTotal: number | null;
  deliveryFee: number | null;
  serviceFee: number | null;
  total: number | null;
  complete: boolean;
};
