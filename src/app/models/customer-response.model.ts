export interface CustomerResponse {
  success: boolean;
  customer_code?: string;
  barcode_value?: string;
  name?: string;
  phone?: string;
  message?: string;
  existing?: boolean;
}

export interface ZaloCallbackResponse {
  zalo_user_id: string;
  name: string;
  phone: string | null;
}

export interface ZaloLoginResponse {
  oauth_url: string;
}

export interface SavedCustomer {
  customer_code: string;
  barcode_value: string;
  name: string;
  phone: string;
}

export interface ZaloSession {
  zalo_user_id: string;
  name: string;
  phone?: string;
}
