export type CapacitySnapshot = {
  total_down_mbps: number;
  used_down_mbps: number;
  remaining_down_mbps: number;
  percent_used: number;
  total_up_mbps?: number;
  used_up_mbps?: number;
  remaining_up_mbps?: number;
  percent_used_down?: number;
  percent_used_up?: number;
  warn_80: boolean;
  reuse_ratio: number;

  plans_assigned_down_mbps?: number;
  plans_assigned_up_mbps?: number;
  plans_remaining_down_mbps?: number;
  plans_remaining_up_mbps?: number;
  plans_percent_assigned_down?: number;
  plans_percent_assigned_up?: number;

  clients_expected_used_down_mbps?: number;
  clients_expected_used_up_mbps?: number;
  clients_percent_used_down?: number;
  clients_percent_used_up?: number;
};
