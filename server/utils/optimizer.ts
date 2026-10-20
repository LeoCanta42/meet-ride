import { GoogleGenAI } from '@google/genai'
import type { EventItem, Participant, OptimizationSuggestion, OptimizationResult } from '~/types'

/**
 * Optimizes seat allocation using Google Gemini AI.
 * Analyzes driver departure points, passenger pickup locations, car capacities,
 * and the final event destination to find the best routes and assignments.
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
      statusMessage: 'Chiave GEMINI_API_KEY non trovata nel file .env. Aggiungi GEMINI_API_KEY nel tuo file .env per utilizzare l\'ottimizzatore AI.'
    })
  }

  if (riders.length === 0) {
    return {
      suggestions: [],
      totalMoved: 0,
      summary: 'Nessuna auto disponibile per questo evento. Aggiungi almeno un guidatore.',
      unassignedRemaining: passengers.length
    }
  }

  if (passengers.length === 0) {
    return {
      suggestions: [],
      totalMoved: 0,
      summary: 'Nessun passeggero registrato per questo evento.',
      unassignedRemaining: 0
    }
  }

  // Format data for the prompt
  const ridersData = riders.map(r => {
    const currentPassengers = passengers.filter(p => p.assignedRiderId === r.id)
    return {
      riderId: r.id,
      name: r.name,
      carModel: r.carModel || 'Auto',
      totalSeats: r.totalSeats || 4,
      currentlySeatedCount: currentPassengers.length,
      availableSeats: Math.max(0, (r.totalSeats || 4) - currentPassengers.length),
      departureLocation: r.departureLocation || 'Non specificato',
      departureCoordinates: r.departureCoords ? `${r.departureCoords.lat}, ${r.departureCoords.lng}` : null,
      departureTime: r.departureTime || 'Non specificato',
      seatedPassengerNames: currentPassengers.map(p => p.name)
    }
  })

  const passengersData = passengers.map(p => {
    return {
      passengerId: p.id,
      name: p.name,
      pickupLocation: p.pickupLocation || 'Non specificato',
      pickupCoordinates: p.pickupCoords ? `${p.pickupCoords.lat}, ${p.pickupCoords.lng}` : null,
      notes: p.notes || null,
      currentAssignedRiderId: p.assignedRiderId || null
    }
  })

  const prompt = `Sei un assistente logistico esperto di carpooling, ottimizzazione dei trasporti e geografia stradale.
Il tuo obiettivo è analizzare le posizioni di partenza delle auto e i punti di ritrovo dei passeggeri rispetto alla destinazione finale dell'evento per suggerire la MIGLIORE ALLOCAZIONE DEI POSTI AUTO.

DATI EVENTO:
- Titolo: "${event.title}"
- Destinazione finale: "${event.destination}"
- Data/Ora evento: "${event.eventDate}"
${event.description ? `- Descrizione evento: "${event.description}"` : ''}

AUTO E GUIDATORI DISPONIBILI:
${JSON.stringify(ridersData, null, 2)}

PASSEGGERI DA ASSEGNARE (o già assegnati):
${JSON.stringify(passengersData, null, 2)}

REGOLE CRITICHE DI OTTIMIZZAZIONE:
1. CAPIENZA MASSIMA ("totalSeats"): In nessun caso un'auto può ospitare più passeggeri dei suoi "totalSeats". Il vincolo è rigido.
2. PROSSIMITÀ & ROTTE: Valuta dove si trovano le città, i quartieri, i caselli autostradali e le direttrici di traffico verso la destinazione "${event.destination}".
   - Abbina ogni passeggero all'auto che ha il punto di partenza più vicino o che si trova naturalmente lungo il percorso di guida verso l'evento (minimizzando deviazioni o tragitti inversi).
   - Se un passeggero non è ancora assegnato (currentAssignedRiderId = null), assegnalo all'auto migliore disponibile.
   - Se un passeggero è assegnato a un'auto lontana mentre un'altra auto vicina ha posti liberi, proponi il cambio.
   - Se un passeggero è già nell'auto ottimale, non occorre spostarlo.
3. SPIEGAZIONE GEOGRAFICA: Per ciascun suggerimento, fornisci una motivazione chiara e logistica in italiano (es. "Entrambi partono dalla zona nord vicino alla tangenziale", "Punto di ritrovo sulla direttrice autostradale verso la destinazione"). Stima anche la distanza approssimativa in km se pertinente.

FORMATO RISPOSTA:
Rispondi ESCLUSIVAMENTE con un JSON valido strutturato in questo modo:
{
  "summary": "Breve sintesi dell'ottimizzazione in italiano (max 2 frasi)",
  "suggestions": [
    {
      "passengerId": "ID univoco del passeggero",
      "passengerName": "Nome passeggero",
      "currentRiderId": "ID vecchio guidatore o null",
      "suggestedRiderId": "ID del guidatore a cui assegnare il posto",
      "suggestedRiderName": "Nome guidatore",
      "distanceKm": 4.5,
      "reason": "Motivazione logistica e di percorso"
    }
  ]
}`

  let rawJson = ''
  const ai = new GoogleGenAI({ apiKey: resolvedKey })

  // Try candidate models
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
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
      console.warn(`[Gemini AI] Model ${modelName} failed:`, err?.message)
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
    console.error('[Gemini AI] JSON parse error:', rawJson)
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini AI ha restituito una risposta non conforme al formato JSON atteso.'
    })
  }

  const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []

  // Validate suggestions against capacity and existence
  const suggestions: OptimizationSuggestion[] = []
  const carUsage = new Map<string, number>()
  for (const r of riders) {
    carUsage.set(r.id, 0)
  }

  for (const s of rawSuggestions) {
    const rider = riders.find(r => r.id === s.suggestedRiderId)
    const passenger = passengers.find(p => p.id === s.passengerId)

    if (rider && passenger) {
      const currentCount = carUsage.get(rider.id) || 0
      const maxSeats = rider.totalSeats || 4

      // Enforce vehicle capacity
      if (currentCount < maxSeats) {
        carUsage.set(rider.id, currentCount + 1)
        suggestions.push({
          passengerId: passenger.id,
          passengerName: passenger.name,
          currentRiderId: passenger.assignedRiderId || null,
          suggestedRiderId: rider.id,
          suggestedRiderName: rider.name,
          distanceKm: typeof s.distanceKm === 'number' ? s.distanceKm : undefined,
          reason: s.reason || `Assegnato all'auto di ${rider.name} per vicinanza al percorso.`
        })
      }
    }
  }

  const totalAssignedIds = new Set(suggestions.map(s => s.passengerId))
  const unassignedRemaining = passengers.filter(
    p => !p.assignedRiderId && !totalAssignedIds.has(p.id)
  ).length

  return {
    suggestions,
    totalMoved: suggestions.length,
    summary: parsed?.summary || `${suggestions.length} passeggeri allocati tramite ottimizzazione AI Gemini.`,
    unassignedRemaining
  }
}
