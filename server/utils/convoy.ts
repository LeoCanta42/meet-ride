import { GoogleGenAI } from '@google/genai'
import type {
  EventItem,
  Participant,
  ConvoyRoutePlan,
  ConvoyWaypoint
} from '~/types'

export function getFirstAlias(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[0] || 'Auto'
}

export function sanitizeTextForAi(text?: string | null): string | null {
  if (!text) return null
  return text
    // Redact email addresses
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[contatto email]')
    // Redact telephone numbers (international and local formats)
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/g, '[recapito telefonico]')
    .trim() || null
}

const forwardGeoCache = new Map<string, { lat: number; lng: number }>()

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = dLng * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.sqrt(dLat * dLat + x * x) * R
}

export function bearingFromToDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dy = to.lat - from.lat
  const dx = (to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180)
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function parseTimeToMinutes(timeStr?: string): number {
  const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})/)
  return m && m[1] && m[2] ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 1230 // default 20:30
}

export function formatMinutesToTime(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hh = Math.floor(safe / 60)
  const mm = safe % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function computeRouteFingerprint(
  destination?: string | null,
  arrivalTime?: string | null,
  meetingPoints?: { name: string; time?: string | null; riderIds: string[]; meetingPointIds?: string[] }[] | null,
  cars?: { rider: Participant; passengers: Participant[] }[] | null
): string {
  const dest = (destination || '').trim().toLowerCase()
  const arrTime = (arrivalTime || '').trim()

  const mps = (meetingPoints || [])
    .map(mp => `${mp.name.trim().toLowerCase()}#${mp.time || ''}#${(mp.riderIds || []).slice().sort().join(',')}#${((mp as any).meetingPointIds || []).slice().sort().join(',')}`)
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

export function getAllRiderIdsForMeetingPoint(
  mp: { riderIds?: string[]; meetingPointIds?: string[] },
  allMps: Array<{ id: string; riderIds?: string[]; meetingPointIds?: string[] }>
): string[] {
  const result = new Set<string>(mp.riderIds || [])
  const visitedMps = new Set<string>()

  function traverse(mId: string) {
    if (visitedMps.has(mId)) return
    visitedMps.add(mId)
    const childMp = allMps.find(m => m.id === mId)
    if (!childMp) return
    for (const rId of childMp.riderIds || []) {
      result.add(rId)
    }
    for (const nextMId of childMp.meetingPointIds || []) {
      traverse(nextMId)
    }
  }

  for (const mId of mp.meetingPointIds || []) {
    traverse(mId)
  }

  return Array.from(result)
}

export async function geocodePlaceName(
  place: string,
  contextCity?: string
): Promise<{ lat: number; lng: number } | null> {
  const clean = (place || '').trim()
  if (!clean) return null
  const key = `${clean.toLowerCase()}|${(contextCity || '').toLowerCase()}`
  if (forwardGeoCache.has(key)) return forwardGeoCache.get(key)!

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

  // Fallback for multi-word place names with a trailing regional qualifier (e.g. "Piano Provenzana etna")
  const words = clean.split(/\s+/)
  if (words.length >= 2) {
    const withoutLast = words.slice(0, -1).join(' ')
    queries.push(`${withoutLast}, Italia`)
  }

  for (const query of queries) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
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
      // Ignore network / timeout errors and try next query
    }
  }
  return null
}

/**
 * Determines whether a passenger's pickup location is geographically reached AFTER
 * the car's manual meeting point (along the merged convoy path to destination)
 * rather than BEFORE the meeting point.
 */
