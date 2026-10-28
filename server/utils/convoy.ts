import { GoogleGenAI } from '@google/genai'
import type {
  EventItem,
  Participant,
  ConvoyRoutePlan,
  ConvoyWaypoint,
  ConvoyStep,
  ConvoyPassengerAssignment,
  ConvoyUnassignedPassenger
} from '~/types'

function getFirstAlias(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[0] || 'Auto'
}

function sanitizeTextForAi(text?: string | null): string | null {
  if (!text) return null
  return text
    // Redact email addresses
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[contatto email]')
    // Redact telephone numbers (international and local formats)
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/g, '[recapito telefonico]')
    .trim() || null
}

const forwardGeoCache = new Map<string, { lat: number; lng: number }>()
const reverseGeoCache = new Map<string, string>()

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = dLng * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.sqrt(dLat * dLat + x * x) * R
}

function bearingFromToDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dy = to.lat - from.lat
  const dx = (to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180)
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function parseTimeToMinutes(timeStr?: string): number {
  const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})/)
  return m && m[1] && m[2] ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 540
}

function formatMinutesToTime(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hh = Math.floor(safe / 60)
  const mm = safe % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

async function geocodePlaceName(
  place: string,
  contextCity?: string
): Promise<{ lat: number; lng: number } | null> {
  const clean = (place || '').trim()
  if (!clean) return null
  const key = `${clean.toLowerCase()}|${(contextCity || '').toLowerCase()}`
  if (forwardGeoCache.has(key)) return forwardGeoCache.get(key)!

  try {
    const query = contextCity && !clean.toLowerCase().includes(contextCity.toLowerCase())
      ? `${clean}, ${contextCity}, Italia`
      : `${clean}, Italia`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1800)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'MeetRide-ConvoyPlanner/1.0' },
        signal: controller.signal
      }
    )
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        const coords = {
          lat: Number(parseFloat(data[0].lat).toFixed(4)),
          lng: Number(parseFloat(data[0].lon).toFixed(4))
        }
        forwardGeoCache.set(key, coords)
        return coords
      }
    }
  } catch {
    // Ignore network / timeout errors
  }
  return null
}

