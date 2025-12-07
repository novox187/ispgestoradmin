<script>
  const rebels = [
    { 
      id: 1, 
      name: 'KRIMSON', 
      handle: '@KRIMSON', 
      points: 148, 
      streak: '2 WEEKS STREAK 🔥',
      featured: true,
      color: 'from-purple-500 to-pink-500'
    },
    { 
      id: 2, 
      name: 'MATI', 
      handle: '@MATI', 
      points: 129, 
      featured: false,
      color: 'from-orange-500 to-red-500' 
    },
    { 
      id: 3, 
      name: 'PEM', 
      handle: '@MATT', 
      points: 108, 
      featured: false,
      color: 'from-green-500 to-emerald-500' 
    },
    { 
      id: 4, 
      name: 'JOYBOY', 
      handle: '@JOYBOY', 
      points: 64, 
      featured: false,
      color: 'from-blue-500 to-cyan-500' 
    }
  ];
</script>

<div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-2 text-xs font-mono text-gray-300">
      <div class="w-2 h-2 bg-blue-500 rounded-sm"></div>
      <span class="font-bold tracking-wide">REBELS RANKING</span>
    </div>
    <div class="bg-yellow-700/20 border border-yellow-700 text-yellow-600 px-3 py-1 rounded-md text-xs font-bold">
      2 NEW
    </div>
  </div>

  <div class="space-y-4">
    {#each rebels as rebel}
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-1 md:gap-2 w-full">
          <!-- Ranking Number -->
          <div class="{
            rebel.featured 
              ? 'h-10 bg-blue-600 text-white' 
              : 'h-8 bg-gray-800 text-gray-300'
            } flex items-center justify-center rounded text-sm font-bold px-1.5 mr-1 md:mr-2 flex-shrink-0">
            {rebel.id}
          </div>
          
          <!-- Avatar -->
          <div class="{
            rebel.featured 
              ? 'w-14 h-14 md:w-16 md:h-16' 
              : 'w-10 h-10 md:w-12 md:h-12'
            } rounded-lg overflow-hidden bg-gradient-to-br {rebel.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg">
            {rebel.name.charAt(0)}
          </div>
          
          <!-- Content Container -->
          <div class="{
            rebel.featured ? 'bg-gray-800/50' : ''
            } flex flex-1 h-full items-center justify-between py-2 px-2.5 rounded">
            <div class="flex flex-col flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-baseline gap-2 flex-1 min-w-0">
                  <span class="{
                    rebel.featured 
                      ? 'text-xl md:text-2xl' 
                      : 'text-lg md:text-xl'
                    } font-bold text-white tracking-wide truncate">
                    {rebel.name}
                  </span>
                  <span class="text-gray-400 text-xs md:text-sm whitespace-nowrap">
                    {rebel.handle}
                  </span>
                </div>
                
                <!-- Points Badge -->
                <div class="{
                  rebel.featured 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300'
                  } px-3 md:px-4 py-1.5 md:py-2 rounded-md font-bold text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                  {rebel.points} POINTS
                </div>
              </div>
              
              {#if rebel.streak}
                <span class="text-sm text-orange-400 italic mt-0.5">
                  {rebel.streak}
                </span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
