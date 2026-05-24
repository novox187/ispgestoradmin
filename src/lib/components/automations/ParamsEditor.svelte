<script lang="ts">
  import type { ParamsSchema } from '$lib/types/automation';
  import { Sliders, AlertCircle } from '@lucide/svelte';

  interface Props {
    schema: ParamsSchema;
    params: Record<string, any>;
    errors?: Record<string, string>;
    onChange: (params: Record<string, any>) => void;
  }

  let { schema, params, errors = {}, onChange }: Props = $props();

  const fields = $derived(Object.entries(schema));

  function update(field: string, value: any) {
    onChange({ ...params, [field]: value });
  }

  function onIntInput(field: string, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '') {
      update(field, null);
      return;
    }
    const n = parseInt(raw, 10);
    update(field, isNaN(n) ? raw : n);
  }

  function onDecimalInput(field: string, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '') {
      update(field, null);
      return;
    }
    const n = parseFloat(raw);
    update(field, isNaN(n) ? raw : n);
  }

  function liveValidate(field: string, value: any, rules: any): string {
    if (value === null || value === '') {
      if (rules.required) return 'Campo requerido';
      return '';
    }
    if (rules.type === 'integer') {
      const n = Number(value);
      if (!Number.isInteger(n)) return 'Debe ser un entero';
      if (rules.min !== undefined && n < rules.min) return `Debe ser >= ${rules.min}`;
      if (rules.max !== undefined && n > rules.max) return `Debe ser <= ${rules.max}`;
    }
    if (rules.type === 'decimal') {
      const n = Number(value);
      if (!Number.isFinite(n)) return 'Debe ser un número';
      if (rules.min !== undefined && n < rules.min) return `Debe ser >= ${rules.min}`;
      if (rules.max !== undefined && n > rules.max) return `Debe ser <= ${rules.max}`;
    }
    return '';
  }

  const inputBase = 'w-full rounded-lg border px-3 py-2 text-sm text-white bg-neutral-900 border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/60 transition-colors';
  const inputError = 'w-full rounded-lg border px-3 py-2 text-sm text-white bg-neutral-900 border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/60 transition-colors';
</script>

{#if fields.length === 0}
  <p class="text-xs text-neutral-600 italic">Esta automatización no tiene parámetros configurables.</p>
{:else}
  <div class="space-y-3">
    {#each fields as [field, rules]}
      {@const value = params[field] ?? ''}
      {@const liveError = liveValidate(field, value, rules)}
      {@const serverError = errors[field] ?? ''}
      {@const errorMsg = serverError || liveError}

      <div>
        <label class="flex items-center justify-between text-xs font-medium text-neutral-400 mb-1.5">
          <span class="flex items-center gap-1.5">
            <Sliders class="w-3 h-3" />
            {rules.label}
            {#if rules.required}
              <span class="text-red-400">*</span>
            {/if}
          </span>
          {#if (rules.type === 'integer' || rules.type === 'decimal') && rules.min !== undefined && rules.max !== undefined}
            <span class="text-[10px] font-mono text-neutral-600">{rules.min}–{rules.max}</span>
          {/if}
        </label>

        {#if rules.type === 'integer'}
          <input
            type="number"
            min={rules.min}
            max={rules.max}
            class={errorMsg ? inputError : inputBase}
            value={value}
            oninput={(e) => onIntInput(field, e)}
          />
        {:else if rules.type === 'decimal'}
          <input
            type="number"
            step="0.01"
            min={rules.min}
            max={rules.max}
            class={errorMsg ? inputError : inputBase}
            value={value}
            oninput={(e) => onDecimalInput(field, e)}
          />
        {:else if rules.type === 'boolean'}
          <label class="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onchange={(e) => update(field, (e.target as HTMLInputElement).checked)}
              class="rounded border-neutral-600 bg-neutral-900 text-primary-500 focus:ring-primary-500/40"
            />
            <span class="text-xs text-neutral-400">{value ? 'Activado' : 'Desactivado'}</span>
          </label>
        {:else}
          <input
            type="text"
            class={errorMsg ? inputError : inputBase}
            value={value}
            oninput={(e) => update(field, (e.target as HTMLInputElement).value)}
          />
        {/if}

        {#if rules.description}
          <p class="mt-1 text-[10px] text-neutral-600">{rules.description}</p>
        {/if}

        {#if errorMsg}
          <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle class="w-3 h-3" />
            {errorMsg}
          </p>
        {/if}
      </div>
    {/each}
  </div>
{/if}
