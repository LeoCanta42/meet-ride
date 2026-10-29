import { GoogleGenAI } from '@google/genai'
import type {
  EventItem,
  Participant,
  OptimizationSuggestion,
  OptimizationResult,
  UnusedCarInfo
} from '~/types'
import {
  geocodePlaceName,
  haversineKm,
  bearingFromToDeg,
  sanitizeTextForAi,
  getFirstAlias
} from './convoy'

/**
 * Task 1: Optimize people arrangement in cars with Gemini AI.
 * - Distributes passengers into cars based on where cars start, where passengers are picked up,
 *   and where everyone must arrive (event destination).
 * - Does NOT have to use all cars and avoids splitting people across cars unnecessarily:
 *   consolidates passengers along compatible routes into as few cars as needed within each car's totalSeats.
 */
export async function optimizeSeatAllocationWithGemini(
  event: EventItem,
  riders: Participant[],
  passengers: Participant[],
  apiKey?: string
): Promise<OptimizationResult> {
  const resolvedKey = (
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim()

  if (!resolvedKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Chiave GEMINI_API_KEY non trovata nel file .env. Aggiungi GEMINI_API_KEY nel file .env per utilizzare l\'ottimizzatore AI.'
    })
  }

  if (riders.length === 0) {
    return {
      suggestions: [],
      totalMoved: 0,
      summary: 'Nessuna auto disponibile per questo evento. Aggiungi almeno un guidatore.',
      unassignedRemaining: passengers.length,
      usedCarsCount: 0,
      totalCarsCount: 0,
      unusedCars: []
    }
  }

  if (passengers.length === 0) {
    return {
      suggestions: [],
      totalMoved: 0,
      summary: 'Nessun passeggero registrato per questo evento.',
      unassignedRemaining: 0,
      usedCarsCount: 0,
      totalCarsCount: riders.length,
      unusedCars: riders.map(r => ({
        riderId: r.id,
        driverName: r.name,
        carModel: r.carModel || 'Auto',
        departureLocation: r.departureLocation || 'Non specificato',
        reason: 'Nessun passeggero da trasportare'
      }))
    }
  }

  // 1. Geocode destination, car departure locations, and passenger pickup locations
  const destCoords =
    event.destinationCoords ||
    (await geocodePlaceName(event.destination)) ||
    null
  if (destCoords && !event.destinationCoords) {
    event.destinationCoords = destCoords
  }

  const enrichedRiders = await Promise.all(
    riders.map(async (r) => {
      const coords =
        r.departureCoords ||
        (r.departureLocation ? await geocodePlaceName(r.departureLocation, event.destination) : null)
      if (coords && !r.departureCoords) {
        r.departureCoords = coords
      }

      const distanceToDestKm =
        coords && destCoords ? Number(haversineKm(coords, destCoords).toFixed(1)) : null
      const bearingFromDestDeg =
        coords && destCoords ? Number(bearingFromToDeg(destCoords, coords).toFixed(1)) : null

      return {
        rider: r,
        coords,
        distanceToDestKm,
        bearingFromDestDeg
      }
    })
  )

  const enrichedPassengers = await Promise.all(
    passengers.map(async (p) => {
      const coords =
        p.pickupCoords ||
        (p.pickupLocation ? await geocodePlaceName(p.pickupLocation, event.destination) : null)
      if (coords && !p.pickupCoords) {
        p.pickupCoords = coords
      }

      const distanceToDestKm =
        coords && destCoords ? Number(haversineKm(coords, destCoords).toFixed(1)) : null
      const bearingFromDestDeg =
        coords && destCoords ? Number(bearingFromToDeg(destCoords, coords).toFixed(1)) : null

      // Compute geometric compatibility with each car
      const carCompatibility = enrichedRiders.map((er) => {
        const distFromCarStartKm =
          er.coords && coords ? Number(haversineKm(er.coords, coords).toFixed(1)) : null
        const detourKm =
          er.coords && coords && destCoords && er.distanceToDestKm !== null && distanceToDestKm !== null
            ? Number(Math.max(0, distFromCarStartKm! + distanceToDestKm - er.distanceToDestKm).toFixed(1))
            : null
        const isUpstreamOrSameArea =
          er.distanceToDestKm !== null && distanceToDestKm !== null && distFromCarStartKm !== null
            ? er.distanceToDestKm >= distanceToDestKm - 1.5 || distFromCarStartKm <= 3.0
            : true

        return {
          riderId: er.rider.id,
          driverAlias: getFirstAlias(er.rider.name),
          carModel: er.rider.carModel || 'Auto',
          departureLocation: er.rider.departureLocation || 'Non specificato',
          totalSeats: er.rider.totalSeats || 4,
          distFromCarStartKm,
          detourKm,
          isUpstreamOrSameArea
        }
      })

      carCompatibility.sort((a, b) => {
        if (a.isUpstreamOrSameArea !== b.isUpstreamOrSameArea) {
          return a.isUpstreamOrSameArea ? -1 : 1
        }
        const detA = a.detourKm ?? 999
        const detB = b.detourKm ?? 999
        if (Math.abs(detA - detB) > 1.5) return detA - detB
        return (a.distFromCarStartKm ?? 999) - (b.distFromCarStartKm ?? 999)
      })

      return {
        passenger: p,
        coords,
        distanceToDestKm,
        bearingFromDestDeg,
        carCompatibility
      }
    })
  )

  const carsPromptData = enrichedRiders.map(er => ({
    riderId: er.rider.id,
    driverAlias: getFirstAlias(er.rider.name),
    carModel: er.rider.carModel || 'Auto',
    totalSeats: er.rider.totalSeats || 4,
    hasDriver: er.rider.hasDriver !== false,
    departureLocation: er.rider.departureLocation || 'Non specificato',
    coordinates: er.coords ? `${er.coords.lat}, ${er.coords.lng}` : null,
    distanceToDestKm: er.distanceToDestKm,
    bearingFromDestDeg: er.bearingFromDestDeg
  }))

  const passengersPromptData = enrichedPassengers.map(ep => ({
    passengerId: ep.passenger.id,
    alias: getFirstAlias(ep.passenger.name),
    pickupLocation: ep.passenger.pickupLocation || 'Non specificato',
    coordinates: ep.coords ? `${ep.coords.lat}, ${ep.coords.lng}` : null,
    distanceToDestKm: ep.distanceToDestKm,
    bearingFromDestDeg: ep.bearingFromDestDeg,
    notes: sanitizeTextForAi(ep.passenger.notes),
    carCompatibility: ep.carCompatibility.map(cc => ({
      riderId: cc.riderId,
      carLabel: `${cc.carModel} di ${cc.driverAlias} (${cc.departureLocation})`,
      totalSeats: cc.totalSeats,
      distFromCarStartKm: cc.distFromCarStartKm,
      detourKm: cc.detourKm,
      isUpstreamOrSameArea: cc.isUpstreamOrSameArea
    }))
  }))

  const prompt = `Sei un esperto di logistica e carpooling. Il tuo unico obiettivo è distribuire in modo ottimale i PASSEGGERI nelle AUTO disponibili considerando:
- Da dove parte ciascuna auto ("departureLocation")
- Dove si trova ciascun passeggero ("pickupLocation")
- Dove devono arrivare tutti ("${event.destination}")
- La capienza massima di posti passeggeri di ciascuna auto ("totalSeats")

REGOLE CRITICHE DI OTTIMIZZAZIONE:
1. NON È NECESSARIO USARE TUTTE LE AUTO & VIETATO DIVIDERE INUTILMENTE LE PERSONE:
   - NON spalmare i passeggeri su tutte le auto solo per dare 1 passeggero a ciascuno!
   - Se una singola auto (o poche auto) ha abbastanza posti ("totalSeats") per raccogliere i passeggeri situati alla partenza o lungo il suo tragitto verso "${event.destination}", concentrane il più possibile su quell'auto fino a riempirla ("totalSeats") prima di utilizzare un'altra vettura.
   - I passeggeri che partono dalla stessa città/quartiere o lungo la stessa direttrice devono viaggiare insieme nella stessa auto finché ci sono posti disponibili.
   - Le auto che non sono necessarie per caricare passeggeri devono restare con 0 passeggeri assegnati e vanno elencate in "unusedCars".

2. LOGICA DI PERCORSO DA MONTE A VALLE (MINIMA DEVIAZIONE):
   - Consulta "carCompatibility" per ogni passeggero: "detourKm" indica di quanti km l'auto deve deviare rispetto al percorso diretto verso "${event.destination}", e "isUpstreamOrSameArea" indica se l'auto parte più a monte (o dalla stessa zona) del passeggero.
   - Assegna i passeggeri all'auto che scende lungo la stessa direttrice ("detourKm" minimo e "isUpstreamOrSameArea": true).
   - Evita che un'auto partita più vicino alla destinazione torni indietro ("isUpstreamOrSameArea": false) se c'è un'auto con posti liberi che parte più a monte lungo quel corridoio.

3. CAPIENZA RIGIDA ("totalSeats"):
   - Non assegnare MAI a un'auto un numero di passeggeri superiore al suo "totalSeats".
   - Assicurati che TUTTI i passeggeri ricevano un posto finché la somma dei "totalSeats" lo consente.

DATI EVENTO:
- Destinazione finale: "${event.destination}"${destCoords ? ` (Coordinate: ${destCoords.lat}, ${destCoords.lng})` : ''}

AUTO DISPONIBILI (${carsPromptData.length}):
${JSON.stringify(carsPromptData, null, 2)}

PASSEGGERI DA DISTRIBUIRE (${passengersPromptData.length}):
${JSON.stringify(passengersPromptData, null, 2)}

Rispondi ESCLUSIVAMENTE con un JSON valido conforme a questo schema:
{
  "summary": "Breve riepilogo in italiano della distribuzione scelta (es. 'Distribuiti 4 passeggeri su 2 delle 3 auto disponibili seguendo le direttrici stradali senza dividere i gruppi')",
  "suggestions": [
    {
      "passengerId": "ID univoco del passeggero",
      "suggestedRiderId": "ID univoco dell'auto assegnata",
      "distanceKm": 2.5,
      "reason": "Spiegazione chiara in italiano del perché quest'auto è la scelta migliore (percorso verso destinazione, vicinanza e accorpamento)"
    }
  ],
  "unusedCars": [
    {
      "riderId": "ID univoco dell'auto non usata per passeggeri",
      "reason": "Spiegazione breve (es. 'Non necessaria per caricare passeggeri: tutti i passeggeri sono già accolti nelle altre auto lungo il percorso')"
    }
  ]
}`

  const ai = new GoogleGenAI({ apiKey: resolvedKey })
  const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
  let rawJson = ''
  let lastError: any = null

  for (const modelName of models) {
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
      console.warn(`[Gemini AI Optimizer] Model ${modelName} failed:`, err?.message)
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
    console.error('[Gemini AI Optimizer] JSON parse error:', rawJson)
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini AI ha restituito una risposta non conforme al formato JSON atteso.'
    })
  }

  const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []
  const rawUnused = Array.isArray(parsed?.unusedCars) ? parsed.unusedCars : []

  const suggestions: OptimizationSuggestion[] = []
  const assignedPassengerIds = new Set<string>()
  const carUsage = new Map<string, number>()
  for (const r of riders) {
    carUsage.set(r.id, 0)
  }

  // 1. Apply valid AI suggestions within strict car seat capacity
  for (const s of rawSuggestions) {
    const rider = riders.find(r => r.id === s?.suggestedRiderId)
    const ep = enrichedPassengers.find(item => item.passenger.id === s?.passengerId)
    if (!rider || !ep || assignedPassengerIds.has(ep.passenger.id)) continue

    const currentCount = carUsage.get(rider.id) || 0
    const maxSeats = rider.totalSeats || 4

    if (currentCount < maxSeats) {
      carUsage.set(rider.id, currentCount + 1)
      assignedPassengerIds.add(ep.passenger.id)
      const compat = ep.carCompatibility.find(c => c.riderId === rider.id)
      const distKm =
        typeof s.distanceKm === 'number'
          ? s.distanceKm
          : (compat?.detourKm ?? compat?.distFromCarStartKm ?? undefined)

      suggestions.push({
        passengerId: ep.passenger.id,
        passengerName: ep.passenger.name,
        passengerPickupLocation: ep.passenger.pickupLocation || 'Non specificato',
        currentRiderId: ep.passenger.assignedRiderId || null,
        suggestedRiderId: rider.id,
        suggestedRiderName: rider.name,
        carModel: rider.carModel || 'Auto',
        carDepartureLocation: rider.departureLocation || 'Non specificato',
        distanceKm: distKm,
        reason: s.reason || `Lungo il tragitto da ${rider.departureLocation || 'partenza'} verso ${event.destination}.`
      })
    }
  }

  // 2. Fallback for any passenger left unassigned if seats are still available
  // Prefer cars that are ALREADY in use (to avoid splitting across extra cars unnecessarily) and have minimal detour
  for (const ep of enrichedPassengers) {
    if (assignedPassengerIds.has(ep.passenger.id)) continue

    const availableCompats = ep.carCompatibility.filter(c => {
      const used = carUsage.get(c.riderId) || 0
      return used < c.totalSeats
    })

    if (availableCompats.length > 0) {
      availableCompats.sort((a, b) => {
        const aUsed = (carUsage.get(a.riderId) || 0) > 0
        const bUsed = (carUsage.get(b.riderId) || 0) > 0
        const detA = a.detourKm ?? 999
        const detB = b.detourKm ?? 999
        // If an already-used car has a very similar detour (within 4km), prefer consolidating into it
        if (aUsed !== bUsed && Math.abs(detA - detB) <= 4) {
          return aUsed ? -1 : 1
        }
        return detA - detB
      })

      const chosen = availableCompats[0]!
      const rider = riders.find(r => r.id === chosen.riderId)!
      carUsage.set(rider.id, (carUsage.get(rider.id) || 0) + 1)
      assignedPassengerIds.add(ep.passenger.id)

      suggestions.push({
        passengerId: ep.passenger.id,
        passengerName: ep.passenger.name,
        passengerPickupLocation: ep.passenger.pickupLocation || 'Non specificato',
        currentRiderId: ep.passenger.assignedRiderId || null,
        suggestedRiderId: rider.id,
        suggestedRiderName: rider.name,
        carModel: rider.carModel || 'Auto',
        carDepartureLocation: rider.departureLocation || 'Non specificato',
        distanceKm: chosen.detourKm ?? chosen.distFromCarStartKm ?? undefined,
        reason: `Assegnato all'auto di ${rider.name} per compatibilità di percorso verso ${event.destination}.`
      })
    }
  }

  const unassignedRemaining = passengers.length - assignedPassengerIds.size
  const usedCarsCount = riders.filter(r => (carUsage.get(r.id) || 0) > 0).length
  const totalCarsCount = riders.length

  const unusedCars: UnusedCarInfo[] = riders
    .filter(r => (carUsage.get(r.id) || 0) === 0)
    .map(r => {
      const aiUnused = rawUnused.find((u: any) => u?.riderId === r.id)
      return {
        riderId: r.id,
        driverName: r.name,
        carModel: r.carModel || 'Auto',
        departureLocation: r.departureLocation || 'Non specificato',
        reason:
          aiUnused?.reason ||
          'Non necessaria per caricare passeggeri (tutti i passeggeri sono già accomodati nelle altre vetture lungo il tragitto)'
      }
    })

  const defaultSummary =
    unusedCars.length > 0
      ? `Distribuiti ${suggestions.length} passeggeri utilizzando solo ${usedCarsCount} su ${totalCarsCount} auto disponibili, evitando di dividere i gruppi inutilmente.`
      : `Distribuiti ${suggestions.length} passeggeri su ${usedCarsCount} auto in base ai punti di partenza e alla destinazione.`

  return {
    suggestions,
    totalMoved: suggestions.length,
    summary: parsed?.summary || defaultSummary,
    unassignedRemaining,
    usedCarsCount,
    totalCarsCount,
    unusedCars
  }
}
