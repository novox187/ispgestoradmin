// Tipos del módulo de notificaciones del servidor.
// Espejan los DTOs expuestos por App\Http\Controllers\Admin\NotificationSettingsController.

export type ChannelStatus = 'available' | 'coming_soon';

export interface CredentialField {
  key: string;
  label: string;
  sensitive: boolean;
  required: boolean;
  placeholder?: string;
}

export interface SettingFieldOption {
  value: string;
  label: string;
}

export interface SettingField {
  key: string;
  label: string;
  type?: 'text' | 'select';
  sensitive?: boolean;
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: SettingFieldOption[];
}

export interface ChannelCatalogEntry {
  key: string;
  label: string;
  status: ChannelStatus;
  description: string;
  credentials_schema: CredentialField[];
  settings_schema: SettingField[];
}

export interface CategoryItem {
  key: string;
  label: string;
  description: string;
  default_severity: 'critical' | 'summary' | 'info';
}

export interface CategoryGroup {
  group: string;
  group_label: string;
  items: CategoryItem[];
}

export interface NotificationCatalog {
  channels: ChannelCatalogEntry[];
  categories: CategoryGroup[];
  severities: string[];
}

export interface ChannelState {
  key: string;
  label: string;
  status: ChannelStatus;
  description: string;
  enabled: boolean;
  credentials_schema: CredentialField[];
  settings_schema: SettingField[];
  // Las credenciales/settings sensibles vienen enmascaradas como "********".
  credentials: Record<string, string | null>;
  settings: Record<string, string | null>;
  has_db_override: boolean;
}

export interface EventRoute {
  category: string;
  channel_key: string;
  enabled: boolean;
  address_override: string | null;
  extra: Record<string, unknown> | null;
}

export interface NotificationLogRow {
  id: number;
  notification_id: string;
  category: string;
  severity: string;
  channel: string;
  recipient: string;
  title: string;
  status: 'pending' | 'sent' | 'failed' | 'duplicated' | 'exhausted';
  attempts: number;
  external_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface SendTestResult {
  message: string;
  logs_sent?: number;
  last_log_status?: string | null;
  last_log_error?: string | null;
}
