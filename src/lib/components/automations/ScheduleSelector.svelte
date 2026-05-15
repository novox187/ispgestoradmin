<script lang="ts">
  import type { ScheduleType, ScheduleConfig } from '$lib/types/automation';
  import { SCHEDULE_TYPE_LABELS } from '$lib/types/automation';
  import { Clock, AlertCircle } from '@lucide/svelte';

  interface Props {
    scheduleType: ScheduleType;
    scheduleConfig: ScheduleConfig;
    errors?: Record<string, string>;
    onChange: (type: ScheduleType, config: ScheduleConfig) => void;
  }

  let { scheduleType, scheduleConfig, errors = {}, onChange }: Props = $props();

  const options: { value: ScheduleType; label: string }[] = Object.entries(SCHEDULE_TYPE_LABELS).map(
    ([value, label]) => ({ value: value as ScheduleType, label }),
  );

  function onTypeChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value as ScheduleType;
    let newConfig: ScheduleConfig = {};
    if (v === 'daily') newConfig = { time: '02:00' };
    else if (v === 'monthly') newConfig = { day: 1, time: '01:00' };
    else if (v === 'cron') newConfig = { expression: '0 * * * *' };
    onChange(v, newConfig);
  }

  function onTimeChange(e: Event) {
    onChange(scheduleType, { ...scheduleConfig, time: (e.target as HTMLInputElement).value });
  }

  function onDayChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    onChange(scheduleType, { ...scheduleConfig, day: isNaN(val) ? 1 : val });
  }

  function onCronChange(e: Event) {
    onChange(scheduleType, { ...scheduleConfig, expression: (e.target as HTMLInputElement).value });
  }

  const inputBase = 'w-full rounded-lg border px-3 py-2 text-sm text-white bg-neutral-900 border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/60 transition-colors';
  const inputError = 'w-full rounded-lg border px-3 py-2 text-sm text-white bg-neutral-900 border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/60 transition-colors';
</script>

<div class="space-y-3">
  <div>
    <label class="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-1.5">
      <Clock class="w-3.5 h-3.5" />
      Frecuencia
    </label>
    <select
      class={errors['schedule_type'] ? inputError : inputBase}
      value={scheduleType}
      onchange={onTypeChange}
    >
      {#each options as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    {#if errors['schedule_type']}
      <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
        <AlertCircle class="w-3 h-3" />
        {errors['schedule_type']}
      </p>
    {/if}
  </div>

  {#if scheduleType === 'daily'}
    <div>
      <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Hora (HH:MM, 24h)</label>
      <input
        type="time"
        class={errors['schedule_config.time'] ? inputError : inputBase}
        value={scheduleConfig.time ?? '02:00'}
        oninput={onTimeChange}
      />
      {#if errors['schedule_config.time']}
        <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle class="w-3 h-3" />
          {errors['schedule_config.time']}
        </p>
      {/if}
    </div>
  {/if}

  {#if scheduleType === 'monthly'}
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Día del mes (1-28)</label>
        <input
          type="number"
          min="1"
          max="28"
          class={errors['schedule_config.day'] ? inputError : inputBase}
          value={scheduleConfig.day ?? 1}
          oninput={onDayChange}
        />
        {#if errors['schedule_config.day']}
          <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle class="w-3 h-3" />
            {errors['schedule_config.day']}
          </p>
        {/if}
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Hora</label>
        <input
          type="time"
          class={errors['schedule_config.time'] ? inputError : inputBase}
          value={scheduleConfig.time ?? '01:00'}
          oninput={onTimeChange}
        />
        {#if errors['schedule_config.time']}
          <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle class="w-3 h-3" />
            {errors['schedule_config.time']}
          </p>
        {/if}
      </div>
    </div>
  {/if}

  {#if scheduleType === 'cron'}
    <div>
      <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Expresión cron (5 campos)</label>
      <input
        type="text"
        placeholder="0 * * * *"
        class="font-mono {errors['schedule_config.expression'] ? inputError : inputBase}"
        value={scheduleConfig.expression ?? ''}
        oninput={onCronChange}
      />
      <p class="mt-1 text-[10px] text-neutral-600">
        Formato: <span class="font-mono">minuto hora día mes día-semana</span>
      </p>
      {#if errors['schedule_config.expression']}
        <p class="mt-1 flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle class="w-3 h-3" />
          {errors['schedule_config.expression']}
        </p>
      {/if}
    </div>
  {/if}
</div>
