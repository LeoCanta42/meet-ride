<script setup lang="ts">
import type { EventItem, ConvoyRoutePlan, ConvoyWaypoint, CarWithSeats } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  event: EventItem
  isOrganizer: boolean
  routePlan?: ConvoyRoutePlan | null
  cars: CarWithSeats[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'calculate'): void
  (e: 'update-arrival-time', time: string): void
  (e: 'show-passenger', passengerId: string): void
}>()

const { t } = useI18n()
const mapContainer = ref<HTMLElement | null>(null)
let leafletLib: any = null
let leafletMap: any = null
let leafletMarkersLayer: any = null
let leafletPolylinesLayer: any = null
let isInitializingMap = false

const showEditTimeModal = ref(false)
const newArrivalTime = ref('')

export interface CarRouteItem {
  carName: string
  color: string
  points: [number, number][]
  waypoints: ConvoyWaypoint[]
  fullWaypoints: ConvoyWaypoint[]
}

export interface ConvoySegmentItem {
  id: string
  label: string
  color: string
  fromWp: ConvoyWaypoint
  toWp: ConvoyWaypoint
  points: [number, number][]
  carNames: string[]
}

const ROUTE_COLORS = [
  '#0284c7', // Sky Blue (Auto 1)
  '#f97316', // Vivid Orange (Auto 2)
  '#6366f1', // Indigo (Auto 3)
  '#06b6d4', // Cyan (Auto 4)
  '#f43f5e', // Rose (Auto 5)
  '#d97706', // Amber / Ochre (Auto 6)
  '#ec4899', // Magenta Pink (Auto 7)
  '#3b82f6', // Royal Blue (Auto 8)
  '#84cc16', // Lime (Auto 9)
  '#e11d48'  // Crimson (Auto 10)
]

const CONVOY_COLORS = [
  '#10b981', // Emerald Green (Tratta Convoglio 1)
  '#a855f7', // Vivid Purple (Tratta Convoglio 2)
  '#eab308', // Amber Gold (Tratta Convoglio 3)
  '#14b8a6'  // Teal (Tratta Convoglio 4)
]

function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 9999
  const match = timeStr.match(/(\d{1,2}):(\d{2})/)
  if (match && match[1] && match[2]) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  }
  return 9999
}

watch(
  () => props.event.arrivalTime,
  (val) => {
    if (val) newArrivalTime.value = val
  },
  { immediate: true }
)

const activePlan = computed(() => {
  return props.routePlan || props.event.routePlan || null
})

