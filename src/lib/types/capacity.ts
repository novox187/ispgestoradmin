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
};