export function isPassengerAfterMeetingPoint(
  carCoords: { lat: number; lng: number } | null,
  pCoords: { lat: number; lng: number } | null,
  mpCoords: { lat: number; lng: number } | null,
  destCoords: { lat: number; lng: number } | null
): boolean {
  if (!pCoords || !mpCoords) return false

  const distMpToP = haversineKm(mpCoords, pCoords)
  // If passenger is at the meeting point itself (< 0.8 km), pick them up right before/at the meeting point
  if (distMpToP <= 0.8) return false

  if (carCoords) {
    const distStartToP = haversineKm(carCoords, pCoords)
    // If passenger is at the car's departure location (< 0.8 km), pick them up at departure (before meeting point)
    if (distStartToP <= 0.8) return false

    const distStartToMp = haversineKm(carCoords, mpCoords)
    // If the car starts at the meeting point itself, any passenger outside the meeting point is picked up after merging
    if (distStartToMp <= 0.8) return true

    // Compare total route distance: S -> P -> M -> D vs S -> M -> P -> D
    if (destCoords) {
      const distMpToDest = haversineKm(mpCoords, destCoords)
      const distPToDest = haversineKm(pCoords, destCoords)
      const routeBefore = distStartToP + distMpToP + distMpToDest
      const routeAfter = distStartToMp + distMpToP + distPToDest
      if (routeAfter + 0.5 < routeBefore) return true
    }

    // Also check if M lies along the progression from S to P (P is further from S than M, and closer to M than to S)
    if (distStartToP > distStartToMp + 0.5 && distMpToP < distStartToP) {
      return true
    }

    return false
  }

  // Fallback if car start coords are unknown but dest coords are known
  if (destCoords) {
    return haversineKm(pCoords, destCoords) + 0.5 < haversineKm(mpCoords, destCoords)
  }

  return false
}

