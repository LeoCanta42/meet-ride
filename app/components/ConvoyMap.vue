<script setup lang="ts">
import type { EventItem, ConvoyRoutePlan, ConvoyWaypoint, CarWithSeats } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  event: EventItem
  isOrganizer: boolean
  routePlan?: ConvoyRoutePlan | null
  cars: CarWithSeats[]
  unassignedCount?: number
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'calculate'): void
  (e: 'open-optimizer'): void
  (e: 'update-arrival-time', time: string): void
  (e: 'show-passenger', passengerId: string): void
}>()

const allPassengersAssigned = computed(() => (props.unassignedCount || 0) === 0)
const manualMeetingPointsCount = computed(() => (props.event.meetingPoints || []).length)

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
  waypoints: ConvoyWaypoint[]
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

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = dLng * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.sqrt(dLat * dLat + x * x) * R
}

function isWaypointAfterMeetingPoint(
  startWp: ConvoyWaypoint | undefined,
  pWp: ConvoyWaypoint,
  mpWp: ConvoyWaypoint,
  destWp: ConvoyWaypoint | undefined
): boolean {
  if (
    typeof pWp.lat !== 'number' ||
    typeof pWp.lng !== 'number' ||
    typeof mpWp.lat !== 'number' ||
    typeof mpWp.lng !== 'number'
  ) {
    return parseTimeToMinutes(pWp.time) > parseTimeToMinutes(mpWp.time)
  }

  const pCoords = { lat: pWp.lat, lng: pWp.lng }
  const mpCoords = { lat: mpWp.lat, lng: mpWp.lng }
  const distMpToP = haversineKm(mpCoords, pCoords)
  if (distMpToP <= 0.8) return false

  if (startWp && typeof startWp.lat === 'number' && typeof startWp.lng === 'number') {
    const startCoords = { lat: startWp.lat, lng: startWp.lng }
    const distStartToP = haversineKm(startCoords, pCoords)
    if (distStartToP <= 0.8) return false

    const distStartToMp = haversineKm(startCoords, mpCoords)
    if (distStartToMp <= 0.8) return true

    if (destWp && typeof destWp.lat === 'number' && typeof destWp.lng === 'number') {
      const destCoords = { lat: destWp.lat, lng: destWp.lng }
      const distMpToDest = haversineKm(mpCoords, destCoords)
      const distPToDest = haversineKm(pCoords, destCoords)
      const routeBefore = distStartToP + distMpToP + distMpToDest
      const routeAfter = distStartToMp + distMpToP + distPToDest
      if (routeAfter + 0.5 < routeBefore) return true
    }

    if (distStartToP > distStartToMp + 0.5 && distMpToP < distStartToP) {
      return true
    }
    return false
  }

  if (destWp && typeof destWp.lat === 'number' && typeof destWp.lng === 'number') {
    const destCoords = { lat: destWp.lat, lng: destWp.lng }
    return haversineKm(pCoords, destCoords) + 0.5 < haversineKm(mpCoords, destCoords)
  }

  return parseTimeToMinutes(pWp.time) > parseTimeToMinutes(mpWp.time)
}

