<script lang="ts">
    import { onMount } from 'svelte';
    import { API_BASE } from '$lib/config';

    //======================================================================
    // 1. TIPOS Y DATOS (Finanzas)
    //======================================================================

    type TimePeriod = 'year'; // Por ahora solo soportamos año

    interface ChartDataItem {
        date: string;
        invoiced: number; // Facturado
        collected: number; // Cobrado
        pending: number; // Pendiente
        // Permite acceso dinámico por clave
        [key: string]: string | number; 
    }

    interface ChartConfig {
        [key: string]: { label: string; color: string; fill: string; unit: string };
    }

    // Datos Mock iniciales
    let chartData: ChartDataItem[] = [];
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Configuración de métricas
    const config: ChartConfig = {
        invoiced: {
            label: "Facturado",
            color: "#3b82f6", // Azul
            fill: "url(#fillInvoiced)",
            unit: "currency"
        },
        collected: {
            label: "Cobrado",
            color: "#10b981", // Verde
            fill: "url(#fillCollected)",
            unit: "currency"
        },
        pending: {
            label: "Pendiente",
            color: "#f97316", // Naranja
            fill: "url(#fillPending)",
            unit: "currency"
        },
    };

    //======================================================================
    // 2. ESTADO Y LÓGICA PRINCIPAL
    //======================================================================

    let activeTab = $state<TimePeriod>('year');
    let chartContainer = $state<HTMLDivElement | null>(null);
    let hoveredPoint = $state<{ x: number, data: ChartDataItem } | null>(null);
    
    // Datos y dimensiones derivados
    const data = $derived<ChartDataItem[]>(chartData);
    
    const width = 1000;
    const height = 320;
    const padding = { top: 20, right: 30, bottom: 30, left: 70 }; 
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calcula el valor máximo de todas las series
    const maxValue = $derived(
        data.length > 0 
            ? Math.max(...data.flatMap(d => [d.invoiced, d.collected, d.pending]), 0) * 1.1 // 10% margen
            : 1000
    );

    const xStep = $derived(data.length > 1 ? chartWidth / (data.length - 1) : chartWidth);

    async function loadChartData() {
        loading = true;
        error = null;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const res = await fetch(`${API_BASE}/admin/dashboard/chart`, {
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });
            
            if (!res.ok) throw new Error('Error cargando datos del gráfico');
            
            const payload = await res.json();
            
            // Transformar respuesta del backend al formato ChartDataItem
            if (payload.labels && payload.datasets) {
                const labels = payload.labels;
                const invoicedData = payload.datasets[0]?.data || [];
                const collectedData = payload.datasets[1]?.data || [];
                const pendingData = payload.datasets[2]?.data || [];

                chartData = labels.map((label: string, i: number) => ({
                    date: label,
                    invoiced: Number(invoicedData[i] || 0),
                    collected: Number(collectedData[i] || 0),
                    pending: Number(pendingData[i] || 0)
                }));
            }
        } catch (e: any) {
            console.error('Error chart:', e);
            error = e.message;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadChartData();
    });

    //======================================================================
    // 3. UTILIDADES Y FORMATO
    //======================================================================

    // Formato para el eje Y
    function formatYValue(value: number): string {
        if (value === 0) return "$0";
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    }

    // Formato para los valores del Tooltip
    function formatTooltipValue(key: keyof ChartDataItem, value: number): string {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
    }
    
    // Función para dibujar la ruta de línea
    function createPath(values: number[], max: number) {
        if (data.length <= 1) return '';
        let path = '';
        values.forEach((value, i) => {
            const x = padding.left + i * xStep;
            const y = padding.top + chartHeight - (value / max) * chartHeight;
            path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
        return path;
    }

    // Función para dibujar la ruta de área
    function createAreaPath(values: number[], max: number) {
        if (data.length === 0) return '';
        
        let path = `M ${padding.left} ${padding.top + chartHeight}`;
        values.forEach((value, i) => {
            const x = padding.left + i * xStep;
            const y = padding.top + chartHeight - (value / max) * chartHeight;
            path += ` L ${x} ${y}`;
        });
        path += ` L ${padding.left + (data.length - 1) * xStep} ${padding.top + chartHeight}`;
        path += ' Z';
        return path;
    }

    // Rutas derivadas
    const invoicedLinePath = $derived(createPath(data.map(d => d.invoiced), maxValue));
    const invoicedAreaPath = $derived(createAreaPath(data.map(d => d.invoiced), maxValue));
    const collectedLinePath = $derived(createPath(data.map(d => d.collected), maxValue));
    const collectedAreaPath = $derived(createAreaPath(data.map(d => d.collected), maxValue));
    const pendingLinePath = $derived(createPath(data.map(d => d.pending), maxValue));
    const pendingAreaPath = $derived(createAreaPath(data.map(d => d.pending), maxValue));

    //======================================================================
    // 4. LÓGICA DE INTERACCIÓN (Movimiento del Ratón)
    //======================================================================
    
    function getClosestPoint(chartX: number): { x: number, data: ChartDataItem } | null {
        if (data.length === 0) return null;
        
        let i = Math.round((chartX - padding.left) / xStep);
        i = Math.max(0, Math.min(i, data.length - 1));

        const x = padding.left + i * xStep;
        return { x, data: data[i] };
    }

    function handleMouseMove(event: MouseEvent) {
        if (!chartContainer) return;
        
        const svgElement = chartContainer.querySelector('svg');
        if (!svgElement) return;

        const rect = svgElement.getBoundingClientRect();
        // Convertir coordenadas del ratón a la escala del viewBox SVG (0-1000)
        const mouseX = (event.clientX - rect.left) / rect.width * width;

        if (mouseX >= padding.left && mouseX <= width - padding.right) {
            hoveredPoint = getClosestPoint(mouseX);
        } else {
            hoveredPoint = null;
        }
    }

    function handleMouseLeave() {
        hoveredPoint = null;
    }
</script>

<div class="p-6 bg-gray-900 text-gray-100 rounded-lg shadow-lg hidden md:block">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h2 class="text-xl font-bold">INGRESOS FINANCIEROS</h2>
            <p class="text-gray-400">Facturación vs Recaudo (Año actual)</p>
        </div>
    </div>

    <div class="bg-gray-800 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-4">
            <div class="flex p-1 rounded-lg bg-gray-700 max-md:w-full">
                <button class="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-gray-900 text-white">
                    AÑO ACTUAL
                </button>
            </div>

            <div class="flex items-center gap-6 max-md:order-1">
                {#each Object.entries(config) as [key, value]}
                    <div class="flex items-center gap-2 uppercase">
                        <div
                            class="w-2 h-2 rounded-sm rotate-45"
                            style:background-color={value.color}
                        ></div>
                        <span class="text-sm font-medium text-gray-400">{value.label}</span>
                    </div>
                {/each}
            </div>
        </div>

        <div class="relative w-full overflow-hidden">
            {#if loading}
                <div class="flex items-center justify-center h-[320px] text-gray-400">
                    Cargando datos...
                </div>
            {:else if error}
                <div class="flex items-center justify-center h-[320px] text-red-400">
                    {error}
                </div>
            {:else}
                <div 
                    class="md:aspect-[3/1] w-full" 
                    style:height="{height}px"
                    bind:this={chartContainer}
                >
                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        class="w-full h-full"
                        role="img"
                        onmousemove={handleMouseMove}
                        onmouseleave={handleMouseLeave}
                    >
                        <defs>
                            <linearGradient id="fillInvoiced" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stop-color={config.invoiced.color} stop-opacity={0.3} />
                                <stop offset="95%" stop-color={config.invoiced.color} stop-opacity={0.05} />
                            </linearGradient>
                            <linearGradient id="fillCollected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stop-color={config.collected.color} stop-opacity={0.3} />
                                <stop offset="95%" stop-color={config.collected.color} stop-opacity={0.05} />
                            </linearGradient>
                            <linearGradient id="fillPending" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stop-color={config.pending.color} stop-opacity={0.3} />
                                <stop offset="95%" stop-color={config.pending.color} stop-opacity={0.05} />
                            </linearGradient>
                        </defs>

                        {#each Array(6) as _, i}
                            {@const y = padding.top + (chartHeight / 5) * i}
                            <line
                                x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                stroke="gray" stroke-width="1" stroke-dasharray="8 8" opacity={0.2}
                            />
                            {@const value = maxValue * (1 - i / 5)}
                            <text
                                x={padding.left - 10} y={y + 4} text-anchor="end"
                                class="text-sm fill-gray-400"
                            >
                                {formatYValue(Math.round(value))}
                            </text>
                        {/each}

                        {#each data as point, i}
                            {@const x = padding.left + xStep * i}
                            <text
                                x={x} y={height - padding.bottom + 20} text-anchor="middle"
                                class="uppercase text-sm fill-gray-400"
                            >
                                {point.date}
                            </text>
                        {/each}

                        <path d={invoicedAreaPath} fill={config.invoiced.fill} fill-opacity={0.4} />
                        <path d={collectedAreaPath} fill={config.collected.fill} fill-opacity={0.4} />
                        <path d={pendingAreaPath} fill={config.pending.fill} fill-opacity={0.4} />

                        <path d={invoicedLinePath} fill="none" stroke={config.invoiced.color} stroke-width="2" />
                        <path d={collectedLinePath} fill="none" stroke={config.collected.color} stroke-width="2" />
                        <path d={pendingLinePath} fill="none" stroke={config.pending.color} stroke-width="2" />

                        {#if hoveredPoint}
                            <line
                                x1={hoveredPoint.x} y1={padding.top}
                                x2={hoveredPoint.x} y2={height - padding.bottom}
                                stroke="#555" stroke-width="1" stroke-dasharray="2,2"
                            />

                            {@const getY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight}

                            <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.invoiced)} r="4" fill={config.invoiced.color} stroke="#333" stroke-width="2" />
                            <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.collected)} r="4" fill={config.collected.color} stroke="#333" stroke-width="2" />
                            <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.pending)} r="4" fill={config.pending.color} stroke="#333" stroke-width="2" />
                        {/if}
                    </svg>
                </div>

                {#if hoveredPoint}
                    <div
                        class="absolute bg-gray-700 text-gray-100 p-4 shadow-lg rounded-lg border border-gray-600 pointer-events-none z-10 min-w-[200px]"
                        style:transform="translate3d(calc({hoveredPoint.x / width * 100}% - 50%), 0, 0)"
                        style:top={`20px`}
                        style:left="0"
                    >
                        <div class="font-bold text-center mb-2 border-b border-gray-600 pb-2">
                            {hoveredPoint.data.date}
                        </div>
                        
                        <div class="space-y-2">
                            {#each Object.entries(config) as [key, { label, color }]}
                                {@const value = hoveredPoint.data[key] as number}
                                
                                <div class="flex items-center justify-between text-sm">
                                    <div class="flex items-center">
                                        <span class="w-2 h-2 rounded-full mr-2" style:background-color={color}></span>
                                        <span>{label}:</span>
                                    </div>
                                    <span class="ml-auto font-medium">{formatTooltipValue(key as keyof ChartDataItem, value)}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>