/**
 * Task 3: Calculate precise per-car tracks to reach destination.
 * - Requires all passengers to be already distributed in their cars.
 * - Each car's track goes from its start -> its assigned passengers' pickups -> straight to destination
 *   UNLESS the organizer explicitly configured manual meetingPoints for that car.
 * - Does NOT guess or invent meeting points when none are set by the organizer.
 */
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
      statusMessage: 'Nessun veicolo o guidatore disponibile per calcolare l\'itinerario.'
    })
  }

  // Filter out driverless cars that have 0 passengers assigned
  const activeRiders = riders.filter(r => {
    const hasAssignedPassengers = passengers.some(p => p.assignedRiderId === r.id)
    const inMeetingPoint = (event.meetingPoints || []).some(mp => (mp.riderIds || []).includes(r.id))
    return r.hasDriver !== false || hasAssignedPassengers || inMeetingPoint
  })
  const validRiders = activeRiders.length > 0 ? activeRiders : riders

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
  const destMinutes = parseTimeToMinutes(targetArrivalTime)

  const destCoords =
    event.destinationCoords ||
    (await geocodePlaceName(event.destination)) ||
    null
  if (destCoords && !event.destinationCoords) {
    event.destinationCoords = destCoords
  }

  // Build car labels & geocode car start locations + assigned passengers
  const usedCarLabels = new Set<string>()
  const riderIdToCarLabel = new Map<string, string>()

  const carsWithPassengers = await Promise.all(
    validRiders.map(async (r, idx) => {
      const baseLabel = `${r.carModel || 'Auto'} di ${getFirstAlias(r.name)}`
      const carLabel = usedCarLabels.has(baseLabel.toLowerCase()) ? `${baseLabel} #${idx + 1}` : baseLabel
      usedCarLabels.add(carLabel.toLowerCase())
      riderIdToCarLabel.set(r.id, carLabel)

      const startCoords =
        r.departureCoords ||
        (r.departureLocation ? await geocodePlaceName(r.departureLocation, event.destination) : null)
      if (startCoords && !r.departureCoords) {
        r.departureCoords = startCoords
      }

      const assignedPassengersRaw = passengers.filter(
        p => p.assignedRiderId === r.id && (!r.driverParticipantId || p.id !== r.driverParticipantId)
      )
      const assignedPassengers = await Promise.all(
        assignedPassengersRaw.map(async (p) => {
          const pCoords =
            p.pickupCoords ||
            (p.pickupLocation ? await geocodePlaceName(p.pickupLocation, event.destination) : null)
          if (pCoords && !p.pickupCoords) {
            p.pickupCoords = pCoords
          }

          const distFromStartKm =
            startCoords && pCoords ? Number(haversineKm(startCoords, pCoords).toFixed(1)) : null
          const distToDestKm =
            pCoords && destCoords ? Number(haversineKm(pCoords, destCoords).toFixed(1)) : null

          return {
            passengerId: p.id,
            fullName: p.name,
            alias: getFirstAlias(p.name),
            pickupLocation: p.pickupLocation || 'Punto di ritiro',
            coords: pCoords,
            distFromStartKm,
            distToDestKm
          }
        })
      )

      // Sort assigned passengers naturally along the route from car start toward destination
      assignedPassengers.sort((a, b) => {
        if (a.distFromStartKm !== null && b.distFromStartKm !== null) {
          return a.distFromStartKm - b.distFromStartKm
        }
        if (a.distToDestKm !== null && b.distToDestKm !== null) {
          return b.distToDestKm - a.distToDestKm
        }
        return 0
      })

      const distToDestKm =
        startCoords && destCoords ? Number(haversineKm(startCoords, destCoords).toFixed(1)) : null

      const driverPassenger = r.driverParticipantId
        ? passengers.find(p => p.id === r.driverParticipantId)
        : null
      const effectiveDriverName = driverPassenger ? driverPassenger.name : r.name

      return {
        riderId: r.id,
        driverName: effectiveDriverName,
        driverAlias: getFirstAlias(effectiveDriverName),
        carLabel,
        departureLocation: r.departureLocation || 'Punto di partenza',
        departureTime: r.departureTime || null,
        coords: startCoords,
        distToDestKm,
        assignedPassengers
      }
    })
  )

  // Process organizer-defined manual meeting points (if any)
  const rawMeetingPoints = Array.isArray(event.meetingPoints) ? event.meetingPoints : []
  const resolvedMeetingPoints = (
    await Promise.all(
      rawMeetingPoints.map(async (mp) => {
        const allRiderIds = getAllRiderIdsForMeetingPoint(mp, rawMeetingPoints)
        const allCarLabels = allRiderIds
          .map(rid => riderIdToCarLabel.get(rid))
          .filter((label): label is string => Boolean(label))

        const directCarLabels = (mp.riderIds || [])
          .map(rid => riderIdToCarLabel.get(rid))
          .filter((label): label is string => Boolean(label))

        const incomingMeetingPointIds = Array.isArray(mp.meetingPointIds) ? mp.meetingPointIds : []
        const incomingMeetingPointNames = incomingMeetingPointIds
          .map(mid => rawMeetingPoints.find(m => m.id === mid)?.name)
          .filter((name): name is string => Boolean(name))

        const totalUnits = (mp.riderIds || []).length + incomingMeetingPointIds.length
        if (!mp.name || totalUnits < 2 || allCarLabels.length < 2) return null

        const mpCoords =
          mp.coords ||
          (await geocodePlaceName(mp.name, event.destination)) ||
          null
        if (mpCoords && !mp.coords) {
          mp.coords = mpCoords
        }

        // Downstream target: does this meeting point feed into another meeting point?
        const parentMp = rawMeetingPoints.find(other => (other.meetingPointIds || []).includes(mp.id))
        const nextTargetName = parentMp ? parentMp.name : event.destination

        return {
          id: mp.id,
          name: mp.name,
          time: mp.time || null,
          notes: mp.notes || '',
          riderIds: mp.riderIds || [],
          meetingPointIds: incomingMeetingPointIds,
          incomingMeetingPointNames,
          directCarLabels,
          allCarLabels,
          carLabels: allCarLabels, // alias for backwards compatibility
          nextTargetName,
          parentMpId: parentMp?.id || null,
          coords: mpCoords
        }
      })
    )
  ).filter((mp): mp is NonNullable<typeof mp> => mp !== null)

  // Split each car's passengers into pre-meeting-point vs post-meeting-point (convoy leg)
  // Note: A car's initial meeting point is the one where its riderId is directly listed in riderIds
  const carsWithSplitPassengers = carsWithPassengers.map(c => {
    const carMp = resolvedMeetingPoints.find(mp => (mp.riderIds || []).includes(c.riderId))
    if (!carMp) {
      return {
        ...c,
        carMp: null,
        preMeetingPassengers: [...c.assignedPassengers],
        postMeetingPassengers: [] as typeof c.assignedPassengers
      }
    }

    const preMeetingPassengers: typeof c.assignedPassengers = []
    const postMeetingPassengers: typeof c.assignedPassengers = []

    for (const p of c.assignedPassengers) {
      if (isPassengerAfterMeetingPoint(c.coords, p.coords, carMp.coords, destCoords)) {
        postMeetingPassengers.push(p)
      } else {
        preMeetingPassengers.push(p)
      }
    }

    return {
      ...c,
      carMp,
      preMeetingPassengers,
      postMeetingPassengers
    }
  })

  // For each meeting point, collect and order all post-meeting passengers across participating cars
  const mpPostPassengersMap = new Map<
    string,
    Array<(typeof carsWithPassengers)[number]['assignedPassengers'][number] & { assignedCarLabel: string }>
  >()

  for (const mp of resolvedMeetingPoints) {
    const postList: Array<(typeof carsWithPassengers)[number]['assignedPassengers'][number] & { assignedCarLabel: string }> = []
    for (const c of carsWithSplitPassengers) {
      if (mp.allCarLabels.includes(c.carLabel)) {
        for (const p of c.postMeetingPassengers) {
          postList.push({
            ...p,
            assignedCarLabel: c.carLabel
          })
        }
      }
    }

    postList.sort((a, b) => {
      const aDistFromMp = mp.coords && a.coords ? haversineKm(mp.coords, a.coords) : a.distFromStartKm
      const bDistFromMp = mp.coords && b.coords ? haversineKm(mp.coords, b.coords) : b.distFromStartKm
      if (aDistFromMp !== null && bDistFromMp !== null && Math.abs(aDistFromMp - bDistFromMp) > 0.3) {
        return aDistFromMp - bDistFromMp
      }
      if (a.distToDestKm !== null && b.distToDestKm !== null) {
        return b.distToDestKm - a.distToDestKm
      }
      return 0
    })

    mpPostPassengersMap.set(mp.id, postList)
  }

  // Build clean prompt data
  const promptCars = carsWithSplitPassengers.map(c => {
    const carMp = c.carMp
    return {
      carLabel: c.carLabel,
      departureLocation: c.departureLocation,
      preferredDepartureTime: c.departureTime,
      coordinates: c.coords ? `${c.coords.lat}, ${c.coords.lng}` : null,
      distanceToDestKm: c.distToDestKm,
      passengersBeforeMeetingPoint: c.preMeetingPassengers.map(p => ({
        name: p.alias,
        pickupLocation: p.pickupLocation,
        coordinates: p.coords ? `${p.coords.lat}, ${p.coords.lng}` : null,
        distanceFromCarStartKm: p.distFromStartKm,
        distanceToDestKm: p.distToDestKm
      })),
      passengersAfterMeetingPointInConvoy: c.postMeetingPassengers.map(p => ({
        name: p.alias,
        pickupLocation: p.pickupLocation,
        coordinates: p.coords ? `${p.coords.lat}, ${p.coords.lng}` : null,
        distanceFromCarStartKm: p.distFromStartKm,
        distanceToDestKm: p.distToDestKm
      })),
      manualMeetingPoint: carMp
        ? {
            name: carMp.name,
            preferredTime: carMp.time,
            coordinates: carMp.coords ? `${carMp.coords.lat}, ${carMp.coords.lng}` : null,
            meetsWithCars: carMp.allCarLabels,
            nextDestination: carMp.nextTargetName
          }
        : null
    }
  })

  const meetingPointsPromptSection =
    resolvedMeetingPoints.length > 0
      ? `PUNTI DI RITROVO IMPOSTATI DALL'ORGANIZZATORE (POSSONO ESSERE ANCHE CONCATENATI / GERARCHICI):
${JSON.stringify(
  resolvedMeetingPoints.map(mp => ({
    name: mp.name,
    time: mp.time,
    coordinates: mp.coords ? `${mp.coords.lat}, ${mp.coords.lng}` : null,
    directCars: mp.directCarLabels,
    incomingConvoysFromMeetingPoints: mp.incomingMeetingPointNames,
    allCarsInConvoy: mp.allCarLabels,
    nextTargetDestination: mp.nextTargetName,
    notes: mp.notes,
    convoyPickupsAfterMeetingPoint: (mpPostPassengersMap.get(mp.id) || []).map(p => ({
      name: p.alias,
      pickupLocation: p.pickupLocation,
      assignedCar: p.assignedCarLabel,
      coordinates: p.coords ? `${p.coords.lat}, ${p.coords.lng}` : null
    }))
  })),
  null,
  2
)}
REGOLE SUI PUNTI DI RITROVO:
- Usa ESCLUSIVAMENTE i punti di ritrovo manuali elencati qui sopra.
- Per ciascuno di essi, crea un waypoint con "type": "meeting_point", "name" corrispondente e "carNames" contenente TUTTE le auto in convoglio per quel punto di ritrovo ("allCarsInConvoy").
- Le auto coinvolte partono dalla loro "start", passano dai "pickup" in "passengersBeforeMeetingPoint" (con "carNames": ["<carLabel>"]), poi convergono al rispettivo "meeting_point" iniziale allo stesso orario.
- Se un punto di ritrovo confluisce in un altro punto di ritrovo ("nextTargetDestination"), le auto riunite proseguono INSIEME in convoglio fino a quel successivo punto di ritrovo, dove si uniscono alle altre auto prima di andare a destinazione.
- Dal punto di ritrovo finale, tutte le auto proseguono INSIEME in un unico convoglio fino alla destinazione finale "${event.destination}".
- Le auto che NON sono incluse in alcun punto di ritrovo manuale NON devono avere alcun "meeting_point": dopo i propri "pickup", vanno dritte alla destinazione finale.
- VIETATO inventare o aggiungere altri "meeting_point" non presenti nella lista dell'organizzatore.`
      : `NESSUN PUNTO DI RITROVO IMPOSTATO:
- L'organizzatore NON ha impostato alcun punto di ritrovo.
- NON creare NESSUN waypoint di tipo "meeting_point".
- Ogni auto parte dalla propria "start", effettua le fermate "pickup" dei propri passeggeri in ordine lungo il tragitto, e va DIRETTAMENTE alla "destination" finale.`

  const prompt = `Sei un assistente di navigazione stradale. Tutti i passeggeri sono GIÀ stati assegnati alle rispettive auto.
Il tuo compito è calcolare il tracciato ("waypoints") preciso per ciascuna auto, dall'origine alla destinazione finale "${event.destination}", con arrivo previsto entro le "${targetArrivalTime}".

ISTRUZIONI PER LA CREAZIONE DEI WAYPOINTS:
1. Per ogni auto in "AUTO E PASSEGGERI A BORDO":
   - Crea 1 waypoint di partenza ("type": "start") con "carNames": ["<carLabel dell'auto>"].
   - Crea 1 waypoint di salita ("type": "pickup") per ciascun passeggero in "passengersBeforeMeetingPoint" (prima dell'eventuale punto di ritrovo), con "carNames": ["<carLabel dell'auto>"].
2. ${meetingPointsPromptSection}
3. Crea infine 1 waypoint di arrivo ("type": "destination") per "${event.destination}" alle "${targetArrivalTime}" con tutte le auto in "carNames".
4. Calcola orari realistici ("HH:MM") a ritroso rispetto all'orario di arrivo "${targetArrivalTime}" e fornisci coordinate lat/lng accurate per ogni tappa.

DATI EVENTO:
- Destinazione: "${event.destination}"${destCoords ? ` (Coordinate: ${destCoords.lat}, ${destCoords.lng})` : ''}
- Orario di arrivo: "${targetArrivalTime}"

AUTO E PASSEGGERI A BORDO:
${JSON.stringify(promptCars, null, 2)}

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme a questa struttura:
{
  "summary": "Breve riepilogo dell'itinerario calcolato in italiano",
  "waypoints": [
    {
      "name": "Nome Località",
      "type": "start" | "pickup" | "meeting_point" | "destination",
      "time": "HH:MM",
      "carNames": ["Etichetta esatta dell'auto"],
      "lat": 45.4854,
      "lng": 9.2045,
      "description": "Descrizione tappa (es. Partenza auto / Salita passeggero Nome / Punto di ritrovo / Arrivo)"
    }
  ]
}`

  const ai = new GoogleGenAI({ apiKey: resolvedKey })
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
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

  let parsedWaypoints: any[] = []
  let aiSummary = ''

  if (rawJson) {
    try {
      const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      parsedWaypoints = Array.isArray(parsed?.waypoints) ? parsed.waypoints : []
      aiSummary = typeof parsed?.summary === 'string' ? parsed.summary : ''
    } catch (err) {
      console.warn('[Convoy AI] JSON parse warning, using deterministic fallback:', err)
    }
  } else if (lastError) {
    throw createError({
      statusCode: 502,
      statusMessage: `Errore nella chiamata a Gemini AI: ${lastError?.message || 'Risposta vuota'}`
    })
  }

  // Deterministic verification & assembly of waypoints so every car's track is 100% accurate:
  // - Exact start for each car
  // - Pre-meeting passenger pickups for that car before reaching the meeting point
  // - Exact manual meeting points if set by organizer
  // - Single merged convoy track from the meeting point through any post-meeting passenger pickups up to destination
  // - Exact final destination
  const finalWaypoints: ConvoyWaypoint[] = []
  const fallbackDestCoords = destCoords || { lat: 41.9028, lng: 12.4964 }

  // Helper to find matching AI waypoint for a car & type
  function findAiWpForCar(carLabel: string, type: string, placeHint?: string) {
    const lowerLabel = carLabel.toLowerCase()
    const lowerHint = (placeHint || '').toLowerCase()
    return parsedWaypoints.find(w => {
      if (w?.type !== type) return false
      const names: string[] = Array.isArray(w?.carNames) ? w.carNames.map((s: any) => String(s).toLowerCase()) : []
      const carMatch = names.some(n => n === lowerLabel || n.includes(lowerLabel) || lowerLabel.includes(n))
      if (!carMatch) return false
      if (!lowerHint) return true
      const wName = String(w?.name || '').toLowerCase()
      const wDesc = String(w?.description || '').toLowerCase()
      return wName.includes(lowerHint) || lowerHint.includes(wName) || wDesc.includes(lowerHint)
    })
  }

  // Pre-calculate meeting point times topographically (downstream targets first)
  // so child meeting points are strictly earlier than the meeting point or destination they merge into
  const mpTimeMinutesMap = new Map<string, number>()
  const resolvingMpIds = new Set<string>()

  function resolveMpMinutes(mpId: string): number {
    if (mpTimeMinutesMap.has(mpId)) {
      return mpTimeMinutesMap.get(mpId)!
    }
    const mp = resolvedMeetingPoints.find(m => m.id === mpId)
    if (!mp) return destMinutes - 20
    if (mp.time) {
      const parsed = parseTimeToMinutes(mp.time)
      mpTimeMinutesMap.set(mpId, parsed)
      return parsed
    }
    if (resolvingMpIds.has(mpId)) {
      return destMinutes - 30
    }
    resolvingMpIds.add(mpId)

    const parentMp = resolvedMeetingPoints.find(other => (other.meetingPointIds || []).includes(mp.id))
    const downstreamMinutes = parentMp ? resolveMpMinutes(parentMp.id) : destMinutes
    const downstreamCoords = parentMp ? (parentMp.coords || fallbackDestCoords) : (destCoords || fallbackDestCoords)

    resolvingMpIds.delete(mpId)

    const postList = mpPostPassengersMap.get(mp.id) || []
    let postChainDistKm = 0
    let prevCoord = mp.coords
    for (const p of postList) {
      if (prevCoord && p.coords) {
        postChainDistKm += haversineKm(prevCoord, p.coords)
      }
      if (p.coords) prevCoord = p.coords
    }
    if (prevCoord && downstreamCoords) {
      postChainDistKm += haversineKm(prevCoord, downstreamCoords)
    }

    const estimatedPostMinutes = postChainDistKm > 0
      ? Math.max(15 + postList.length * 5, Math.min(150, Math.round(postChainDistKm * 1.15) + postList.length * 5))
      : 20 + postList.length * 8

    const aiMp = parsedWaypoints.find(
      w => w?.type === 'meeting_point' &&
        (String(w?.name || '').toLowerCase().includes(mp.name.toLowerCase()) ||
          mp.name.toLowerCase().includes(String(w?.name || '').toLowerCase()))
    )

    const maxAllowedMpMin = downstreamMinutes - Math.max(12, (postList.length + 1) * 5)
    let mpMin = aiMp?.time
      ? parseTimeToMinutes(aiMp.time)
      : downstreamMinutes - estimatedPostMinutes

    if (mpMin > maxAllowedMpMin) {
      mpMin = maxAllowedMpMin
    }
    mpTimeMinutesMap.set(mp.id, mpMin)
    return mpMin
  }

  for (const mp of resolvedMeetingPoints) {
    resolveMpMinutes(mp.id)
  }

  // 1. Build each car's start and PRE-meeting passenger pickup waypoints
  for (let cIdx = 0; cIdx < carsWithSplitPassengers.length; cIdx++) {
    const car = carsWithSplitPassengers[cIdx]!
    const carMp = car.carMp
    const prePassengers = car.preMeetingPassengers
    const endLimitMin = carMp ? (mpTimeMinutesMap.get(carMp.id) ?? (destMinutes - 20)) : destMinutes

    const distToTargetKm =
      car.coords && carMp?.coords
        ? Number(haversineKm(car.coords, carMp.coords).toFixed(1))
        : car.distToDestKm

    const totalStopsBeforeEnd = 1 + prePassengers.length
    const estimatedDriveMinutes = distToTargetKm !== null
      ? Math.max(10 + prePassengers.length * 4, Math.min(180, Math.round(distToTargetKm * 1.15) + prePassengers.length * 5))
      : 25 + prePassengers.length * 7

    const aiStart = findAiWpForCar(car.carLabel, 'start')
    let startMin = car.departureTime
      ? parseTimeToMinutes(car.departureTime)
      : aiStart?.time
        ? parseTimeToMinutes(aiStart.time)
        : endLimitMin - estimatedDriveMinutes

    // Ensure startMin leaves enough room for all pre-meeting passenger pickups before endLimitMin
    const maxAllowedStartMin = endLimitMin - totalStopsBeforeEnd * 4
    if (startMin > maxAllowedStartMin) {
      startMin = maxAllowedStartMin
    }

    const startLat = car.coords?.lat ?? (Number(aiStart?.lat) || Number((fallbackDestCoords.lat + 0.04 * (cIdx + 1)).toFixed(4)))
    const startLng = car.coords?.lng ?? (Number(aiStart?.lng) || Number((fallbackDestCoords.lng - 0.04 * (cIdx + 1)).toFixed(4)))

    finalWaypoints.push({
      name: car.departureLocation,
      type: 'start',
      time: formatMinutesToTime(startMin),
      carNames: [car.carLabel],
      lat: startLat,
      lng: startLng,
      description: `Partenza ${car.carLabel}${car.assignedPassengers.length === 0 ? ' (diretta verso destinazione)' : ''}`
    })

    // Add pickup waypoints for each pre-meeting passenger assigned to this car
    const stepMinutes = Math.max(
      3,
      Math.floor((endLimitMin - startMin) / (prePassengers.length + 1))
    )
    let prevMin = startMin

    for (let pIdx = 0; pIdx < prePassengers.length; pIdx++) {
      const p = prePassengers[pIdx]!
      const aiPickup =
        findAiWpForCar(car.carLabel, 'pickup', p.pickupLocation) ||
        findAiWpForCar(car.carLabel, 'pickup', p.alias)

      let pickupMin = aiPickup?.time ? parseTimeToMinutes(aiPickup.time) : prevMin + stepMinutes
      const minAllowed = prevMin + 2
      const maxAllowed = endLimitMin - (prePassengers.length - pIdx) * 2
      if (pickupMin < minAllowed || pickupMin > maxAllowed) {
        pickupMin = Math.max(minAllowed, Math.min(maxAllowed, prevMin + stepMinutes))
      }
      prevMin = pickupMin

      const ratio = (pIdx + 1) / (prePassengers.length + 1)
      const targetLat = carMp?.coords?.lat ?? fallbackDestCoords.lat
      const targetLng = carMp?.coords?.lng ?? fallbackDestCoords.lng
      const pickupLat =
        p.coords?.lat ??
        (Number(aiPickup?.lat) || Number((startLat + (targetLat - startLat) * ratio).toFixed(4)))
      const pickupLng =
        p.coords?.lng ??
        (Number(aiPickup?.lng) || Number((startLng + (targetLng - startLng) * ratio).toFixed(4)))

      finalWaypoints.push({
        name: p.pickupLocation,
        type: 'pickup',
        time: formatMinutesToTime(pickupMin),
        carNames: [car.carLabel],
        lat: pickupLat,
        lng: pickupLng,
        description: `Salita a bordo: ${p.fullName} (su ${car.carLabel})`
      })
    }
  }

  // 2. Add organizer-defined manual meeting points AND their post-meeting convoy pickups
  const aiDest = parsedWaypoints.find(w => w?.type === 'destination')
  const destLat = destCoords?.lat ?? (Number(aiDest?.lat) || fallbackDestCoords.lat)
  const destLng = destCoords?.lng ?? (Number(aiDest?.lng) || fallbackDestCoords.lng)

  for (const mp of resolvedMeetingPoints) {
    const aiMp = parsedWaypoints.find(
      w => w?.type === 'meeting_point' &&
        (String(w?.name || '').toLowerCase().includes(mp.name.toLowerCase()) ||
          mp.name.toLowerCase().includes(String(w?.name || '').toLowerCase()))
    )
    const mpMin = mpTimeMinutesMap.get(mp.id) ?? (destMinutes - 20)

    // Fallback coordinates: average between participating cars' last stops and destination
    const participatingStops = finalWaypoints.filter(w =>
      w.carNames.some(cn => mp.allCarLabels.includes(cn))
    )
    const avgLat = participatingStops.length > 0
      ? participatingStops.reduce((s, w) => s + w.lat, 0) / participatingStops.length
      : fallbackDestCoords.lat
    const avgLng = participatingStops.length > 0
      ? participatingStops.reduce((s, w) => s + w.lng, 0) / participatingStops.length
      : fallbackDestCoords.lng

    const mpLat =
      mp.coords?.lat ??
      (Number(aiMp?.lat) || Number(((avgLat + fallbackDestCoords.lat) / 2).toFixed(4)))
    const mpLng =
      mp.coords?.lng ??
      (Number(aiMp?.lng) || Number(((avgLng + fallbackDestCoords.lng) / 2).toFixed(4)))

    const mpDescription = mp.notes
      ? `${mp.notes} — Ritrovo per: ${mp.allCarLabels.join(', ')}`
      : (mp.incomingMeetingPointNames.length > 0
          ? `Ritrovo e unione convoglio da ${mp.incomingMeetingPointNames.join(', ')} con ${mp.directCarLabels.length > 0 ? mp.directCarLabels.join(', ') : 'altre auto'}`
          : `Punto di ritrovo per: ${mp.allCarLabels.join(', ')}`)

    finalWaypoints.push({
      name: mp.name,
      type: 'meeting_point',
      time: formatMinutesToTime(mpMin),
      carNames: [...mp.allCarLabels],
      lat: mpLat,
      lng: mpLng,
      description: mpDescription
    })

    // Add post-meeting pickups along the single merged convoy route from mp to destination
    const postList = mpPostPassengersMap.get(mp.id) || []
    if (postList.length > 0) {
      const stepPost = Math.max(
        3,
        Math.floor((destMinutes - mpMin) / (postList.length + 1))
      )
      let prevPostMin = mpMin

      for (let pIdx = 0; pIdx < postList.length; pIdx++) {
        const p = postList[pIdx]!
        const aiPickup =
          findAiWpForCar(p.assignedCarLabel, 'pickup', p.pickupLocation) ||
          findAiWpForCar(p.assignedCarLabel, 'pickup', p.alias)

        let pickupMin = aiPickup?.time ? parseTimeToMinutes(aiPickup.time) : prevPostMin + stepPost
        const minAllowed = prevPostMin + 2
        const maxAllowed = destMinutes - (postList.length - pIdx) * 2
        if (pickupMin < minAllowed || pickupMin > maxAllowed) {
          pickupMin = Math.max(minAllowed, Math.min(maxAllowed, prevPostMin + stepPost))
        }
        prevPostMin = pickupMin

        const ratio = (pIdx + 1) / (postList.length + 1)
        const pickupLat =
          p.coords?.lat ??
          (Number(aiPickup?.lat) || Number((mpLat + (destLat - mpLat) * ratio).toFixed(4)))
        const pickupLng =
          p.coords?.lng ??
          (Number(aiPickup?.lng) || Number((mpLng + (destLng - mpLng) * ratio).toFixed(4)))

        finalWaypoints.push({
          name: p.pickupLocation,
          type: 'pickup',
          time: formatMinutesToTime(pickupMin),
          // All cars merged at this meeting point travel together along this single track
          carNames: [...mp.allCarLabels],
          lat: pickupLat,
          lng: pickupLng,
          description: `Salita a bordo: ${p.fullName} (su ${p.assignedCarLabel} — in convoglio)`
        })
      }
    }
  }

  // 3. Add final destination waypoint
  const allCarLabels = carsWithPassengers.map(c => c.carLabel)

  finalWaypoints.push({
    name: event.destination,
    type: 'destination',
    time: targetArrivalTime,
    carNames: allCarLabels,
    lat: destLat,
    lng: destLng,
    description: `Arrivo a destinazione (${event.title})`
  })

  const inputFingerprint = computeRouteFingerprint(
    event.destination,
    targetArrivalTime,
    resolvedMeetingPoints,
    validRiders.map(r => ({
      rider: r,
      passengers: passengers.filter(p => p.assignedRiderId === r.id)
    }))
  )

  return {
    summary:
      aiSummary ||
      (resolvedMeetingPoints.length > 0
        ? `Tracciato calcolato per ${carsWithPassengers.length} auto con ${resolvedMeetingPoints.length} punto/i di ritrovo fino a ${event.destination}.`
        : `Tracciato diretto calcolato per ${carsWithPassengers.length} auto fino a ${event.destination}.`),
    arrivalTime: targetArrivalTime,
    inputFingerprint,
    waypoints: finalWaypoints,
    steps: [],
    calculatedAt: new Date().toISOString()
  }
}