function computeRouteFingerprint(
  destination?: string | null,
  arrivalTime?: string | null,
  meetingPoints?: any[] | null,
  cars?: CarWithSeats[] | null
): string {
  const dest = (destination || '').trim().toLowerCase()
  const arrTime = (arrivalTime || '').trim()

  const mps = (meetingPoints || [])
    .map(mp => `${(mp.name || '').trim().toLowerCase()}#${mp.time || ''}#${(mp.riderIds || []).slice().sort().join(',')}`)
    .sort()
    .join('|')

  const carsPart = (cars || [])
    .slice()
    .sort((a, b) => a.rider.id.localeCompare(b.rider.id))
    .map(c => {
      const riderKey = `${c.rider.id}#${(c.rider.departureLocation || '').trim().toLowerCase()}#${c.rider.departureTime || ''}`
      const passKey = (c.passengers || [])
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(p => `${p.id}#${(p.pickupLocation || '').trim().toLowerCase()}`)
        .join(',')
      return `${riderKey}-->${passKey}`
    })
    .join('||')

  return `${dest}__${arrTime}__${mps}__${carsPart}`
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

const currentFingerprint = computed(() => {
  return computeRouteFingerprint(
    props.event.destination,
    props.event.arrivalTime,
    props.event.meetingPoints,
    props.cars
  )
})

const isPlanUpToDate = computed(() => {
  const plan = activePlan.value
  if (!plan) return false

  // If inputFingerprint was recorded at calculation time, compare directly
  if (plan.inputFingerprint) {
    return plan.inputFingerprint === currentFingerprint.value
  }

  // Fallback for plans calculated before inputFingerprint was introduced
  const destWp = plan.waypoints?.find(w => w.type === 'destination')
  const planDest = destWp?.name?.trim().toLowerCase() || ''
  const currentDest = (props.event.destination || '').trim().toLowerCase()
  if (planDest !== currentDest) return false

  const planArrTime = (plan.arrivalTime || '').trim()
  const currentArrTime = (props.event.arrivalTime || '20:30').trim()
  if (planArrTime && currentArrTime && planArrTime !== currentArrTime) return false

  const mpWps = plan.waypoints?.filter(w => w.type === 'meeting_point') || []
  const currentMps = props.event.meetingPoints || []
  if (mpWps.length !== currentMps.length) return false

  const startWps = plan.waypoints?.filter(w => w.type === 'start') || []
  if (startWps.length !== props.cars.length) return false

  const pickupWps = plan.waypoints?.filter(w => w.type === 'pickup') || []
  const totalAssignedPassengers = props.cars.reduce((sum, c) => sum + c.passengers.length, 0)
  if (pickupWps.length !== totalAssignedPassengers) return false

  return true
})

const shouldShowCalculateButton = computed(() => {
  if (!props.isOrganizer) return false
  if (!allPassengersAssigned.value || props.cars.length === 0) return false
  if (!activePlan.value) return true
  return !isPlanUpToDate.value
})

// Build distinct trajectories for each car before meeting points, and unify their convoy chain after meeting points
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

  // Pass 1: Collect relevant waypoints per car
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

  // Count how many cars pass through each meeting_point waypoint
  const wpCarCount = new Map<ConvoyWaypoint, number>()
  rawCarWps.forEach(({ relevantWps }) => {
    relevantWps.forEach(wp => {
      if (wp.type === 'meeting_point') {
        wpCarCount.set(wp, (wpCarCount.get(wp) || 0) + 1)
      }
    })
  })

  // Pass 2: Partition each car's stops into pre-meeting vs post-meeting (convoy) stops
  const carSplitMap = rawCarWps.map(({ carName, color, relevantWps }) => {
    const startWp = relevantWps.find(w => w.type === 'start')
    const sharedMpWp = relevantWps.find(
      w => w.type === 'meeting_point' && (wpCarCount.get(w) || 0) >= 2
    )

    if (!sharedMpWp) {
      return {
        carName,
        color,
        sharedMpWp: null as ConvoyWaypoint | null,
        preWps: [...relevantWps],
        postPickups: [] as ConvoyWaypoint[]
      }
    }

    const preWps: ConvoyWaypoint[] = []
    const postPickups: ConvoyWaypoint[] = []

    for (const wp of relevantWps) {
      if (wp === sharedMpWp || wp.type === 'destination') continue
      if (wp.type === 'start') {
        preWps.push(wp)
        continue
      }
      if (wp.type === 'pickup') {
        if (isWaypointAfterMeetingPoint(startWp, wp, sharedMpWp, destinationWp)) {
          postPickups.push(wp)
        } else {
          preWps.push(wp)
        }
      } else {
        preWps.push(wp)
      }
    }

    return {
      carName,
      color,
      sharedMpWp,
      preWps,
      postPickups
    }
  })

  // Group shared post-meeting pickups per meeting_point so all merged cars follow the exact same single track
  const mpSharedPostPickups = new Map<ConvoyWaypoint, ConvoyWaypoint[]>()
  for (const item of carSplitMap) {
    if (!item.sharedMpWp) continue
    const list = mpSharedPostPickups.get(item.sharedMpWp) || []
    for (const pWp of item.postPickups) {
      if (!list.includes(pWp)) {
        list.push(pWp)
      }
    }
    mpSharedPostPickups.set(item.sharedMpWp, list)
  }

  for (const [mpWp, list] of mpSharedPostPickups.entries()) {
    list.sort((a, b) => {
      if (
        typeof mpWp.lat === 'number' &&
        typeof mpWp.lng === 'number' &&
        typeof a.lat === 'number' &&
        typeof a.lng === 'number' &&
        typeof b.lat === 'number' &&
        typeof b.lng === 'number'
      ) {
        const dA = haversineKm({ lat: mpWp.lat, lng: mpWp.lng }, { lat: a.lat, lng: a.lng })
        const dB = haversineKm({ lat: mpWp.lat, lng: mpWp.lng }, { lat: b.lat, lng: b.lng })
        if (Math.abs(dA - dB) > 0.3) return dA - dB
      }
      return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
    })
  }

  // Pass 3: Build final individual car leg (up to meeting_point) and fullWaypoints (including shared convoy leg)
  return carSplitMap.map(({ carName, color, sharedMpWp, preWps }) => {
    if (!sharedMpWp) {
      const points = preWps
        .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')
        .map(w => [w.lat, w.lng] as [number, number])
      return {
        carName,
        color,
        points,
        waypoints: preWps,
        fullWaypoints: preWps
      }
    }

    const individualWps = [...preWps, sharedMpWp]
    const postList = mpSharedPostPickups.get(sharedMpWp) || []
    const fullWaypoints = [
      ...individualWps,
      ...postList,
      ...(destinationWp ? [destinationWp] : [])
    ]

    const points = individualWps
      .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')
      .map(w => [w.lat, w.lng] as [number, number])

    return {
      carName,
      color,
      points,
      waypoints: individualWps,
      fullWaypoints
    }
  })
})