// Build distinct trajectories for each car so drivers are NOT cross-connected before meeting points
const computedCarRoutes = computed<CarRouteItem[]>(() => {
  const plan = activePlan.value
  if (!plan || !plan.waypoints || plan.waypoints.length === 0) return []

  const waypoints = plan.waypoints

  // 1. Collect distinct cars starting from 'start' waypoints
  const carStarts = waypoints.filter(w => w.type === 'start')
  const carNames: string[] = []

  carStarts.forEach(cs => {
    (cs.carNames || []).forEach(cn => {
      const clean = cn.trim()
      if (clean && !carNames.includes(clean)) carNames.push(clean)
    })
  })

  // If no start waypoint had carNames, gather from all waypoints
  if (carNames.length === 0) {
    waypoints.forEach(w => {
      (w.carNames || []).forEach(cn => {
        const clean = cn.trim()
        if (clean && !carNames.includes(clean)) carNames.push(clean)
      })
    })
  }

  // If still empty, fallback from props.cars
  if (carNames.length === 0 && props.cars && props.cars.length > 0) {
    props.cars.forEach(c => {
      const label = `${c.rider.carModel || 'Auto'} di ${c.rider.name}`
      if (!carNames.includes(label)) carNames.push(label)
    })
  }

  const destinationWp = waypoints.find(w => w.type === 'destination')

  // If only 1 car or no cars found, treat all waypoints as single trajectory
  if (carNames.length <= 1) {
    const singlePoints = waypoints
      .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')
      .map(w => [w.lat, w.lng] as [number, number])
    return [{
      carName: carNames[0] || 'Itinerario Evento',
      color: ROUTE_COLORS[0] || '#0284c7',
      points: singlePoints,
      waypoints: [...waypoints],
      fullWaypoints: [...waypoints]
    }]
  }

  const allLowerCarNames = carNames.map(c => c.toLowerCase())

  // Pass 1: Compute the full chronological waypoint sequence for each car
  const rawCarWps = carNames.map((carName, idx) => {
    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7'
    const lowerName = carName.toLowerCase()

    const relevantWps = waypoints.filter(wp => {
      if (wp.type === 'destination') return true
      if (!wp.carNames || wp.carNames.length === 0) return false

      return wp.carNames.some(cn => {
        const lCn = cn.trim().toLowerCase()
        if (!lCn) return false
        if (lCn === lowerName) return true
        if (allLowerCarNames.some((other, oIdx) => oIdx !== idx && other === lCn)) {
          return false
        }
        const subMatch = lowerName.includes(lCn) || lCn.includes(lowerName)
        if (subMatch) {
          const matchesOtherToo = allLowerCarNames.some(
            (other, oIdx) => oIdx !== idx && (other.includes(lCn) || lCn.includes(other))
          )
          if (!matchesOtherToo) return true
        }
        return false
      })
    })

    relevantWps.sort((a, b) => {
      return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
    })

    if (destinationWp && !relevantWps.includes(destinationWp)) {
      relevantWps.push(destinationWp)
    }

    return { carName, color, relevantWps }
  })

  // Count how many cars actually pass through each waypoint so a 'meeting_point'
  // only merges lines when at least 2 cars genuinely converge there
  const wpCarCount = new Map<ConvoyWaypoint, number>()
  rawCarWps.forEach(({ relevantWps }) => {
    relevantWps.forEach(wp => {
      wpCarCount.set(wp, (wpCarCount.get(wp) || 0) + 1)
    })
  })

  // Pass 2: Build each car's individual leg up to its first shared meeting_point
  // (Cars that do not pass through any shared meeting_point go directly to destination)
  return rawCarWps.map(({ carName, color, relevantWps }) => {
    const firstMeetingIdx = relevantWps.findIndex(
      w => w.type === 'meeting_point' && (wpCarCount.get(w) || 0) >= 2
    )
    const individualWps = firstMeetingIdx !== -1
      ? relevantWps.slice(0, firstMeetingIdx + 1)
      : [...relevantWps]

    const points = individualWps
      .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')
      .map(w => [w.lat, w.lng] as [number, number])

    return {
      carName,
      color,
      points,
      waypoints: individualWps,
      fullWaypoints: relevantWps
    }
  })
})

// Build single unified convoy segments from each shared meeting_point to the next waypoint/destination
const computedConvoySegments = computed<ConvoySegmentItem[]>(() => {
  const routes = computedCarRoutes.value
  if (routes.length <= 1) return []

  const wpCarCount = new Map<ConvoyWaypoint, number>()
  routes.forEach(r => {
    r.fullWaypoints.forEach(wp => {
      wpCarCount.set(wp, (wpCarCount.get(wp) || 0) + 1)
    })
  })

  const segmentMap = new Map<string, {
    fromWp: ConvoyWaypoint
    toWp: ConvoyWaypoint
    carNames: string[]
  }>()

  routes.forEach(route => {
    const full = route.fullWaypoints
    const firstMeetingIdx = full.findIndex(
      w => w.type === 'meeting_point' && (wpCarCount.get(w) || 0) >= 2
    )
    if (firstMeetingIdx === -1) return

    for (let i = firstMeetingIdx; i < full.length - 1; i++) {
      const fromWp = full[i]
      const toWp = full[i + 1]
      if (
        !fromWp ||
        !toWp ||
        typeof fromWp.lat !== 'number' ||
        typeof fromWp.lng !== 'number' ||
        typeof toWp.lat !== 'number' ||
        typeof toWp.lng !== 'number'
      ) {
        continue
      }

      const key = `${fromWp.lat.toFixed(5)},${fromWp.lng.toFixed(5)}->${toWp.lat.toFixed(5)},${toWp.lng.toFixed(5)}`
      const existing = segmentMap.get(key)
      if (existing) {
        if (!existing.carNames.includes(route.carName)) {
          existing.carNames.push(route.carName)
        }
      } else {
        segmentMap.set(key, {
          fromWp,
          toWp,
          carNames: [route.carName]
        })
      }
    }
  })

  return Array.from(segmentMap.entries()).map(([key, item], idx) => {
    const color = CONVOY_COLORS[idx % CONVOY_COLORS.length] || '#10b981'
    return {
      id: key,
      label: `Convoglio: ${item.fromWp.name} → ${item.toWp.name}`,
      color,
      fromWp: item.fromWp,
      toWp: item.toWp,
      points: [
        [item.fromWp.lat, item.fromWp.lng],
        [item.toWp.lat, item.toWp.lng]
      ],
      carNames: item.carNames
    }
  })
})