async function reverseGeocodeLocality(lat: number, lng: number, fallbackLabel: string): Promise<string> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  if (reverseGeoCache.has(key)) return reverseGeoCache.get(key)!

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1800)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`,
      {
        headers: { 'User-Agent': 'MeetRide-ConvoyPlanner/1.0' },
        signal: controller.signal
      }
    )
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const addr = data?.address || {}
      const name =
        addr.town ||
        addr.suburb ||
        addr.village ||
        addr.city_district ||
        addr.municipality ||
        addr.city ||
        data?.name
      if (name && typeof name === 'string') {
        reverseGeoCache.set(key, name)
        return name
      }
    }
  } catch {
    // Ignore network / timeout errors
  }
  return fallbackLabel
}

/**
 * Generalized post-processor that inspects all car trajectories toward destination
 * and creates ad-hoc meeting_point waypoints whenever 2 or more cars converge along
 * the same angular corridor without a shared meeting point, or separates meeting points
 * that collide on the exact same coordinates as a start/pickup marker.
 */
export async function ensureCorridorMeetingPoints(plan: ConvoyRoutePlan): Promise<ConvoyRoutePlan> {
  const waypoints = plan.waypoints || []
  const dest = waypoints.find(w => w.type === 'destination')
  if (!dest || typeof dest.lat !== 'number' || typeof dest.lng !== 'number') {
    return plan
  }

  // 1. Collect all distinct car labels
  const carNames: string[] = []
  waypoints
    .filter(w => w.type === 'start')
    .forEach(w => {
      (w.carNames || []).forEach(cn => {
        const clean = cn.trim()
        if (clean && !carNames.includes(clean)) carNames.push(clean)
      })
    })

  if (carNames.length <= 1) return plan

  const allLowerCarNames = carNames.map(c => c.toLowerCase())

  function waypointMatchesCar(wp: ConvoyWaypoint, carName: string, carIdx: number): boolean {
    if (!wp.carNames || wp.carNames.length === 0) return false
    const lowerName = carName.toLowerCase()
    return wp.carNames.some(cn => {
      const lCn = cn.trim().toLowerCase()
      if (!lCn) return false
      if (lCn === lowerName) return true
      if (allLowerCarNames.some((other, oIdx) => oIdx !== carIdx && other === lCn)) return false
      const subMatch = lowerName.includes(lCn) || lCn.includes(lowerName)
      if (subMatch) {
        const matchesOtherToo = allLowerCarNames.some(
          (other, oIdx) => oIdx !== carIdx && (other.includes(lCn) || lCn.includes(other))
        )
        if (!matchesOtherToo) return true
      }
      return false
    })
  }

  // 2. Build each car's sequence of waypoints before destination
  const carRoutes = carNames.map((carName, idx) => {
    const rw = waypoints.filter(w => w.type !== 'destination' && waypointMatchesCar(w, carName, idx))
    rw.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time))
    return { carName, idx, wps: rw }
  })

  // Count cars at each meeting_point
  const meetingCount = new Map<ConvoyWaypoint, number>()
  carRoutes.forEach(cr => {
    cr.wps.forEach(w => {
      if (w.type === 'meeting_point') {
        meetingCount.set(w, (meetingCount.get(w) || 0) + 1)
      }
    })
  })

  // 3. Identify cars whose last waypoint before destination is NOT a shared meeting_point (>=2 cars)
  const unmerged = carRoutes
    .filter(cr => {
      const last = cr.wps[cr.wps.length - 1]
      if (!last) return false
      const hasSharedMeeting = cr.wps.some(w => w.type === 'meeting_point' && (meetingCount.get(w) || 0) >= 2)
      return !hasSharedMeeting
    })
    .map(cr => {
      const last = cr.wps[cr.wps.length - 1]!
      return {
        carName: cr.carName,
        wps: cr.wps,
        lastWp: last,
        dDest: haversineKm(last, dest),
        ang: bearingFromToDeg(dest, last)
      }
    })
    .filter(u => u.dDest >= 2.5)

  // 4. First check if any unmerged car naturally passes right through an existing shared meeting_point
  const existingSharedMeetings = waypoints.filter(
    w => w.type === 'meeting_point' && (meetingCount.get(w) || 0) >= 2
  )
  const joinedExisting = new Set<string>()
  unmerged.forEach(u => {
    for (const mp of existingSharedMeetings) {
      const mpDist = haversineKm(mp, dest)
      const mpAng = bearingFromToDeg(dest, mp)
      const detour = haversineKm(u.lastWp, mp) + mpDist - u.dDest
      if (u.dDest > mpDist + 1.0 && angleDiffDeg(u.ang, mpAng) <= 18 && detour <= 1.8) {
        if (!mp.carNames.includes(u.carName)) {
          mp.carNames.push(u.carName)
        }
        joinedExisting.add(u.carName)
        break
      }
    }
  })

  const remainingUnmerged = unmerged.filter(u => !joinedExisting.has(u.carName))

  // 5. Group remaining unmerged cars into converging angular corridors around destination
  const visited = new Set<number>()
  const destIdx = waypoints.findIndex(w => w.type === 'destination')

  for (let i = 0; i < remainingUnmerged.length; i++) {
    if (visited.has(i)) continue
    const cluster = [remainingUnmerged[i]!]
    visited.add(i)

    for (let j = i + 1; j < remainingUnmerged.length; j++) {
      if (visited.has(j)) continue
      const cand = remainingUnmerged[j]!
      const canJoin = cluster.some(c => {
        const distRatio = Math.max(c.dDest, cand.dDest) / Math.max(0.5, Math.min(c.dDest, cand.dDest))
        return angleDiffDeg(c.ang, cand.ang) <= 22 && distRatio <= 2.2
      })
      if (canJoin) {
        cluster.push(cand)
        visited.add(j)
      }
    }

    if (cluster.length >= 2) {
      cluster.sort((a, b) => a.dDest - b.dDest)
      const closest = cluster[0]!
      const avgLat = cluster.reduce((s, c) => s + c.lastWp.lat, 0) / cluster.length
      const avgLng = cluster.reduce((s, c) => s + c.lastWp.lng, 0) / cluster.length

      // Position ad-hoc meeting point downstream along the corridor between the closest stop and destination
      const ratio = 0.65
      const meetLat = Number((dest.lat + (closest.lastWp.lat * 0.6 + avgLat * 0.4 - dest.lat) * ratio).toFixed(4))
      const meetLng = Number((dest.lng + (closest.lastWp.lng * 0.6 + avgLng * 0.4 - dest.lng) * ratio).toFixed(4))

      const fallbackName = cluster.map(c => c.lastWp.name).slice(0, 2).join(' / ')
      const localityName = await reverseGeocodeLocality(meetLat, meetLng, fallbackName)

      const maxLastMin = Math.max(...cluster.map(c => parseTimeToMinutes(c.lastWp.time)))
      const destMin = parseTimeToMinutes(dest.time)
      const meetMin = Math.min(
        destMin - 8,
        Math.max(maxLastMin + 7, Math.round((maxLastMin + destMin) / 2))
      )
      const meetTime = formatMinutesToTime(meetMin)
      const clusterCarNames = cluster.map(c => c.carName)

      const newMeetingWp: ConvoyWaypoint = {
        name: `Meeting Point (${localityName})`,
        type: 'meeting_point',
        time: meetTime,
        carNames: clusterCarNames,
        lat: meetLat,
        lng: meetLng,
        description: `Punto di unione in convoglio a ${localityName} per ${clusterCarNames.join(', ')}`
      }

      if (destIdx !== -1) {
        waypoints.splice(destIdx, 0, newMeetingWp)
      } else {
        waypoints.push(newMeetingWp)
      }
    }
  }

  // 6. Ensure no meeting_point sits on the exact same coordinates (<0.35km) as a start/pickup waypoint
  const nonMeetingWps = waypoints.filter(w => w.type === 'start' || w.type === 'pickup')
  waypoints.forEach(wp => {
    if (wp.type === 'meeting_point') {
      const colliding = nonMeetingWps.find(other => haversineKm(wp, other) < 0.35)
      if (colliding) {
        wp.lat = Number((wp.lat + (dest.lat - wp.lat) * 0.28).toFixed(4))
        wp.lng = Number((wp.lng + (dest.lng - wp.lng) * 0.28).toFixed(4))
      }
    }
  })

  return plan
}

export async function calculateConvoyRouteWithGemini(
  event: EventItem,
  riders: Participant[],
  passengers: Participant[] = [],
  apiKey?: string
): Promise<ConvoyRoutePlan> {
  const resolvedKey = (
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim()

  if (!resolvedKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Chiave GEMINI_API_KEY non trovata nel file .env. Configura GEMINI_API_KEY per calcolare l\'itinerario con l\'AI.'
    })
  }

  if (riders.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nessun veicolo o guidatore disponibile per calcolare l\'itinerario e assegnare i posti.'
    })
  }

  // Filter riders that have a specified departure location
  const carsWithLocation = riders.filter(r => r.departureLocation && r.departureLocation.trim())
  const validRiders = carsWithLocation.length > 0 ? carsWithLocation : riders

  // Resolve target arrival time
  let targetArrivalTime = event.arrivalTime || ''
  if (!targetArrivalTime) {
    try {
      const d = new Date(event.eventDate)
      targetArrivalTime = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    } catch {
      targetArrivalTime = '20:30'
    }
  }

  const destCoords =
    event.destinationCoords ||
    (await geocodePlaceName(event.destination)) ||
    null

  const usedCarLabels = new Set<string>()
  const carsData = await Promise.all(
    validRiders.map(async (r, idx) => {
      const baseLabel = `${r.carModel || 'Auto'} di ${getFirstAlias(r.name)}${r.hasDriver === false ? ' (messa a disposizione senza autista)' : ''}`
      const carLabel = usedCarLabels.has(baseLabel.toLowerCase()) ? `${baseLabel} #${idx + 1}` : baseLabel
      usedCarLabels.add(carLabel.toLowerCase())

      const coords =
        r.departureCoords ||
        (r.departureLocation ? await geocodePlaceName(r.departureLocation, event.destination) : null)

      const distanceToDestKm =
        coords && destCoords ? Number(haversineKm(coords, destCoords).toFixed(1)) : null
      const bearingFromDestDeg =
        coords && destCoords ? Number(bearingFromToDeg(destCoords, coords).toFixed(1)) : null

      return {
        riderId: r.id,
        driverName: getFirstAlias(r.name),
        carLabel,
        totalSeats: r.totalSeats || 4,
        hasDriver: r.hasDriver !== false,
        departureLocation: r.departureLocation || 'Punto di partenza non specificato',
        coordinates: coords ? `${coords.lat}, ${coords.lng}` : null,
        distanceToDestKm,
        bearingFromDestDeg
      }
    })
  )

  const passengersData = await Promise.all(
    passengers.map(async p => {
      const coords =
        p.pickupCoords ||
        (p.pickupLocation ? await geocodePlaceName(p.pickupLocation, event.destination) : null)

      const distanceToDestKm =
        coords && destCoords ? Number(haversineKm(coords, destCoords).toFixed(1)) : null
      const bearingFromDestDeg =
        coords && destCoords ? Number(bearingFromToDeg(destCoords, coords).toFixed(1)) : null

      return {
        passengerId: p.id,
        name: getFirstAlias(p.name),
        pickupLocation: p.pickupLocation || 'Non specificato',
        coordinates: coords ? `${coords.lat}, ${coords.lng}` : null,
        distanceToDestKm,
        bearingFromDestDeg,
        notes: sanitizeTextForAi(p.notes),
        currentAssignedRiderId: p.assignedRiderId || null
      }
    })
  )

  const prompt = `Sei un assistente logistico e di navigazione AI specializzato in carpooling, ottimizzazione delle rotte e pianificazione di convogli automobilistici.

1. ASSEGNAZIONE INTELLIGENTE DEI PASSEGGERI ALLE MACCHINE (REGOLA DEL CORRIDOIO DA MONTE A VALLE):
   - PRIORITÀ ASSOLUTA AL CORRIDOIO LINEARE: Usa "distanceToDestKm" e "bearingFromDestDeg" per capire chi parte più lontano ("a monte") e chi si trova lungo la stessa direttrice ("a valle") verso "${event.destination}". Se più passeggeri si trovano in sequenza lungo la STESSA direttrice stradale di un'auto (es. auto da Biancavilla con passeggeri a S.M. Licodia e Paternò, oppure auto da Capomulini con passeggero ad Aci Trezza), l'auto che parte più a monte DEVE raccogliere TUTTI i passeggeri consecutivi di quel percorso, purché abbia posti disponibili ("totalSeats").
   - VIETATO TORNARE INDIETRO VERSO MONTE: Un'auto che parte già più a valle non deve salire verso monte a prendere passeggeri più lontani se c'è già un'auto a monte che scende lungo quella stessa direttrice.
   - DIVIETO DI BILANCIAMENTO ARTIFICIALE ("NO ARTIFICIAL LOAD BALANCING"): NON dividere o spalmare forzatamente i passeggeri tra le auto solo per dare un passeggero a ciascuna! Se un'auto può caricare tutti i passeggeri situati lungo la sua rotta naturale, DEVE prenderli tutti. L'altra auto proveniente da un'altra zona viaggerà con eventuali passeggeri della propria zona, oppure con solo il guidatore fino al punto di ritrovo/confluenza.
   - RISPETTO DELLA CAPIENZA ("totalSeats"): Non superare mai "totalSeats"; eventuali passeggeri in eccesso vanno in "unassignedPassengers".

2. PIANIFICAZIONE TAPPE ("waypoints") E MEETING POINT AD HOC PER OGNI CORRIDOIO CON >= 2 AUTO:
   - Tutti devono arrivare a "${event.destination}" entro le "${targetArrivalTime}".
   - REGOLA FONDAMENTALE SUI MEETING POINT MULTIPLI (NESSUNA LINEA PARALLELA CHE SALTA I PUNTI DI CONFLUENZA):
     * Raggruppa le auto per settore/corridoio geografico rispetto alla destinazione ("bearingFromDestDeg" simili entro ~20-25° o direttrici che scendono vicine).
     * OGNI VOLTA che 2 o più auto convergono lungo lo stesso corridoio/versante, DEVI OBBLIGATORIAMENTE creare un "meeting_point" AD HOC per quel gruppo nel primo punto naturale di confluenza a valle delle loro fermate prima della destinazione (es. Biancavilla/Paternò + Belpasso -> "meeting_point" a Misterbianco; Pedara/Nicolosi + Mascalucia -> "meeting_point" a Gravina di Catania; Capomulini/Aci Trezza + Aci Castello -> "meeting_point" ad Aci Castello / Cannizzaro).
     * NON lasciare MAI che due auto dello stesso corridoio traccino due linee dritte separate fino alla destinazione passando lontane dai reali punti di confluenza intermedi: falle SEMPRE unire nel "meeting_point" ad hoc del loro corridoio.
     * Se invece un'auto è l'UNICA nel proprio corridoio/settore geografico, NON farla deviare verso il meeting point di un altro quadrante: andrà direttamente a destinazione lungo la propria linea.
     * VIETATO CREARE MEETING POINT PER UNA SOLA AUTO: Ogni "meeting_point" deve avere almeno 2 auto in "carNames".
   - REGOLE PER L'ATTRIBUTO "carNames" E GLI ORARI NEI "waypoints":
     * "start": inserisci in "carNames" ESCLUSIVAMENTE l'auto che parte da lì.
     * "pickup": inserisci in "carNames" SOLO l'auto che carica quel passeggero.
     * "meeting_point": inserisci in "carNames" ESCLUSIVAMENTE le auto di quel corridoio che confluiscono in QUEL punto (coordinate distinte da start/pickup).
     * "destination": inserisci in "carNames" TUTTE le auto che arrivano all'evento.
     * Calcola a ritroso gli orari ("HH:MM") e fornisci coordinate lat/lng accurate per ogni tappa.

DATI EVENTO: Destinazione "${event.destination}" | Arrivo "${targetArrivalTime}" | Data "${event.eventDate}"
AUTO E GUIDATORI:
${JSON.stringify(carsData)}
PASSEGGERI:
${JSON.stringify(passengersData)}

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme a questa struttura:
{
  "passengerAssignments": [
    {
      "passengerId": "ID univoco del passeggero",
      "passengerName": "Nome passeggero",
      "assignedRiderId": "ID univoco dell'auto/guidatore assegnato",
      "carLabel": "Etichetta dell'auto",
      "reason": "Breve motivazione geografica"
    }
  ],
  "unassignedPassengers": [
    {
      "passengerId": "ID univoco",
      "passengerName": "Nome passeggero",
      "reason": "Motivo"
    }
  ],
  "waypoints": [
    {
      "name": "Nome Località",
      "type": "start" | "pickup" | "meeting_point" | "destination",
      "time": "HH:MM",
      "carNames": ["Nome Auto"],
      "lat": 37.6433,
      "lng": 14.8647,
      "description": "Breve descrizione tappa"
    }
  ]
}`

  const ai = new GoogleGenAI({ apiKey: resolvedKey })
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash']
  let rawJson = ''
  let lastError: any = null

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      })
      rawJson = response.text || ''
      if (rawJson) break
    } catch (err: any) {
      console.warn(`[Convoy AI] Model ${modelName} failed:`, err?.message)
      lastError = err
    }
  }

  if (!rawJson) {
    throw createError({
      statusCode: 502,
      statusMessage: `Errore nella chiamata a Gemini AI: ${lastError?.message || 'Risposta vuota'}`
    })
  }

  let parsed: any
  try {
    const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('[Convoy AI] JSON parse error:', rawJson)
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini AI ha restituito una risposta non conforme al formato JSON atteso.'
    })
  }

  const passengerAssignments: ConvoyPassengerAssignment[] = (parsed.passengerAssignments || [])
    .map((a: any) => ({
      passengerId: String(a.passengerId || ''),
      passengerName: String(a.passengerName || ''),
      assignedRiderId: String(a.assignedRiderId || ''),
      carLabel: String(a.carLabel || 'Auto'),
      reason: String(a.reason || 'Assegnazione ottimale in base al percorso')
    }))
    .filter((a: ConvoyPassengerAssignment) => a.passengerId && a.assignedRiderId)

  const unassignedPassengers: ConvoyUnassignedPassenger[] = (parsed.unassignedPassengers || [])
    .map((u: any) => ({
      passengerId: String(u.passengerId || ''),
      passengerName: String(u.passengerName || ''),
      reason: String(u.reason || 'Posti auto esauriti')
    }))
    .filter((u: ConvoyUnassignedPassenger) => u.passengerId)

  const waypoints: ConvoyWaypoint[] = (parsed.waypoints || []).map((w: any) => ({
    name: String(w.name || 'Tappa'),
    type: ['start', 'pickup', 'meeting_point', 'destination'].includes(w.type) ? w.type : 'meeting_point',
    time: String(w.time || targetArrivalTime),
    carNames: Array.isArray(w.carNames) ? w.carNames.map(String) : [],
    lat: Number(w.lat) || 37.5,
    lng: Number(w.lng) || 15.0,
    description: String(w.description || '')
  }))

  const plan: ConvoyRoutePlan = {
    summary: '',
    arrivalTime: targetArrivalTime,
    waypoints,
    steps: [],
    passengerAssignments,
    unassignedPassengers,
    calculatedAt: new Date().toISOString()
  }

  return await ensureCorridorMeetingPoints(plan)
}
