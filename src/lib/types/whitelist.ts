export interface WhitelistClient {
  id: number;
  full_name: string;
  document_id: string;
  email: string;
  service_status: string;
}

export interface WhitelistAuthorizer {
  id: number;
  nombre: string;
  email: string;
}

export interface WhitelistEntry {
  id: number;
  client_id: number;
  client: WhitelistClient | null;
  added_at: string | null;
  authorized_by: number | null;
  authorizer: WhitelistAuthorizer | null;
  reason: string;
  expires_at: string | null;
  active: boolean;
  is_valid: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface WhitelistHistoryEntry {
  id: number;
  operation: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user: { id: number; nombre: string; email: string | null } | null;
  ip_address: string | null;
  created_at: string;
}

export interface WhitelistCreatePayload {
  client_id: number;
  reason: string;
  expires_at?: string | null;
}

export interface WhitelistUpdatePayload {
  reason?: string;
  expires_at?: string | null;
}
