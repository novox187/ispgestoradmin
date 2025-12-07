<script lang="ts">
    //======================================================================
    // 1. TIPOS Y DATOS (WISP MikroTik)
    //======================================================================

    type TimePeriod = 'week' | 'month' | 'year';

    interface ChartDataItem {
        date: string;
        download: number; // Tráfico total de bajada (en GB o TB)
        upload: number; // Tráfico total de subida (en GB o TB)
        peak_usage: number; // Pico de consumo máximo (en Mbps)
        // Permite acceso dinámico por clave
        [key: string]: string | number; 
    }

    interface ChartConfig {
        [key: string]: { label: string; color: string; fill: string; unit: string };
    }

    // Datos Mock (Simulación de consumo de internet de un WISP)
    const mockData = {
        chartData: {
            week: [ // Datos Diarios (Ejemplo en GB y Mbps)
                { date: '05/07', download: 450, upload: 120, peak_usage: 550 },
                { date: '07/07', download: 510, upload: 140, peak_usage: 610 },
                { date: '08/07', download: 480, upload: 130, peak_usage: 580 },
                { date: '09/07', download: 550, upload: 150, peak_usage: 650 },
                { date: '10/07', download: 420, upload: 110, peak_usage: 520 },
                { date: '11/07', download: 390, upload: 100, peak_usage: 490 },
                { date: '12/07', download: 700, upload: 180, peak_usage: 800 }, // Pico de fin de semana
                { date: '13/07', download: 650, upload: 160, peak_usage: 750 }
            ],
            month: [ // Datos Semanales (Ejemplo en TB y Mbps)
                { date: 'Semana 1', download: 3.5, upload: 0.9, peak_usage: 700 },
                { date: 'Semana 2', download: 4.2, upload: 1.1, peak_usage: 850 },
                { date: 'Semana 3', download: 3.8, upload: 1.0, peak_usage: 780 },
                { date: 'Semana 4', download: 4.5, upload: 1.2, peak_usage: 900 }
            ],
            year: [ // Datos Mensuales (Ejemplo en TB y Mbps)
                { date: 'Ene', download: 15, upload: 4, peak_usage: 800 },
                { date: 'Feb', download: 16, upload: 4.5, peak_usage: 850 },
                { date: 'Mar', download: 18, upload: 5, peak_usage: 950 },
                { date: 'Abr', download: 17, upload: 4.8, peak_usage: 900 },
                { date: 'May', download: 19, upload: 5.5, peak_usage: 1000 },
                { date: 'Jun', download: 20, upload: 6, peak_usage: 1100 },
                { date: 'Jul', download: 22, upload: 6.5, peak_usage: 1200 },
                { date: 'Ago', download: 21, upload: 6.2, peak_usage: 1150 },
                { date: 'Sep', download: 23, upload: 7, peak_usage: 1300 },
                { date: 'Oct', download: 25, upload: 7.5, peak_usage: 1400 },
                { date: 'Nov', download: 24, upload: 7.2, peak_usage: 1350 },
                { date: 'Dic', download: 26, upload: 8, peak_usage: 1500 }
            ]
        }
    };
    
    // Configuración de métricas
    const config: ChartConfig = {
        download: {
            label: "Bajada (Down)",
            color: "#3b82f6", // Azul
            fill: "url(#fillDownload)",
            unit: "volume" // Para formato: TB, GB
        },
        upload: {
            label: "Subida (Up)",
            color: "#16a34a", // Verde
            fill: "url(#fillUpload)",
            unit: "volume"
        },
        peak_usage: {
            label: "Pico de Uso",
            color: "#f97316", // Naranja
            fill: "url(#fillPeakUsage)",
            unit: "speed" // Para formato: Mbps
        },
    };

    //======================================================================
    // 2. ESTADO Y LÓGICA PRINCIPAL (Pestañas)
    //======================================================================

    let activeTab = $state<TimePeriod>('year'); // Por defecto a 'year'
    let chartContainer = $state<HTMLDivElement | null>(null);
    let hoveredPoint = $state<{ x: number, data: ChartDataItem } | null>(null);
    
    // Datos y dimensiones derivados (Reacciona a activeTab)
    const data = $derived<ChartDataItem[]>(mockData.chartData[activeTab]);
    
    const width = 1000;
    const height = 320;
    const padding = { top: 20, right: 30, bottom: 30, left: 70 }; 
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calcula el valor máximo de todas las series en el periodo activo
    const maxValue = $derived(
        data.length > 0 
            ? Math.max(...data.flatMap(d => Object.values(d).filter(v => typeof v === 'number') as number[]), 0)
            : 0
    );

    const xStep = $derived(data.length > 1 ? chartWidth / (data.length - 1) : chartWidth);

    function handleTabChange(value: string) {
        activeTab = value as TimePeriod;
        hoveredPoint = null; // Reinicia el tooltip al cambiar de pestaña
    }

    //======================================================================
    // 3. UTILIDADES Y FORMATO (Adaptado a GB/TB y Mbps)
    //======================================================================

    // Formato para el eje Y
    function formatYValue(value: number): string {
        if (value === 0) return "";
        // Usamos 'K' para valores grandes (simulando TB o Gbps).
        if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}K`; 
        return value.toString();
    }

    // Formato para los valores del Tooltip
    function formatTooltipValue(key: keyof ChartDataItem, value: number): string {
        const unitType = config[key]?.unit;

        if (unitType === 'speed') {
            // Formato para Mbps (Pico de Uso)
            return `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })} Mbps`;
        }
        
        // Formato para Volumen (Bajada/Subida)
        if (activeTab === 'year' || activeTab === 'month') {
            // Periodos largos: mostrar en TB (valor * 1)
            return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} TB`;
        } else {
            // Periodos cortos (semana): mostrar en GB
            return `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })} GB`;
        }
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
    const downloadLinePath = $derived(createPath(data.map(d => d.download), maxValue));
    const downloadAreaPath = $derived(createAreaPath(data.map(d => d.download), maxValue));
    const uploadLinePath = $derived(createPath(data.map(d => d.upload), maxValue));
    const uploadAreaPath = $derived(createAreaPath(data.map(d => d.upload), maxValue));
    const peakUsageLinePath = $derived(createPath(data.map(d => d.peak_usage), maxValue));
    const peakUsageAreaPath = $derived(createAreaPath(data.map(d => d.peak_usage), maxValue));

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

