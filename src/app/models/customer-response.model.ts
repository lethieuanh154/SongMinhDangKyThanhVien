export interface CustomerResponse {
  success: boolean;
  customer_code?: string;
  barcode_value?: string;
  name?: string;
  phone?: string;
  message?: string;
}

export interface SavedCustomer {
  customer_code: string;
  barcode_value: string;
  name: string;
  phone: string;
}
