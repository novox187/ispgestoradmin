<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';
  import type { Provider } from '$lib/types/proveedores';

  const props = $props<{ open: boolean; isp: Provider | null; onClose: () => void; onSave?: (isp: Provider) => Promise<Provider | void> }>();

  let working = $state<Provider | null>(null);
  $effect(() => {
    working = props.isp ? { ...props.isp } : null;
  });

  let saving = $state(false);
  let saveOk = $state(false);
  let saveErr = $state<string | null>(null);

  async function save() {
    if (!working || saving) return;
    saveOk = false;
    saveErr = null;
    saving = true;
    try {
      const payload: Provider = {
        ...working,
        company_name: working.company_name.trim(),
        technical_support_contact: (working.technical_support_contact || '').trim(),
        support_phone: (working.support_phone || '').trim(),
        support_email: (working.support_email || '').trim(),
        address: (working.address || '').trim(),
        payment_method: (working.payment_method || '').trim(),
        account_number: (working.account_number || '').trim(),
      };
      if (props.onSave) await props.onSave(payload);
      saveOk = true;
    } catch (e: any) {
      saveErr = 'Error al guardar';
    } finally {
      saving = false;
    }
  }

  const nameTrim = $derived((working?.company_name || '').trim());
  const emailTrim = $derived((working?.support_email || '').trim());
  const emailInvalid = $derived(emailTrim.length > 0 && !/^\S+@\S+\.\S+$/.test(emailTrim));
  const canSave = $derived(!!working && nameTrim.length >= 2 && !emailInvalid);

  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[560px] max-w-[95vw] max-h-[80vh] overflow-auto p-4 space-y-4 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Editar Proveedor</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if working}
          <div class="space-y-4">
            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div class="text-sm font-semibold text-foreground">Datos del proveedor</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="companyName">
                    Nombre
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="companyName"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${nameTrim.length === 0 ? 'border-neutral-800' : nameTrim.length >= 2 ? 'border-neutral-800' : 'border-red-500/40'} focus:outline-none`}
                    placeholder="Ej: ISPNet S.A."
                    autocomplete="organization"
                    bind:value={working.company_name}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Nombre comercial o razón social.</p>
                  {#if nameTrim.length > 0 && nameTrim.length < 2}
                    <p class="text-[11px] text-rose-400 mt-1">Ingresa un nombre válido.</p>
                  {/if}
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="status">Estado</label>
                  <select id="status" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" bind:value={working.status}>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                  <p class="text-[11px] text-muted-foreground mt-1">Controla si aparece disponible para operar.</p>
                </div>
                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground" for="address">Dirección</label>
                  <input id="address" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: Av. Principal, Edif. Centro" bind:value={working.address} />
                  <p class="text-[11px] text-muted-foreground mt-1">Opcional. Útil para referencias administrativas.</p>
                </div>
              </div>
            </div>

            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div class="text-sm font-semibold text-foreground">Contacto técnico</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-muted-foreground" for="contactName">Contacto</label>
                  <input id="contactName" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: Juan Pérez" autocomplete="name" bind:value={working.technical_support_contact} />
                  <p class="text-[11px] text-muted-foreground mt-1">NOC, ejecutivo de cuenta o responsable.</p>
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="phone">Teléfono</label>
                  <input id="phone" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: +58 412 000 0000" autocomplete="tel" bind:value={working.support_phone} />
                  <p class="text-[11px] text-muted-foreground mt-1">Línea de emergencias o soporte.</p>
                </div>
                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground" for="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${emailTrim.length === 0 ? 'border-neutral-800' : emailInvalid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    placeholder="Ej: soporte@ispnet.com"
                    autocomplete="email"
                    bind:value={working.support_email}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Correo para apertura de tickets o reportes.</p>
                  {#if emailInvalid}
                    <p class="text-[11px] text-rose-400 mt-1">El formato del email no parece válido.</p>
                  {/if}
                </div>
              </div>
            </div>

            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div class="text-sm font-semibold text-foreground">Facturación</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-muted-foreground" for="paymentMethod">Método de pago</label>
                  <input id="paymentMethod" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: Transferencia" bind:value={working.payment_method} />
                  <p class="text-[11px] text-muted-foreground mt-1">Cómo pagas este proveedor.</p>
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="accountNumber">Cuenta / Referencia</label>
                  <input id="accountNumber" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: 0102-0000-00-0000000000" bind:value={working.account_number} />
                  <p class="text-[11px] text-muted-foreground mt-1">Dato interno para conciliación.</p>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <div class="flex justify-between items-center gap-3 pt-2">
          <div class="text-sm">
            {#if saving}
              <span class="text-muted-foreground">Guardando...</span>
            {:else if saveOk}
              <span class="text-emerald-400">Guardado</span>
            {:else if saveErr}
              <span class="text-rose-400">{saveErr}</span>
            {/if}
          </div>
          <div class="flex gap-3">
            <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
            <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors disabled:opacity-60" disabled={saving || !canSave} onclick={save}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>

