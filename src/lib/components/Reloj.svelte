<script lang="ts">
  import { onMount } from 'svelte';
  
  let currentTime = $state('');
  let currentDate = $state('');
  let currentFullDate = $state('');
  let location = $state('Cargando...');
  let temperature = $state('--');
  let timezone = $state('UTC');
  
  // Cargar datos del localStorage al iniciar
  if (typeof window !== 'undefined') {
    const savedLocation = localStorage.getItem('user_location');
    const savedTemperature = localStorage.getItem('user_temperature');
    
    if (savedLocation) location = savedLocation;
    if (savedTemperature) temperature = savedTemperature;
  }

  onMount(() => {
    // Actualizar hora y fecha
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      currentTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
      currentDate = days[now.getDay()];
      
      const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const month = months[now.getMonth()];
      const day = now.getDate();
      const year = now.getFullYear();
      currentFullDate = `${day} DE ${month} DE ${year}`;
      
      // Obtener timezone offset
      const offset = -now.getTimezoneOffset() / 60;
      timezone = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    // Obtener ubicación y clima
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Obtener nombre de la ciudad usando reverse geocoding
            const geoResponse = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const geoData = await geoResponse.json();
            
            const city = geoData.city || geoData.locality || 'Unknown';
            const country = geoData.countryName || '';
            const newLocation = `${city.toUpperCase()}${country ? ', ' + country.toUpperCase() : ''}`;
            
            // Actualizar ubicación y guardar en localStorage
            location = newLocation;
            localStorage.setItem('user_location', newLocation);
            
            // Obtener temperatura usando Open-Meteo (API gratuita sin necesidad de key)
            const weatherResponse = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=celsius`
            );
            const weatherData = await weatherResponse.json();
            
            if (weatherData.current && weatherData.current.temperature_2m) {
              const newTemperature = `${Math.round(weatherData.current.temperature_2m)}°C`;
              temperature = newTemperature;
              localStorage.setItem('user_temperature', newTemperature);
            }
          } catch (error) {
            console.error('Error fetching location or weather:', error);
            location = 'Ubicación no disponible';
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          location = 'Ubicación deshabilitada';
        }
      );
    } else {
      location = 'Geolocalización no soportada';
    }
    
    return () => clearInterval(interval);
  });
</script>

<!-- Clock Section -->
<div class="hidden xl:block w-full aspect-[1.7] relative overflow-hidden border-b border-gray-800">

  <div class="bg-gray-800/30 flex-1 flex flex-col justify-between p-6 text-sm font-medium uppercase relative z-20 h-full">
    <!-- Top Row: Day and Full Date -->
    <div class="flex justify-between items-center">
      <span class="opacity-50 text-xs font-mono text-gray-400">{currentDate}</span>
      <span class="text-xs font-mono text-gray-300">{currentFullDate}</span>
    </div>
    
    <!-- Center: Time -->
    <div class="text-center">
      <div class="text-5xl font-bold text-white tracking-tight">
        {currentTime}
      </div>
    </div>
    
    <!-- Bottom Row: Temperature, Location, Timezone -->
    <div class="flex justify-between items-center">
      <span class="opacity-50 text-xs font-mono text-gray-400">{temperature}</span>
      <span class="text-xs font-mono text-gray-300 truncate mx-2">{location}</span>
      <div class="bg-gray-800 text-gray-300 px-3 py-1 rounded-md text-xs font-mono font-bold">
        {timezone}
      </div>
    </div>
    
    <!-- Blueprint Background -->
    <div class="absolute inset-0 -z-[1]">
      <img 
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pc_blueprint-ASlP61EbeLtvqDQwiHwYbCvsQKKiJR.gif" 
        alt="Computer Blueprint" 
        class="w-full h-full object-contain"
      />
    </div>
  </div>
</div>
