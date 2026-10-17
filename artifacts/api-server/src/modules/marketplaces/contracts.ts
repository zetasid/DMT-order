/**
 * Provider-neutral boundary for future marketplace adapters.
 * Implementations and credential handling are intentionally out of scope.
 */
export type OrderPaymentState = "unpaid" | "paid" | "failed" | "refunded";
export type OrderProcessingState =
  | "needs_processing"
  | "completed"
  | "cancelled";

export interface NormalizedMarketplaceOrder {
  externalOrderId: string;
  productName: string;
  sku: string;
  amountMinor: number;
  currency: string;
  paymentState: OrderPaymentState;
  processingState: OrderProcessingState;
}

export interface MarketplaceAdapter<Credentials = unknown> {
  readonly providerId: string;
  normalizeOrder(
    rawOrder: unknown,
    credentials: Credentials,
  ): Promise<NormalizedMarketplaceOrder>;
}