// Stable fingerprint to avoid repeated map redraws when props.event reference changes
const activePlanKey = computed(() => {
  const plan = activePlan.value
  if (!plan) return 'empty'
  const routeKey = computedCarRoutes.value
    .map(r => `${r.carName}:${r.points.length}`)
    .join('|')
  const convoyKey = computedConvoySegments.value
    .map(s => `${s.id}:${s.carNames.length}`)
    .join('|')
  return `${plan.waypoints?.length || 0}_${routeKey}_${convoyKey}_${plan.calculatedAt || ''}`
})

async function getLeaflet() {
  if (!leafletLib) {
    leafletLib = await import('leaflet')
  }
  return leafletLib
}

async function initOrUpdateMap() {
  if (!import.meta.client || !mapContainer.value) return
  if (isInitializingMap) return
  isInitializingMap = true

  try {
    const L = await getLeaflet()
    if (!mapContainer.value) return

    // If map instance already exists, just update its layers cleanly without rebuilding the DOM or re-fetching tiles
    if (leafletMap) {
      renderPlanOnMap(L)
      return
    }

    leafletMap = L.map(mapContainer.value, {
      zoomControl: true,
      scrollWheelZoom: false
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(leafletMap)

    leafletMarkersLayer = L.layerGroup().addTo(leafletMap)
    leafletPolylinesLayer = L.layerGroup().addTo(leafletMap)

    renderPlanOnMap(L)
  } catch (err) {
    console.error('Failed initializing Leaflet map:', err)
  } finally {
    isInitializingMap = false
  }
}

function renderPlanOnMap(L: any) {
  if (!leafletMap) return

  if (leafletMarkersLayer) {
    leafletMarkersLayer.clearLayers()
  } else {
    leafletMarkersLayer = L.layerGroup().addTo(leafletMap)
  }

  if (leafletPolylinesLayer) {
    leafletPolylinesLayer.clearLayers()
  } else {
    leafletPolylinesLayer = L.layerGroup().addTo(leafletMap)
  }

  const plan = activePlan.value
  const allPoints: [number, number][] = []
  const routes = computedCarRoutes.value

  if (plan && plan.waypoints && plan.waypoints.length > 0) {
    // 1. Draw individual waypoints with contextual styling
    plan.waypoints.forEach((wp) => {
      const lat = wp.lat
      const lng = wp.lng
      if (typeof lat !== 'number' || typeof lng !== 'number') return
      allPoints.push([lat, lng])

      let bgClass = 'bg-sky-600'
      let customColorStyle = ''
      let iconHtml = '🚗'
      let typeLabel = 'Partenza Auto'

      if (wp.type === 'start') {
        const matchingRoute = routes.find(r => r.waypoints.includes(wp))
        if (matchingRoute) {
          customColorStyle = `background-color: ${matchingRoute.color};`
        } else {
          bgClass = 'bg-sky-600'
        }
        iconHtml = '🚗'
        typeLabel = 'Partenza Auto'
      } else if (wp.type === 'meeting_point') {
        const matchingConvoySeg = computedConvoySegments.value.find(s => s.fromWp === wp)
        if (matchingConvoySeg) {
          customColorStyle = `background-color: ${matchingConvoySeg.color};`
          bgClass = 'ring-4 ring-emerald-300/40 animate-pulse'
        } else {
          bgClass = 'bg-amber-500 ring-4 ring-amber-300/40 animate-pulse'
        }
        iconHtml = '🤝'
        typeLabel = 'Punto di Ritrovo Convoglio'
      } else if (wp.type === 'pickup') {
        bgClass = 'bg-indigo-600 ring-4 ring-indigo-300/40'
        iconHtml = '🙋'
        typeLabel = 'Salita / Fermata Passeggero'
      } else if (wp.type === 'destination') {
        bgClass = 'bg-emerald-600 ring-4 ring-emerald-300/40'
        iconHtml = '🏁'
        typeLabel = 'Destinazione Finale'
      }

      const customIcon = L.divIcon({
        className: 'custom-convoy-marker',
        html: `
          <div class="flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shadow-lg ${bgClass}" ${customColorStyle ? `style="${customColorStyle}"` : ''}>
            ${iconHtml}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })

      const marker = L.marker([lat, lng], { icon: customIcon })
      const carNamesText = wp.carNames && wp.carNames.length > 0
        ? `<div class="mt-1 text-[11px] font-semibold text-slate-600">Auto: ${wp.carNames.join(', ')}</div>`
        : ''

      marker.bindPopup(`
        <div class="p-1 font-sans">
          <div class="text-[10px] uppercase font-bold text-slate-400">${typeLabel}</div>
          <div class="text-xs font-bold text-slate-900">${wp.name}</div>
          <div class="text-[11px] font-bold text-sky-600 mt-0.5">Ore ${wp.time}</div>
          <div class="text-[11px] text-slate-600 mt-1">${wp.description || ''}</div>
          ${carNamesText}
        </div>
      `)

      leafletMarkersLayer.addLayer(marker)
    })

    // 2. Draw independent trajectories for each car up to the meeting point
    routes.forEach((route) => {
      if (route.points.length > 1) {
        const polyline = L.polyline(route.points, {
          color: route.color,
          weight: 5,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        })

        const stopsList = route.waypoints.map(w => `• ${w.time} [${w.name}]`).join('<br>')
        polyline.bindPopup(`
          <div class="p-1.5 font-sans">
            <div class="flex items-center gap-1.5 font-bold text-xs" style="color: ${route.color}">
              <span>🚗</span>
              <span>${route.carName}</span>
            </div>
            <div class="text-[11px] text-slate-700 mt-1.5 font-medium leading-relaxed">
              ${stopsList}
            </div>
          </div>
        `)

        leafletPolylinesLayer.addLayer(polyline)
      }
    })

    // 3. Draw single unified line(s) with distinct color from meeting point onwards
    const convoySegments = computedConvoySegments.value
    convoySegments.forEach((seg) => {
      const polyline = L.polyline(seg.points, {
        color: seg.color,
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      })

      polyline.bindPopup(`
        <div class="p-1.5 font-sans">
          <div class="flex items-center gap-1.5 font-bold text-xs" style="color: ${seg.color}">
            <span>🤝</span>
            <span>${seg.label}</span>
          </div>
          <div class="text-[11px] text-slate-600 mt-1 font-semibold">
            Auto in convoglio: ${seg.carNames.join(', ')}
          </div>
          <div class="text-[11px] text-slate-700 mt-1 font-medium leading-relaxed">
            • ${seg.fromWp.time} [${seg.fromWp.name}]<br>
            • ${seg.toWp.time} [${seg.toWp.name}]
          </div>
        </div>
      `)

      leafletPolylinesLayer.addLayer(polyline)
    })

    // 3. Fit map bounds to all waypoints
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints)
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  } else {
    // Default view centered on destination or default coordinates
    const lat = props.event.destinationCoords?.lat || 37.5
    const lng = props.event.destinationCoords?.lng || 15.0
    leafletMap.setView([lat, lng], 10)
  }
}

watch(
  activePlanKey,
  () => {
    if (import.meta.client) {
      nextTick(() => {
        initOrUpdateMap()
      })
    }
  }
)

onMounted(() => {
  nextTick(() => {
    initOrUpdateMap()
  })
})

onBeforeUnmount(() => {
  if (leafletMap) {
    leafletMap.remove()
    leafletMap = null
    leafletMarkersLayer = null
    leafletPolylinesLayer = null
  }
})

function saveArrivalTime() {
  if (newArrivalTime.value.trim()) {
    emit('update-arrival-time', newArrivalTime.value.trim())
    showEditTimeModal.value = false
  }
}
</script>

<template>
  <div class="surface-card rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
    <!-- Header with arrival time and action button -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div class="flex items-start gap-3 min-w-0">
        <div class="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold shadow-md shadow-sky-500/20">
          <UIcon name="i-lucide-route" class="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
              Itinerario di Gruppo & Assegnazione Posti
            </h3>
            <span class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              AI Gemini Powered
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Assegna autonomamente i passeggeri alle auto per percorso, calcola le tappe e i punti di ritrovo per viaggiare insieme in convoglio.
          </p>
        </div>
      </div>

      <!-- Arrival Time Badge & Actions -->
      <div class="flex items-center flex-wrap gap-2 shrink-0">
        <!-- Target Arrival Time Badge -->
        <div class="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <UIcon name="i-lucide-clock" class="h-3.5 w-3.5 text-amber-500" />
          <span>Arrivo: <strong>{{ event.arrivalTime || '20:30' }}</strong></span>
          <button
            v-if="isOrganizer"
            type="button"
            class="text-sky-600 hover:text-sky-700 dark:text-sky-400 ml-1 cursor-pointer"
            title="Modifica orario di arrivo"
            @click="showEditTimeModal = true"
          >
            <UIcon name="i-lucide-pencil" class="h-3 w-3" />
          </button>
        </div>

        <!-- Organizer AI Calculation Button -->
        <UButton
          v-if="isOrganizer"
          color="primary"
          size="sm"
          :loading="loading"
          @click="emit('calculate')"
          class="font-semibold text-xs shadow-sm cursor-pointer"
        >
          <UIcon name="i-lucide-sparkles" class="h-4 w-4 mr-1.5" />
          <span>{{ activePlan ? 'Ricalcola Itinerario & Posti con AI' : 'Calcola Itinerario & Assegna Posti con AI' }}</span>
        </UButton>
      </div>
    </div>

    <!-- AI Passenger Assignments Section (if present) -->
    <div
      v-if="activePlan && activePlan.passengerAssignments && activePlan.passengerAssignments.length > 0"
      class="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 sm:p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-3"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <UIcon name="i-lucide-users" class="h-4 w-4" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">
              Assegnazione Passeggeri Ottimizzata dall'AI
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              I posti sono stati assegnati automaticamente in base a prossimità geografica, rotte convergenti e capienza.
            </p>
          </div>
        </div>
        <span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
          {{ activePlan.passengerAssignments.length }} passeggeri posizionati
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <div
          v-for="asgn in activePlan.passengerAssignments"
          :key="asgn.passengerId"
          @click="emit('show-passenger', asgn.passengerId)"
          class="rounded-xl border border-emerald-100 bg-white/90 p-2.5 shadow-2xs dark:border-emerald-900/40 dark:bg-slate-900/80 space-y-1 cursor-pointer hover:border-emerald-400 hover:shadow-xs transition-all"
          :title="'Clicca per vedere i dettagli di ' + asgn.passengerName"
        >
          <div class="flex items-center justify-between gap-1.5">
            <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UIcon name="i-lucide-user" class="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              {{ asgn.passengerName }}
            </span>
            <span class="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md truncate max-w-[170px]">
              🚗 {{ asgn.carLabel }}
            </span>
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
            {{ asgn.reason }}
          </p>
        </div>
      </div>
    </div>

    <!-- Warning if any passenger is unassigned due to full capacity -->
    <div
      v-if="activePlan && activePlan.unassignedPassengers && activePlan.unassignedPassengers.length > 0"
      class="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
    >
      <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <span class="font-bold block">Attenzione: capienza totale auto esaurita</span>
        <span class="text-[11px] text-amber-800 dark:text-amber-300 block mt-0.5">
          I seguenti passeggeri non hanno trovato posto nelle auto disponibili:
          <strong>{{ activePlan.unassignedPassengers.map(u => u.passengerName).join(', ') }}</strong>.
          Offri un'altra auto per accoglierli tutti!
        </span>
      </div>
    </div>

    <!-- Distinct Car Routes & Unified Convoy Legend -->
    <div
      v-if="activePlan && computedCarRoutes.length > 0"
      class="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
    >
      <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
        <UIcon name="i-lucide-route" class="h-3.5 w-3.5 text-sky-500" />
        <span>Tratte Sulla Mappa:</span>
      </span>
      <div
        v-for="route in computedCarRoutes"
        :key="route.carName"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs"
        :style="{
          backgroundColor: route.color + '18',
          color: route.color,
          border: '1.5px solid ' + route.color
        }"
      >
        <span class="inline-block h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: route.color }" />
        <span class="truncate max-w-[220px]">🚗 {{ route.carName }}</span>
        <span class="text-[10px] opacity-75 font-normal">({{ route.waypoints.length }} tappe)</span>
      </div>

      <!-- Unified Convoy Segment Badges -->
      <div
        v-for="seg in computedConvoySegments"
        :key="seg.id"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs"
        :style="{
          backgroundColor: seg.color + '18',
          color: seg.color,
          border: '1.5px solid ' + seg.color
        }"
      >
        <span class="inline-block h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: seg.color }" />
        <span class="truncate max-w-[260px]">🤝 {{ seg.label }}</span>
      </div>
    </div>

    <!-- Map container -->
    <div class="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-inner">
      <div
        ref="mapContainer"
        class="h-64 sm:h-80 w-full z-0 bg-slate-100 dark:bg-slate-900"
      />

      <!-- Empty state banner if no route calculated yet -->
      <div
        v-if="!activePlan"
        class="absolute inset-0 bg-white/85 dark:bg-slate-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-10"
      >
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 mb-3 shadow-sm">
          <UIcon name="i-lucide-navigation" class="h-6 w-6" />
        </div>
        <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">
          Itinerario e assegnazione posti non ancora generati
        </h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 leading-relaxed">
          In base alle posizioni di guidatori e passeggeri, Gemini AI assegnerà autonomamente i passeggeri alle auto per ottimizzare il tragitto, troverà i punti di ritrovo intermedi per viaggiare in convoglio e calcolerà i tempi per arrivare a destinazione alle {{ event.arrivalTime || '20:30' }}.
        </p>

        <UButton
          v-if="isOrganizer"
          color="primary"
          size="md"
          :loading="loading"
          @click="emit('calculate')"
          class="mt-4 font-semibold text-xs shadow-md shadow-sky-500/20 cursor-pointer"
        >
          <UIcon name="i-lucide-sparkles" class="h-4 w-4 mr-1.5" />
          Calcola Itinerario & Assegna Posti con Gemini AI
        </UButton>
        <span v-else class="text-[11px] text-slate-400 mt-2 font-medium">
          L'organizzatore dell'evento genererà l'itinerario a breve.
        </span>
      </div>
    </div>

    <!-- Edit Arrival Time Modal -->
    <UModal
      :open="showEditTimeModal"
      @update:open="showEditTimeModal = $event"
      title="Orario di Arrivo Desiderato"
      description="Imposta l'orario entro cui tutte le auto devono essere a destinazione."
      :ui="{ content: 'sm:max-w-sm' }"
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Orario di arrivo a destinazione *
            </label>
            <UInput
              v-model="newArrivalTime"
              placeholder="es. 20:30 o 21:00"
              icon="i-lucide-clock"
              class="w-full font-mono text-sm"
              autofocus
            />
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Gemini AI calcolerà gli orari di partenza delle varie auto a ritroso rispetto a quest'orario.
            </p>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showEditTimeModal = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              size="sm"
              class="font-semibold"
              @click="saveArrivalTime"
            >
              Salva Orario
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
@import 'leaflet/dist/leaflet.css';

.custom-convoy-marker {
  background: transparent;
  border: none;
}
</style>