// Build ONE single unified convoy track from each shared meeting_point through all post-meeting pickups to destination
const computedConvoySegments = computed<ConvoySegmentItem[]>(() => {
  const routes = computedCarRoutes.value
  if (routes.length <= 1) return []

  const mpMap = new Map<ConvoyWaypoint, CarRouteItem[]>()
  routes.forEach(r => {
    const mpWp = r.waypoints[r.waypoints.length - 1]
    if (mpWp && mpWp.type === 'meeting_point') {
      const list = mpMap.get(mpWp) || []
      list.push(r)
      mpMap.set(mpWp, list)
    }
  })

  const segments: ConvoySegmentItem[] = []
  let idx = 0

  for (const [mpWp, participatingRoutes] of mpMap.entries()) {
    if (participatingRoutes.length < 2) continue
    const sampleRoute = participatingRoutes[0]!
    const mpIdx = sampleRoute.fullWaypoints.indexOf(mpWp)
    if (mpIdx === -1) continue

    const convoyWps = sampleRoute.fullWaypoints
      .slice(mpIdx)
      .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')

    if (convoyWps.length < 2) continue

    const color = CONVOY_COLORS[idx % CONVOY_COLORS.length] || '#10b981'
    const fromWp = convoyWps[0]!
    const toWp = convoyWps[convoyWps.length - 1]!
    const points = convoyWps.map(w => [w.lat, w.lng] as [number, number])
    const stopNames = convoyWps.map(w => w.name)
    const label = `Convoglio: ${stopNames.join(' → ')}`

    segments.push({
      id: `convoy_${idx}_${fromWp.lat.toFixed(4)}_${fromWp.lng.toFixed(4)}`,
      label,
      color,
      fromWp,
      toWp,
      waypoints: convoyWps,
      points,
      carNames: participatingRoutes.map(r => r.carName)
    })
    idx++
  }

  return segments
})

// Stable fingerprint to avoid repeated map redraws when props.event reference changes
const activePlanKey = computed(() => {
  const plan = activePlan.value
  if (!plan) return 'empty'
  const routeKey = computedCarRoutes.value
    .map(r => `${r.carName}:${r.points.length}`)
    .join('|')
  const convoyKey = computedConvoySegments.value
    .map(s => `${s.id}:${s.points.length}:${s.carNames.length}`)
    .join('|')
  return `${plan.waypoints?.length || 0}_${routeKey}_${convoyKey}_${plan.calculatedAt || ''}`
})

// Client-side cache for car and destination coordinates
const carCoordsMap = ref<Record<string, { lat: number; lng: number }>>({})
const destinationCoordsResolved = ref<{ lat: number; lng: number } | null>(null)
const geoCache = new Map<string, { lat: number; lng: number }>()