<div class="p-6 bg-gray-900 text-gray-100 rounded-lg shadow-lg">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h2 class="text-xl font-bold">CONSUMO DE RED WISP MIKROTIK</h2>
            <p class="text-gray-400">Tráfico y picos de uso por periodo</p>
        </div>
    </div>

    <div class="bg-gray-800 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-4">
            <div class="flex p-1 rounded-lg bg-gray-700 max-md:w-full">
                {#each ['week', 'month', 'year'] as tab}
                    <button
                        class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        class:bg-gray-900={activeTab === tab}
                        class:text-white={activeTab === tab}
                        class:text-gray-400={activeTab !== tab}
                        onclick={() => handleTabChange(tab)}
                    >
                        {tab === 'week' ? 'SEMANA' : tab === 'month' ? 'MES' : 'AÑO'}
                    </button>
                {/each}
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
                        <linearGradient id="fillDownload" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stop-color={config.download.color} stop-opacity={0.3} />
                            <stop offset="95%" stop-color={config.download.color} stop-opacity={0.05} />
                        </linearGradient>
                        <linearGradient id="fillUpload" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stop-color={config.upload.color} stop-opacity={0.3} />
                            <stop offset="95%" stop-color={config.upload.color} stop-opacity={0.05} />
                        </linearGradient>
                        <linearGradient id="fillPeakUsage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stop-color={config.peak_usage.color} stop-opacity={0.3} />
                            <stop offset="95%" stop-color={config.peak_usage.color} stop-opacity={0.05} />
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

                    <path d={downloadAreaPath} fill={config.download.fill} fill-opacity={0.4} />
                    <path d={uploadAreaPath} fill={config.upload.fill} fill-opacity={0.4} />
                    <path d={peakUsageAreaPath} fill={config.peak_usage.fill} fill-opacity={0.4} />

                    <path d={downloadLinePath} fill="none" stroke={config.download.color} stroke-width="2" />
                    <path d={uploadLinePath} fill="none" stroke={config.upload.color} stroke-width="2" />
                    <path d={peakUsageLinePath} fill="none" stroke={config.peak_usage.color} stroke-width="2" />

                    {#if hoveredPoint}
                        <line
                            x1={hoveredPoint.x} y1={padding.top}
                            x2={hoveredPoint.x} y2={height - padding.bottom}
                            stroke="#555" stroke-width="1" stroke-dasharray="2,2"
                        />

                        {@const getY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight}

                        <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.download as number)} r="4" fill={config.download.color} stroke="#333" stroke-width="2" />
                        <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.upload as number)} r="4" fill={config.upload.color} stroke="#333" stroke-width="2" />
                        <circle cx={hoveredPoint.x} cy={getY(hoveredPoint.data.peak_usage as number)} r="4" fill={config.peak_usage.color} stroke="#333" stroke-width="2" />
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
        </div>
    </div>
</div>