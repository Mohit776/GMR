declare module 'react-native-razorpay' {
  export type RazorpayCheckoutOptions = {
    key: string;
    amount: string | number;
    currency: string;
    name: string;
    description?: string;
    image?: string;
    order_id: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      backdrop_color?: string;
    };
    retry?: {
      enabled?: boolean;
      max_count?: number;
    };
  };

  export type RazorpaySuccessResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  export type RazorpayErrorResponse = {
    code?: string | number;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };

  export default class RazorpayCheckout {
    static open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResponse>;
    static open(
      options: RazorpayCheckoutOptions,
      successCallback?: (data: RazorpaySuccessResponse) => void,
      errorCallback?: (error: RazorpayErrorResponse) => void
    ): Promise<RazorpaySuccessResponse>;
    static onExternalWalletSelection(callback: (data: unknown) => void): void;
  }
}