async function geocodeClientSide(place: string, contextCity?: string): Promise<{ lat: number; lng: number } | null> {
  const clean = (place || '').trim()
  if (!clean) return null
  const cacheKey = `${clean.toLowerCase()}|${(contextCity || '').toLowerCase()}`
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)!

  const queries: string[] = []
  const isStreetLike =
    /^(via|viale|piazza|piazzale|corso|contrada|largo|vicolo|strada)\b/i.test(clean) &&
    !clean.includes(',')

  if (isStreetLike && contextCity && !clean.toLowerCase().includes(contextCity.toLowerCase())) {
    queries.push(`${clean}, ${contextCity}, Italia`)
  }
  queries.push(`${clean}, Italia`)
  if (!isStreetLike && contextCity && !clean.toLowerCase().includes(contextCity.toLowerCase())) {
    queries.push(`${clean}, ${contextCity}, Italia`)
  }

  const words = clean.split(/\s+/)
  if (words.length >= 2) {
    queries.push(`${words.slice(0, -1).join(' ')}, Italia`)
  }

  for (const query of queries) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
          geoCache.set(cacheKey, coords)
          return coords
        }
      }
    } catch {}
  }
  return null
}

async function resolveMissingCoordinates() {
  if (!import.meta.client) return
  let resolvedAny = false

  // Resolve event destination if missing
  if (!props.event.destinationCoords && props.event.destination && !destinationCoordsResolved.value) {
    const coords = await geocodeClientSide(props.event.destination)
    if (coords) {
      destinationCoordsResolved.value = coords
      resolvedAny = true
    }
  }

  // Resolve cars departure locations if missing
  for (const car of props.cars) {
    const riderId = car.rider.id
    if (!car.rider.departureCoords && car.rider.departureLocation && !carCoordsMap.value[riderId]) {
      const coords = await geocodeClientSide(car.rider.departureLocation, props.event.destination)
      if (coords) {
        carCoordsMap.value = { ...carCoordsMap.value, [riderId]: coords }
        resolvedAny = true
      }
    }
  }

  if (resolvedAny) {
    nextTick(() => {
      initOrUpdateMap()
    })
  }
}

const carsFingerprint = computed(() => {
  return props.cars
    .map(c => {
      const coords = c.rider.departureCoords || carCoordsMap.value[c.rider.id]
      const coordStr = coords ? `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}` : ''
      return `${c.rider.id}#${c.rider.name}#${c.rider.departureLocation || ''}#${coordStr}#${c.passengers.length}`
    })
    .join('||')
})

