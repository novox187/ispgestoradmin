export type ProviderStatus = 'active' | 'inactive';

export type Provider = {
  id: number;
  company_name: string;
  technical_support_contact?: string;
  support_phone?: string;
  support_email?: string;
  address?: string;
  payment_method?: string;
  account_number?: string;
  status: ProviderStatus;
  connections_count: number;
};

export type ConnectionStatus = 'active' | 'maintenance' | 'suspended' | 'canceled';

export type Connection = {
  id: number;
  isp_id: number;
  bandwidth_down: number;
  bandwidth_up: number;
  ratio: string;
  contract_date: string;
  billing_day: number;
  billing_cycle: string;
  monthly_price: number;
  interface_name?: string;
  status: ConnectionStatus;
  price_per_mb: number;
};

export type ConnectionCreate = {
  bandwidth_down: number;
  bandwidth_up: number;
  ratio: string;
  contract_date: string;
  billing_day: number;
  billing_cycle: string;
  monthly_price: number;
  interface_name?: string;
  status: ConnectionStatus;
};

