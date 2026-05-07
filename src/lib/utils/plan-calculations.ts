export function formatMbps(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0 Mbps';
  if (v >= 1000) return `${(v / 1000).toFixed(2).replace(/\.00$/, '')} Gbps`;
  return `${Math.round(v)} Mbps`;
}

export function pct(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function parsePlanRatioDivisor(ratio: string | null | undefined): number {
  const raw = String(ratio ?? '').trim();
  const m = raw.match(/(\d+)\s*[:\/]\s*(\d+)/);
  if (!m) return 1;
  const div = Number(m[2] ?? 1);
  return Number.isFinite(div) && div > 0 ? Math.floor(div) : 1;
}

export function ratioDivisorFromMaxAndGuaranteed(maxMbps: number, guaranteedMbps: number): number {
  if (!Number.isFinite(maxMbps) || maxMbps <= 0) return 1;
  if (!Number.isFinite(guaranteedMbps) || guaranteedMbps <= 0) return 1;
  if (guaranteedMbps > maxMbps) return 1;
  return Math.max(1, Math.floor(maxMbps / guaranteedMbps));
}

export function ratioStringFromDivisor(divisor: number): string {
  const d = Number.isFinite(divisor) && divisor > 0 ? Math.floor(divisor) : 1;
  return `1:${Math.max(1, d)}`;
}

export function limitStringFromMbps(mbps: number): string {
  if (!Number.isFinite(mbps) || mbps <= 0) return '';
  return `${Math.round(mbps)}M`;
}

