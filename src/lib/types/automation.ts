export type ScheduleType =
  | 'every_five_minutes'
  | 'every_ten_minutes'
  | 'every_fifteen_minutes'
  | 'every_thirty_minutes'
  | 'hourly'
  | 'daily'
  | 'monthly'
  | 'cron';

export interface ScheduleConfig {
  time?: string;
  day?: number;
  expression?: string;
}

export interface ParamSchemaField {
  type: 'integer' | 'decimal' | 'string' | 'boolean';
  label: string;
  description?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

export type ParamsSchema = Record<string, ParamSchemaField>;

export interface AutomationSetting {
  id: number;
  key: string;
  name: string;
  description: string | null;
  job_class: string;
  queue: string;
  enabled: boolean;
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig | null;
  params: Record<string, any> | null;
  params_schema: ParamsSchema | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationAudit {
  id: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  ip_address: string | null;
  created_at: string;
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  every_five_minutes: 'Cada 5 minutos',
  every_ten_minutes: 'Cada 10 minutos',
  every_fifteen_minutes: 'Cada 15 minutos',
  every_thirty_minutes: 'Cada 30 minutos',
  hourly: 'Cada hora',
  daily: 'Diariamente',
  monthly: 'Mensualmente',
  cron: 'Cron personalizado',
};
