<script lang="ts">
  // Toggle switch reutilizable. Sigue el patrón visual ya usado en
  // AutomationCard para mantener consistencia visual en el panel.
  let {
    checked = $bindable(false),
    disabled = false,
    size = 'md',
    ariaLabel = 'Toggle',
    onChange,
  }: {
    checked?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
    ariaLabel?: string;
    onChange?: (next: boolean) => void;
  } = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onChange?.(checked);
  }

  const dims = $derived(
    size === 'sm'
      ? { track: 'h-4 w-7', knob: 'h-3 w-3', onX: '0.875rem', offX: '0.125rem' }
      : { track: 'h-5 w-9', knob: 'h-3.5 w-3.5', onX: '1.125rem', offX: '0.125rem' }
  );
</script>

<button
  type="button"
  onclick={toggle}
  disabled={disabled}
  class="relative inline-flex {dims.track} shrink-0 items-center rounded-full transition-colors
    {checked ? 'bg-primary-500' : 'bg-neutral-700'}
    {disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}"
  aria-label={ariaLabel}
  role="switch"
  aria-checked={checked}
>
  <span
    class="inline-block {dims.knob} rounded-full bg-white transition-transform duration-200"
    style="transform: translateX({checked ? dims.onX : dims.offX})"
  ></span>
</button>
