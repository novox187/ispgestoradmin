<script lang="ts">
  type Accent = "default" | "success";
  let { title, value, accent = "default" }: { title: string; value: string; accent?: Accent } = $props();
</script>

<div class={"rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a1a1d] to-[#0b0b0d] p-5 shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 " + (accent === "success" ? "ring-1 ring-emerald-500/30" : "")}>
  <div class="text-xs uppercase tracking-wider text-gray-400">{title}</div>
  <div class={"mt-2 text-2xl font-semibold tracking-tight " + (accent === "success" ? "text-emerald-400" : "")}>{value}</div>
</div>