const mapRenderKey = computed(() => {
  const destCoords = props.event.destinationCoords || destinationCoordsResolved.value
  const destKey = destCoords ? `${destCoords.lat.toFixed(4)},${destCoords.lng.toFixed(4)}` : (props.event.destination || '')
  return `${activePlanKey.value}__${props.cars.length}__${carsFingerprint.value}__${destKey}`
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
      if (wp.type === 'destination') {
        marker.bindTooltip(`🏁 Destinazione: ${wp.name || props.event.destination}`, {
          permanent: false,
          direction: 'top',
          offset: [0, -18]
        })
      }
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

      const stopsList = seg.waypoints.map(w => `• ${w.time} [${w.name}]`).join('<br>')
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
            ${stopsList}
          </div>
        </div>
      `)

      leafletPolylinesLayer.addLayer(polyline)
    })

    // Ensure destination marker is present even if plan waypoints didn't explicitly include it
    const hasDestWp = plan.waypoints.some(w => w.type === 'destination')
    if (!hasDestWp) {
      const destCoords = props.event.destinationCoords || destinationCoordsResolved.value
      if (destCoords && typeof destCoords.lat === 'number' && typeof destCoords.lng === 'number') {
        allPoints.push([destCoords.lat, destCoords.lng])

        const destIcon = L.divIcon({
          className: 'custom-convoy-marker',
          html: `
            <div class="flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shadow-lg bg-emerald-600 ring-4 ring-emerald-300/40">
              🏁
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })

        const marker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
        marker.bindTooltip(`🏁 Destinazione: ${props.event.destination}`, {
          permanent: false,
          direction: 'top',
          offset: [0, -18]
        })
        marker.bindPopup(`
          <div class="p-1 font-sans">
            <div class="text-[10px] uppercase font-bold text-slate-400">Destinazione Finale</div>
            <div class="text-xs font-bold text-slate-900">${props.event.destination}</div>
            ${props.event.arrivalTime ? `<div class="text-[11px] font-bold text-sky-600 mt-0.5">Arrivo previsto: ore ${props.event.arrivalTime}</div>` : ''}
          </div>
        `)
        leafletMarkersLayer.addLayer(marker)
      }
    }

    // Fit map bounds to all waypoints
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints)
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  } else {
    // Initial state: Render ONLY cars points and destination marker!
    // 1. Destination Marker
    const destCoords = props.event.destinationCoords || destinationCoordsResolved.value
    if (destCoords && typeof destCoords.lat === 'number' && typeof destCoords.lng === 'number') {
      allPoints.push([destCoords.lat, destCoords.lng])

      const destIcon = L.divIcon({
        className: 'custom-convoy-marker',
        html: `
          <div class="flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shadow-lg bg-emerald-600 ring-2 ring-white/90">
            🏁
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })

      const marker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
      marker.bindTooltip(`🏁 Destinazione: ${props.event.destination}`, {
        permanent: false,
        direction: 'top',
        offset: [0, -18]
      })
      marker.bindPopup(`
        <div class="p-1 font-sans">
          <div class="text-[10px] uppercase font-bold text-slate-400">Destinazione Finale</div>
          <div class="text-xs font-bold text-slate-900">${props.event.destination}</div>
          ${props.event.arrivalTime ? `<div class="text-[11px] font-bold text-sky-600 mt-0.5">Arrivo previsto: ore ${props.event.arrivalTime}</div>` : ''}
        </div>
      `)
      leafletMarkersLayer.addLayer(marker)
    }

    // 2. Cars Points (each car with its own distinct color)
    props.cars.forEach((car, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7'
      const coords = car.rider.departureCoords || carCoordsMap.value[car.rider.id]
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        allPoints.push([coords.lat, coords.lng])

        const customIcon = L.divIcon({
          className: 'custom-convoy-marker',
          html: `
            <div class="flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shadow-lg ring-2 ring-white/90" style="background-color: ${color};">
              🚗
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })

        const marker = L.marker([coords.lat, coords.lng], { icon: customIcon })
        marker.bindTooltip(`🚗 ${car.rider.carModel || 'Auto'} (${car.rider.name})`, {
          permanent: false,
          direction: 'top',
          offset: [0, -16]
        })
        const passCount = car.passengers.length
        const passList = passCount > 0
          ? `<div class="mt-1 text-[11px] font-semibold text-slate-700">${passCount} passeggeri: ${car.passengers.map(p => p.name).join(', ')}</div>`
          : `<div class="mt-1 text-[11px] text-amber-600 font-medium">Nessun passeggero assegnato</div>`

        marker.bindPopup(`
          <div class="p-1 font-sans">
            <div class="text-[10px] uppercase font-bold text-slate-400">Punto di Partenza Auto</div>
            <div class="text-xs font-bold text-slate-900">${car.rider.carModel || 'Auto'} di ${car.rider.name}</div>
            <div class="text-[11px] text-slate-600 mt-0.5">📍 ${car.rider.departureLocation || 'Partenza'}</div>
            ${passList}
          </div>
        `)
        leafletMarkersLayer.addLayer(marker)
      }
    })

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints)
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else if (destCoords && typeof destCoords.lat === 'number') {
      leafletMap.setView([destCoords.lat, destCoords.lng], 10)
    } else {
      leafletMap.setView([45.4642, 9.19], 7)
    }
  }
}

watch(
  mapRenderKey,
  () => {
    if (import.meta.client) {
      resolveMissingCoordinates()
      nextTick(() => {
        initOrUpdateMap()
      })
    }
  }
)

