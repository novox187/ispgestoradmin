<script lang="ts">
  import { goto } from "$app/navigation";
  import { API_BASE } from "$lib/config";
  import { BRAND } from "$lib/brand";
  import { auth } from "$lib/stores/auth.svelte";
  import dashboardDesktop from "$lib/assets/login/vistaescritorio1.2.png";
  import dashboardMobile from "$lib/assets/login/vistamobile1.2.png";
  import logoSrc from "$lib/assets/logos/logopng.png";
  import {
    Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2, Loader2,
    Wifi, FileText, Shield, Activity, Users, Bell, Zap, Globe,
    Clock, TrendingUp, Router
  } from "@lucide/svelte";

  // ── Form state ──
  let email = "";
  let password = "";
  let showPassword = false;
  let isLoading = false;
  let serverError = "";
  let touched = { email: false, password: false };

  function validateEmail(v: string): string | undefined {
    if (!v) return "El correo electrónico es requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Ingresa un correo electrónico válido";
  }
  function validatePassword(v: string): string | undefined {
    if (!v) return "La contraseña es requerida";
    if (v.length < 6) return "La contraseña debe tener al menos 6 caracteres";
  }

  $: emailError    = touched.email    ? validateEmail(email)       : undefined;
  $: passwordError = touched.password ? validatePassword(password) : undefined;
  $: isEmailValid    = touched.email    && !emailError    && email.length    > 0;
  $: isPasswordValid = touched.password && !passwordError && password.length > 0;

  function blurEmail()    { touched = { ...touched, email:    true }; }
  function blurPassword() { touched = { ...touched, password: true }; }
  function revalidateEmail()    { if (touched.email)    touched = { ...touched }; }
  function revalidatePassword() { if (touched.password) touched = { ...touched }; }

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    touched = { email: true, password: true };
    if (validateEmail(email) || validatePassword(password)) return;

    serverError = "";
    isLoading = true;
    try {
      const res = await fetch(`${API_BASE}/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Credenciales inválidas");
      }
      const data = await res.json();
      const token      = data?.token;
      const role       = data?.role || data?.user?.role || "employee";
      const nombre     = data?.employee?.nombre || data?.user?.name || "";
      const employeeId = data?.employee?.id || data?.user?.id || "";

      if (!token) throw new Error("No se recibió el token de autenticación");
      if (String(role).toLowerCase() !== "employee") throw new Error("No autorizado");

      auth.save({
        token,
        nombre:      nombre,
        roleSlug:    data?.employee?.role_slug ?? '',
        roleName:    String(data?.employee?.role || data?.employee?.rol || role),
        permissions: data?.employee?.permissions ?? [],
        employeeId:  employeeId,
      });

      goto("/", { replaceState: true });
    } catch (err) {
      serverError =
        err instanceof Error && err.message === "No autorizado"
          ? "Acceso restringido al área administrativa"
          : "El correo electrónico o la contraseña son incorrectos";
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{BRAND.pageTitle('Iniciar sesión')}</title>
  <meta name="description" content={BRAND.pageDescription('login')} />
  <meta property="og:title" content={BRAND.pageTitle('Iniciar sesión')} />
  <meta property="og:description" content={BRAND.pageDescription('login')} />
  <meta property="og:url" content={`${BRAND.canonicalUrl}/login`} />
  <meta name="twitter:title" content={BRAND.pageTitle('Iniciar sesión')} />
  <meta name="twitter:description" content={BRAND.pageDescription('login')} />
  <link rel="canonical" href={`${BRAND.canonicalUrl}/login`} />
  {@html `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Iniciar sesión | ${BRAND.name}`,
    description: BRAND.pageDescription('login'),
    url: `${BRAND.canonicalUrl}/login`,
    isPartOf: { '@type': 'WebSite', name: BRAND.name, url: BRAND.canonicalUrl },
    inLanguage: BRAND.lang,
    primaryImageOfPage: { '@type': 'ImageObject', url: BRAND.ogImage }
  })}<\/script>`}
</svelte:head>

<main class="root">

  <!-- ══════════════════════════════════
       LEFT — Form
  ══════════════════════════════════ -->
  <section class="left-panel">
    <div class="blob blob-tl" aria-hidden="true"></div>
    <div class="blob blob-br" aria-hidden="true"></div>

    <div class="left-inner">
      <!-- Brand -->
      <div class="brand-block">
        <div class="logo-wrap">
          <img src={logoSrc} alt={BRAND.logoAlt} class="logo-img" />
        </div>
        <div>
          <h1 class="brand-name">{BRAND.nameUpper}</h1>
          <p class="brand-tagline">{BRAND.tagline}</p>
        </div>
      </div>

      <!-- Welcome -->
      <div class="welcome-block">
        <h2 class="welcome-title">Bienvenido de nuevo</h2>
        <p class="welcome-sub">Ingresa tus credenciales para acceder al panel de control</p>
      </div>

      <!-- Card -->
      <div class="login-card">
        <form on:submit={handleLogin} novalidate class="form">

          {#if serverError}
            <div class="server-error">{serverError}</div>
          {/if}

          <!-- Email -->
          <div class="field">
            <label for="email" class="field-label">Correo Electrónico</label>
            <div class="input-wrap">
              <span class="icon-left"><Mail size={20} /></span>
              <input
                id="email" type="email" bind:value={email}
                on:blur={blurEmail} on:input={revalidateEmail}
                placeholder="ejemplo@ironlink.com" autocomplete="email"
                class="ifield"
                class:err={emailError && touched.email}
                class:ok={isEmailValid}
              />
              <span class="icon-right">
                {#if emailError && touched.email}
                  <span class="icon-destructive"><AlertCircle size={20} /></span>
                {:else if isEmailValid}
                  <span class="icon-accent"><CheckCircle2 size={20} /></span>
                {/if}
              </span>
            </div>
            {#if emailError && touched.email}
              <p class="field-err">{emailError}</p>
            {/if}
          </div>

          <!-- Password -->
          <div class="field">
            <label for="password" class="field-label">Contraseña</label>
            <div class="input-wrap">
              <span class="icon-left"><Lock size={20} /></span>
              <input
                id="password" type={showPassword ? "text" : "password"} bind:value={password}
                on:blur={blurPassword} on:input={revalidatePassword}
                placeholder="••••••••" autocomplete="current-password"
                class="ifield ifield-wide-pr"
                class:err={passwordError && touched.password}
                class:ok={isPasswordValid}
              />
              <span class="icon-right icon-right-multi">
                {#if passwordError && touched.password}
                  <span class="icon-destructive"><AlertCircle size={20} /></span>
                {:else if isPasswordValid}
                  <span class="icon-accent"><CheckCircle2 size={20} /></span>
                {/if}
                <button type="button" class="eye-btn"
                  on:click={() => (showPassword = !showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {#if showPassword}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
                </button>
              </span>
            </div>
            {#if passwordError && touched.password}
              <p class="field-err">{passwordError}</p>
            {/if}
          </div>

          <!-- Forgot -->
          <div class="forgot-row">
            <button type="button" class="forgot-btn">¿Olvidaste tu contraseña?</button>
          </div>

          <!-- Submit -->
          <button type="submit" class="submit-btn" disabled={isLoading}>
            {#if isLoading}
              <span class="spin-wrap"><Loader2 size={20} /></span>
              Iniciando sesión...
            {:else}
              Iniciar Sesión
            {/if}
          </button>

        </form>
      </div>

      <!-- Footer -->
      <div class="footer-row">
        <p>¿No tienes una cuenta? <button type="button" class="contact-btn">Contacta al administrador</button></p>
      </div>

      <!-- Mobile-only feature pills -->
      <div class="mobile-features">
        <div class="mfeat"><Shield size={20} class="mfeat-icon" /><span>Seguro</span></div>
        <div class="mfeat"><Zap    size={20} class="mfeat-icon" /><span>Rápido</span></div>
        <div class="mfeat"><Users  size={20} class="mfeat-icon" /><span>Multiusuario</span></div>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════
       RIGHT — Dashboard Preview
  ══════════════════════════════════ -->
  <section class="right-panel" aria-hidden="true">
    <div class="blob blob-tr"></div>
    <div class="blob blob-bl"></div>
    <div class="bg-grid"></div>

    <div class="preview">

      <!-- TOP badges row -->
      <div class="top-badges">
        <!-- MikroTik Nativo -->
        <div class="fbadge fbadge-primary animate-float" style="animation-delay:0s">
          <div class="fbadge-icon fbadge-icon-primary"><Router size={12} /></div>
          <span class="fbadge-label">MikroTik Nativo</span>
        </div>

        <!-- Sync + Multi-zona combo -->
        <div class="sync-pill animate-float" style="animation-delay:0.3s">
          <div class="sync-left">
            <span class="pulse-dot"></span>
            <span class="sync-text">Sync</span>
            <span class="sync-active">Activa</span>
          </div>
          <div class="divider-v"></div>
          <div class="sync-right">
            <Globe size={14} class="globe-icon" />
            <span class="sync-zona">Multi-zona</span>
          </div>
        </div>

        <!-- KPIs en Vivo -->
        <div class="fbadge fbadge-cyan animate-float" style="animation-delay:0.2s">
          <div class="fbadge-icon fbadge-icon-cyan"><Activity size={12} /></div>
          <span class="fbadge-label">KPIs en Vivo</span>
        </div>
      </div>

      <!-- SCREENSHOT AREA -->
      <div class="screenshot-area">

        <!-- Browser frame -->
        <div class="browser">
          <div class="browser-bar">
            <div class="traffic-lights">
              <span class="tl tl-r"></span>
              <span class="tl tl-y"></span>
              <span class="tl tl-g"></span>
            </div>
            <div class="url-bar">
              <span class="url-dot"></span>
              <span class="url-text">admin.ironlink.com/dashboard</span>
            </div>
          </div>
          <div class="desktop-screen">
            <img src={dashboardDesktop} alt="IRON LINK Dashboard - Vista de Escritorio" class="desktop-img" />
            <div class="screen-fade"></div>
          </div>
        </div>

        <!-- Floating phone -->
        <div class="phone-wrap">
          <div class="phone-body">
            <div class="dynamic-island"></div>
            <div class="phone-screen">
              <img src={dashboardMobile} alt="IRON LINK Dashboard - Vista Móvil" class="mobile-img" />
            </div>
            <div class="home-bar"></div>
          </div>
          <div class="phone-glow"></div>
        </div>

        <!-- Left badges -->
        <div class="bp bp-tl">
          <div class="fbadge fbadge-green animate-float" style="animation-delay:0.4s">
            <div class="fbadge-icon fbadge-icon-green"><FileText size={12} /></div>
            <span class="fbadge-label">Facturación Auto</span>
          </div>
        </div>
        <div class="bp bp-ml">
          <div class="fbadge fbadge-orange animate-float" style="animation-delay:0.8s">
            <div class="fbadge-icon fbadge-icon-orange"><Shield size={12} /></div>
            <span class="fbadge-label">Control Firewall</span>
          </div>
        </div>
        <div class="bp bp-bl">
          <div class="fbadge fbadge-red animate-float" style="animation-delay:1.2s">
            <div class="fbadge-icon fbadge-icon-red"><Zap size={12} /></div>
            <span class="fbadge-label">Corte Automático</span>
          </div>
        </div>

        <!-- Right badges -->
        <div class="bp bp-tr">
          <div class="fbadge fbadge-purple animate-float" style="animation-delay:0.6s">
            <div class="fbadge-icon fbadge-icon-purple"><Users size={12} /></div>
            <span class="fbadge-label">Roles y Acceso</span>
          </div>
        </div>
        <div class="bp bp-mr">
          <div class="fbadge fbadge-yellow animate-float" style="animation-delay:1s">
            <div class="fbadge-icon fbadge-icon-yellow"><Bell size={12} /></div>
            <span class="fbadge-label">Alertas de Red</span>
          </div>
        </div>
        <div class="bp bp-br">
          <div class="fbadge fbadge-primary animate-float" style="animation-delay:1.4s">
            <div class="fbadge-icon fbadge-icon-primary"><Wifi size={12} /></div>
            <span class="fbadge-label">Soporte Realtime</span>
          </div>
        </div>

      </div><!-- /screenshot-area -->

      <!-- BOTTOM stats -->
      <div class="bottom-stats">
        <div class="stat stat-green animate-float" style="animation-delay:0.7s">
          <CheckCircle2 size={16} class="stat-ico stat-ico-green" />
          <div><p class="stat-lbl">Router</p><p class="stat-val stat-val-green">Online</p></div>
        </div>
        <div class="stat stat-neutral animate-float" style="animation-delay:1.1s">
          <div class="stat-ico-wrap"><TrendingUp size={16} class="stat-ico stat-ico-primary" /></div>
          <div><p class="stat-lbl">Facturado</p><p class="stat-val">$58</p></div>
        </div>
        <div class="stat stat-orange animate-float" style="animation-delay:1.4s">
          <Clock size={16} class="stat-ico stat-ico-orange" />
          <div><p class="stat-lbl">Pendientes</p><p class="stat-val stat-val-orange">2 facturas</p></div>
        </div>
      </div>

    </div><!-- /preview -->

    <!-- Decorative corner shapes -->
    <div class="deco deco-tl"></div>
    <div class="deco deco-br"></div>
  </section>

</main>

<style>
  /* ── Design tokens ── */
  :global(:root) {
    --lbg:     oklch(0.11 0.01 250);
    --lfg:     oklch(0.95 0 0);
    --lcard:   oklch(0.15 0.01 250);
    --lprimary:     oklch(0.65 0.15 220);
    --lprimary-fg:  oklch(0.98 0 0);
    --lsecondary:   oklch(0.20 0.01 250);
    --lmuted:       oklch(0.25 0.01 250);
    --lmuted-fg:    oklch(0.65 0 0);
    --laccent:      oklch(0.55 0.18 160);
    --ldestructive: oklch(0.55 0.22 25);
    --lborder:      oklch(0.25 0.02 250);
    --linput:       oklch(0.18 0.01 250);
    --lradius:      0.75rem;
  }

  /* ── Root ── */
  .root {
    flex: 1;
    height: 100%;
    min-height: 0;
    background: var(--lbg);
    display: flex;
    flex-direction: column;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--lfg);
    overflow: hidden;
  }
  @media (min-width: 1024px) { .root { flex-direction: row; } }

  /* ── Blobs ── */
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
  }
  .blob-tl { top:-25%;   left:-25%;  width:50%; height:50%; background: color-mix(in oklch, var(--lprimary) 5%, transparent); }
  .blob-br { bottom:-25%;right:-25%; width:50%; height:50%; background: color-mix(in oklch, var(--laccent)  5%, transparent); }
  .blob-tr { top:25%;   right:25%;   width:24rem; height:24rem; background: color-mix(in oklch, var(--lprimary) 5%, transparent); }
  .blob-bl { bottom:25%;left:25%;    width:24rem; height:24rem; background: color-mix(in oklch, var(--laccent)  5%, transparent); }

  /* ══ LEFT PANEL ══ */
  .left-panel {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
  }
  @media (min-width: 640px)  { .left-panel { padding: 2rem; } }
  @media (min-width: 1024px) { .left-panel { width: 50%; padding: 3rem; } }
  @media (min-width: 1280px) { .left-panel { width: 40%; } }

  .left-inner {
    width: 100%;
    max-width: 28rem;
    position: relative;
    z-index: 1;
  }

  /* Brand */
  .brand-block { display:flex; align-items:center; justify-content:center; gap:1rem; margin-bottom:2rem; }
  .logo-wrap   { width:4rem; height:4rem; flex-shrink:0; }
  @media (min-width:640px) { .logo-wrap { width:5rem; height:5rem; } }
  .logo-img    { width:100%; height:100%; object-fit:contain; }
  .brand-name  { font-size:1.5rem; font-weight:700; letter-spacing:-0.025em; color:var(--lfg); margin:0; line-height:1.2; }
  @media (min-width:640px) { .brand-name { font-size:1.875rem; } }
  .brand-tagline { font-size:.875rem; color:var(--lmuted-fg); margin:0; }

  /* Welcome */
  .welcome-block { text-align:center; margin-bottom:2rem; }
  .welcome-title { font-size:1.25rem; font-weight:600; color:var(--lfg); margin:0 0 .5rem; }
  @media (min-width:640px) { .welcome-title { font-size:1.5rem; } }
  .welcome-sub { color:var(--lmuted-fg); font-size:.875rem; margin:0; }

  /* Card */
  .login-card {
    background: color-mix(in oklch, var(--lcard) 50%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid color-mix(in oklch, var(--lborder) 30%, transparent);
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,.2);
    margin-bottom: 2rem;
  }
  @media (min-width:640px) { .login-card { padding:2rem; } }

  /* Form */
  .form { display:flex; flex-direction:column; gap:1.5rem; }

  .server-error {
    padding:.75rem 1rem;
    border-radius:.75rem;
    background: color-mix(in oklch, var(--ldestructive) 15%, transparent);
    border: 1px solid color-mix(in oklch, var(--ldestructive) 30%, transparent);
    color: oklch(0.85 0.15 25);
    font-size:.875rem;
  }

  /* Fields */
  .field { display:flex; flex-direction:column; gap:.5rem; }
  .field-label { font-size:.875rem; font-weight:500; color: color-mix(in oklch, var(--lfg) 90%, transparent); }

  .input-wrap  { position:relative; display:flex; align-items:center; }
  .icon-left   { position:absolute; left:.75rem; color:var(--lmuted-fg); display:flex; pointer-events:none; z-index:1; }
  .icon-right  { position:absolute; right:.75rem; display:flex; align-items:center; z-index:1; }
  .icon-right-multi { gap:.5rem; }

  .ifield {
    width:100%; height:3rem;
    padding-left:2.75rem; padding-right:2.75rem;
    background: var(--linput);
    border: 1px solid color-mix(in oklch, var(--lborder) 50%, transparent);
    border-radius: var(--lradius);
    color: var(--lfg);
    font-size:.875rem;
    font-family:inherit;
    outline:none;
    transition: border-color .3s, box-shadow .3s;
  }
  .ifield-wide-pr { padding-right:5rem; }
  .ifield::placeholder { color: color-mix(in oklch, var(--lmuted-fg) 60%, transparent); }
  .ifield:focus {
    border-color: var(--lprimary);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--lprimary) 20%, transparent);
  }
  .ifield.err {
    border-color: var(--ldestructive) !important;
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--ldestructive) 20%, transparent) !important;
  }
  .ifield.ok {
    border-color: var(--laccent) !important;
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--laccent) 20%, transparent) !important;
  }

  .icon-destructive { color: var(--ldestructive); display:flex; }
  .icon-accent      { color: var(--laccent);      display:flex; }

  .field-err { font-size:.875rem; color:var(--ldestructive); margin:0; animation: slideIn .2s ease; }

  .eye-btn {
    background:none; border:none; cursor:pointer;
    color:var(--lmuted-fg); display:flex; align-items:center; padding:0;
    transition:color .2s;
  }
  .eye-btn:hover { color:var(--lfg); }

  /* Forgot */
  .forgot-row { display:flex; justify-content:flex-end; }
  .forgot-btn {
    background:none; border:none; cursor:pointer;
    font-size:.875rem; font-family:inherit;
    color:var(--lprimary); padding:0;
    text-underline-offset:4px; transition:color .2s;
  }
  .forgot-btn:hover { color: color-mix(in oklch, var(--lprimary) 80%, transparent); text-decoration:underline; }

  /* Submit */
  .submit-btn {
    width:100%; height:3rem; border:none;
    border-radius: var(--lradius);
    cursor:pointer; font-size:1rem; font-weight:600; font-family:inherit;
    background: var(--lprimary); color: var(--lprimary-fg);
    box-shadow: 0 4px 14px color-mix(in oklch, var(--lprimary) 20%, transparent);
    display:flex; align-items:center; justify-content:center; gap:.5rem;
    transition: background .3s, box-shadow .3s, transform .2s, opacity .2s;
  }
  .submit-btn:hover:not(:disabled) {
    background: color-mix(in oklch, var(--lprimary) 90%, transparent);
    box-shadow: 0 6px 20px color-mix(in oklch, var(--lprimary) 30%, transparent);
    transform: scale(1.02);
  }
  .submit-btn:disabled { opacity:.7; cursor:not-allowed; }

  .spin-wrap { animation: spin 1s linear infinite; display:flex; }

  /* Footer */
  .footer-row { text-align:center; font-size:.875rem; color:var(--lmuted-fg); margin-bottom:2rem; }
  .footer-row p { margin:0; }
  .contact-btn {
    background:none; border:none; cursor:pointer;
    font-family:inherit; font-size:inherit; font-weight:500;
    color:var(--lprimary); padding:0; text-underline-offset:4px; transition:color .2s;
  }
  .contact-btn:hover { color: color-mix(in oklch, var(--lprimary) 80%, transparent); text-decoration:underline; }

  /* Mobile features */
  .mobile-features { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
  @media (min-width:1024px) { .mobile-features { display:none; } }
  .mfeat {
    display:flex; flex-direction:column; align-items:center; gap:.5rem;
    padding:.75rem; border-radius:.75rem;
    background: color-mix(in oklch, var(--lsecondary) 50%, transparent);
    border: 1px solid color-mix(in oklch, var(--lborder) 30%, transparent);
    font-size:.75rem; color:var(--lmuted-fg);
  }

  /* ══ RIGHT PANEL ══ */
  .right-panel {
    display:none;
    position:relative; overflow:hidden; padding:2rem;
  }
  @media (min-width:1024px) {
    .right-panel {
      display:flex; flex:1; width:50%;
      flex-direction:column; align-items:center; justify-content:center;
      border-left: 1px solid color-mix(in oklch, var(--lborder) 30%, transparent);
      background: color-mix(in oklch, var(--lsecondary) 20%, transparent);
    }
  }
  @media (min-width:1280px) { .right-panel { width:60%; padding:3rem; } }

  .bg-grid {
    position:absolute; inset:0; opacity:.03; pointer-events:none;
    background-image:
      linear-gradient(rgba(96,165,250,.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96,165,250,.3) 1px, transparent 1px);
    background-size:40px 40px;
  }

  .deco { display:none; position:absolute; border-radius:.75rem; }
  @media (min-width:1024px) { .deco { display:block; } }
  .deco-tl { top:2rem; left:2rem;   width:5rem; height:5rem; border:1px solid color-mix(in oklch,var(--lprimary) 10%,transparent); transform:rotate(12deg); opacity:.4; }
  .deco-br { bottom:2rem; right:2rem; width:4rem; height:4rem; border:1px solid color-mix(in oklch,var(--laccent) 10%,transparent); transform:rotate(-12deg); opacity:.3; }

  /* Preview wrapper */
  .preview {
    position:relative; width:100%; max-width:700px; z-index:1;
  }

  /* Top badges */
  .top-badges {
    display:flex; justify-content:center; align-items:center;
    gap:.75rem; flex-wrap:wrap; margin-bottom:1rem;
  }

  /* Sync pill */
  .sync-pill {
    background: color-mix(in oklch, var(--lcard) 90%, transparent);
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    border:1px solid color-mix(in oklch, var(--lprimary) 30%, transparent);
    border-radius:.75rem; padding:.5rem 1rem;
    box-shadow: 0 4px 14px color-mix(in oklch, var(--lprimary) 10%, transparent);
    display:flex; align-items:center; gap:.75rem;
  }
  .sync-left  { display:flex; align-items:center; gap:.5rem; }
  .pulse-dot  { width:.5rem; height:.5rem; border-radius:50%; background:#22c55e; animation:pulse 2s infinite; }
  .sync-text  { font-size:.75rem; color:var(--lmuted-fg); }
  .sync-active{ font-size:.75rem; font-weight:700; color:#22c55e; }
  .divider-v  { width:1px; height:1rem; background:var(--lborder); }
  .sync-right { display:flex; align-items:center; gap:.375rem; }
  :global(.globe-icon) { color:var(--lprimary); }
  .sync-zona  { font-size:.75rem; font-weight:500; color:var(--lfg); }

  /* Screenshot area */
  .screenshot-area { position:relative; }

  /* Browser */
  .browser {
    background:#1a1f2e;
    border-radius:.75rem .75rem 0 0;
    border:1px solid color-mix(in oklch, var(--lborder) 40%, transparent);
    border-bottom:none;
  }
  .browser-bar { display:flex; align-items:center; gap:.5rem; padding:.5rem .75rem; }
  .traffic-lights { display:flex; gap:.375rem; }
  .tl { width:.625rem; height:.625rem; border-radius:50%; }
  .tl-r { background:rgba(239,68,68,.7); }
  .tl-y { background:rgba(234,179,8,.7); }
  .tl-g { background:rgba(34,197,94,.7); }
  .url-bar {
    flex:1; background: color-mix(in oklch, var(--lbg) 60%, transparent);
    border-radius:.375rem; padding:.25rem .75rem; margin:0 1rem;
    display:flex; align-items:center; justify-content:center; gap:.5rem;
  }
  .url-dot  { width:.625rem; height:.625rem; border-radius:50%; background:rgba(34,197,94,.6); flex-shrink:0; }
  .url-text { font-size:.625rem; color:var(--lmuted-fg); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .desktop-screen {
    position:relative;
    border-radius:0 0 .75rem .75rem; overflow:hidden;
    border:1px solid color-mix(in oklch, var(--lborder) 40%, transparent);
    box-shadow:0 25px 80px -15px rgba(0,0,0,.5);
  }
  .desktop-img  { width:100%; display:block; height:auto; }
  .screen-fade  { position:absolute; inset:0; background:linear-gradient(to top, color-mix(in oklch,var(--lbg) 10%,transparent),transparent); pointer-events:none; }

  /* Phone */
  .phone-wrap   { position:absolute; right:.75rem; bottom:.75rem; z-index:10; transition:transform .5s; }
  @media (min-width:640px) { .phone-wrap { right:1rem; bottom:1rem; } }
  .phone-wrap:hover { transform:scale(1.05); }
  .phone-body {
    position:relative; background:#1a1f2e; border-radius:20px; padding:.25rem;
    box-shadow:0 20px 50px -15px rgba(0,0,0,.7);
    border:1px solid color-mix(in oklch, var(--lborder) 50%, transparent);
  }
  @media (min-width:640px) { .phone-body { border-radius:24px; } }
  .dynamic-island {
    position:absolute; top:.375rem; left:50%; transform:translateX(-50%);
    width:2.5rem; height:.75rem; background:#000; border-radius:9999px; z-index:20;
  }
  @media (min-width:640px) { .dynamic-island { width:3rem; height:1rem; } }
  .phone-screen { border-radius:16px; overflow:hidden; background:var(--lbg); width:80px; }
  @media (min-width:640px) { .phone-screen { width:100px; border-radius:20px; } }
  @media (min-width:1024px){ .phone-screen { width:110px; } }
  .mobile-img   { width:100%; display:block; height:auto; }
  .home-bar {
    position:absolute; bottom:.25rem; left:50%; transform:translateX(-50%);
    width:2rem; height:2px; background:rgba(255,255,255,.3); border-radius:9999px;
  }
  @media (min-width:640px) { .home-bar { width:2.5rem; } }
  .phone-glow {
    position:absolute; inset:0; z-index:-1;
    background: color-mix(in oklch, var(--lprimary) 20%, transparent);
    filter:blur(2rem); border-radius:50%; transform:scale(.75);
  }

  /* Badge positions */
  .bp  { position:absolute; z-index:20; }
  .bp-tl { top:-.5rem;  left:-1rem;  }
  .bp-ml { top:33%;     left:-1.5rem; }
  .bp-bl { bottom:25%;  left:-1rem;  }
  .bp-tr { top:-.5rem;  right:-1rem; }
  .bp-mr { top:25%;     right:-1.5rem;}
  .bp-br { top:50%;     right:-1rem; }
  @media (min-width:1280px) {
    .bp-tl { left:-2rem; }
    .bp-ml { left:-3rem; }
    .bp-bl { left:-2.5rem; }
    .bp-tr { right:-2rem; }
    .bp-mr { right:-3.5rem; }
    .bp-br { right:-2.5rem; }
  }

  /* Bottom stats */
  .bottom-stats { display:flex; justify-content:center; align-items:center; gap:.5rem; flex-wrap:wrap; margin-top:1.5rem; }
  @media (min-width:640px) { .bottom-stats { gap:1rem; } }

  .stat {
    display:flex; align-items:center; gap:.5rem;
    padding:.375rem .625rem; border-radius:.75rem;
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    background: color-mix(in oklch, var(--lcard) 90%, transparent);
  }
  @media (min-width:640px) { .stat { padding:.5rem .75rem; } }
  .stat-green   { border:1px solid rgba(34,197,94,.3);  box-shadow:0 4px 14px rgba(34,197,94,.1); }
  .stat-neutral { border:1px solid color-mix(in oklch, var(--lborder) 50%, transparent); }
  .stat-orange  { border:1px solid rgba(249,115,22,.3); box-shadow:0 4px 14px rgba(249,115,22,.1); }

  .stat-lbl { font-size:.5rem; color:var(--lmuted-fg); text-transform:uppercase; letter-spacing:.05em; margin:0; line-height:1; }
  @media (min-width:640px) { .stat-lbl { font-size:.5625rem; } }
  .stat-val { font-size:.625rem; font-weight:700; margin:2px 0 0; line-height:1; color:var(--lfg); }
  @media (min-width:640px) { .stat-val { font-size:.75rem; } }
  .stat-val-green  { color:#4ade80; }
  .stat-val-orange { color:#fb923c; }

  :global(.stat-ico)         { flex-shrink:0; }
  :global(.stat-ico-green)   { color:#22c55e; }
  :global(.stat-ico-orange)  { color:#f97316; }
  :global(.stat-ico-primary) { color:var(--lprimary); }
  .stat-ico-wrap { padding:.125rem .25rem; border-radius:.5rem; background: color-mix(in oklch, var(--lprimary) 10%, transparent); }

  /* ── FloatingBadge ── */
  .fbadge {
    display:flex; align-items:center; gap:.5rem;
    padding:.375rem .625rem; border-radius:.5rem;
    background: color-mix(in oklch, var(--lcard) 90%, transparent);
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    box-shadow:0 4px 12px rgba(0,0,0,.3);
    white-space:nowrap; cursor:default;
  }
  .fbadge-label { font-size:.6875rem; font-weight:500; color:var(--lfg); }
  .fbadge-icon  { padding:.25rem; border-radius:.375rem; display:flex; align-items:center; justify-content:center; }

  .fbadge-primary { border:1px solid color-mix(in oklch,var(--lprimary) 30%,transparent); }
  .fbadge-icon-primary { background:color-mix(in oklch,var(--lprimary) 20%,transparent); color:var(--lprimary); }

  .fbadge-green { border:1px solid rgba(34,197,94,.3); }
  .fbadge-icon-green { background:rgba(34,197,94,.2); color:#22c55e; }

  .fbadge-orange { border:1px solid rgba(249,115,22,.3); }
  .fbadge-icon-orange { background:rgba(249,115,22,.2); color:#f97316; }

  .fbadge-red { border:1px solid rgba(239,68,68,.3); }
  .fbadge-icon-red { background:rgba(239,68,68,.2); color:#ef4444; }

  .fbadge-cyan { border:1px solid rgba(6,182,212,.3); }
  .fbadge-icon-cyan { background:rgba(6,182,212,.2); color:#06b6d4; }

  .fbadge-purple { border:1px solid rgba(168,85,247,.3); }
  .fbadge-icon-purple { background:rgba(168,85,247,.2); color:#a855f7; }

  .fbadge-yellow { border:1px solid rgba(234,179,8,.3); }
  .fbadge-icon-yellow { background:rgba(234,179,8,.2); color:#eab308; }

  /* ── Keyframes ── */
  @keyframes float  { 0%,100%{transform:translateY(0)}    50%{transform:translateY(-10px)} }
  @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes slideIn{ from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }

  .animate-float { animation: float 6s ease-in-out infinite; }
</style>