watch(
  () => props.cars,
  () => {
    if (import.meta.client) {
      resolveMissingCoordinates()
    }
  },
  { deep: true, immediate: true }
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
              {{ isOrganizer ? '3. Mappa & Tracciato Auto verso Destinazione' : 'Mappa & Tracciato Auto verso Destinazione' }}
            </h3>
            <span class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              AI Gemini Powered
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Traccia il percorso preciso per ciascuna auto conoscendo i rispettivi passeggeri a bordo{{ manualMeetingPointsCount > 0 ? ` e passando per i ${manualMeetingPointsCount} punti di ritrovo impostati` : ' (diretto a destinazione)' }}.
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

        <!-- Organizer AI Calculation Button (shown only if not yet calculated or if edits were made) -->
        <UButton
          v-if="shouldShowCalculateButton"
          color="primary"
          size="sm"
          :loading="loading"
          @click="emit('calculate')"
          class="font-semibold text-xs shadow-sm cursor-pointer"
          :title="activePlan ? 'Ricalcola il tracciato sulla mappa' : 'Calcola il tracciato delle auto sulla mappa'"
        >
          <UIcon :name="activePlan ? 'i-lucide-sparkles' : 'i-lucide-map'" class="h-4 w-4 mr-1.5 shrink-0" />
          <span>{{ activePlan ? 'Ricalcola Tracciato sulla Mappa' : 'Calcola Tracciato Auto sulla Mappa' }}</span>
        </UButton>
      </div>
    </div>

    <!-- Warning if there are still unassigned passengers (text only, NO buttons) -->
    <div
      v-if="!allPassengersAssigned"
      class="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
    >
      <UIcon name="i-lucide-alert-circle" class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <span class="font-bold block">
          Distribuisci prima tutti i passeggeri nelle auto ({{ unassignedCount }} in attesa di posto)
        </span>
        <span class="text-[11px] text-amber-800 dark:text-amber-300 block mt-0.5 leading-relaxed">
          Il calcolo del tracciato sulla mappa potrà essere avviato non appena tutti i passeggeri saranno distribuiti nelle rispettive auto.
        </span>
      </div>
    </div>

    <!-- Notice if no cars registered yet -->
    <div
      v-if="cars.length === 0"
      class="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400"
    >
      <UIcon name="i-lucide-car" class="h-4 w-4 text-slate-400 shrink-0" />
      <span>Nessuna auto registrata al momento. I punti di partenza compariranno sulla mappa non appena verranno aggiunte le auto.</span>
    </div>

    <!-- Initial Cars Point Legend before route calculation -->
    <div
      v-if="!activePlan && cars.length > 0"
      class="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
    >
      <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
        <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-500" />
        <span>Auto sulla Mappa:</span>
      </span>
      <div
        v-for="(car, idx) in cars"
        :key="car.rider.id"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs"
        :style="{
          backgroundColor: (ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7') + '18',
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7',
          border: '1.5px solid ' + (ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7')
        }"
      >
        <span class="inline-block h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] || '#0284c7' }" />
        <span class="truncate max-w-[220px]">🚗 {{ car.rider.carModel || 'Auto' }} di {{ car.rider.name }}</span>
        <span class="text-[10px] opacity-75 font-normal">({{ car.rider.departureLocation || 'Partenza' }})</span>
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
    <div class="relative isolate overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-inner">
      <div
        ref="mapContainer"
        class="min-h-[18rem] h-72 sm:h-80 w-full z-0 bg-slate-100 dark:bg-slate-900"
      />
    </div>

    <!-- Per-Car Detailed Stops Breakdown -->
    <div
      v-if="activePlan && computedCarRoutes.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1"
    >
      <div
        v-for="route in computedCarRoutes"
        :key="'timeline-' + route.carName"
        class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 space-y-2"
      >
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 rounded-full shrink-0" :style="{ backgroundColor: route.color }" />
          <span class="font-extrabold text-xs text-slate-900 dark:text-white truncate">
            {{ route.carName }}
          </span>
        </div>

        <div class="space-y-1.5 pl-1">
          <div
            v-for="(wp, wIdx) in route.fullWaypoints"
            :key="wIdx"
            class="flex items-start gap-2 text-[11px]"
          >
            <span class="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 w-10">
              {{ wp.time }}
            </span>
            <span class="shrink-0">
              <template v-if="wp.type === 'start'">🚗</template>
              <template v-else-if="wp.type === 'pickup'">🙋</template>
              <template v-else-if="wp.type === 'meeting_point'">🤝</template>
              <template v-else>🏁</template>
            </span>
            <div class="min-w-0">
              <span class="font-semibold text-slate-900 dark:text-white">{{ wp.name }}</span>
              <span v-if="wp.description" class="text-slate-500 dark:text-slate-400 block text-[10px] leading-tight">
                {{ wp.description }}
              </span>
            </div>
          </div>
        </div>
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
              type="time"
              placeholder="20:30"
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

.custom-map-tooltip {
  background-color: rgba(15, 23, 42, 0.92) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 8px !important;
  padding: 3px 8px !important;
  font-weight: 700 !important;
  font-size: 11px !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2) !important;
}

.custom-map-tooltip::before {
  border-top-color: rgba(15, 23, 42, 0.92) !important;
}
</style>
