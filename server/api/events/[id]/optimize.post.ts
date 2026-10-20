import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'
import { optimizeSeatAllocationWithGemini } from '../../../utils/optimizer'
import type { Participant } from '~/types'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))
  const apply = !!body?.apply

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento mancante' })
  }

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === eventId || e.slug === eventId)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const organizer = await getAuthenticatedOrganizer(event)
  const isOrganizer = organizer && organizer.id === foundEvent.organizerId

  if (!isOrganizer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo l\'organizzatore che ha creato l\'evento può utilizzare l\'ottimizzatore AI'
    })
  }

  const eventParticipants = db.participants.filter(p => p.eventId === foundEvent.id)
  const riders = eventParticipants.filter(p => p.role === 'rider')
  const passengers = eventParticipants.filter(p => p.role === 'passenger')

  // Execute Gemini AI Optimization
  const result = await optimizeSeatAllocationWithGemini(foundEvent, riders, passengers)

  if (apply && result.suggestions.length > 0) {
    for (const suggestion of result.suggestions) {
      const passenger = db.participants.find((p: Participant) => p.id === suggestion.passengerId)
      if (passenger) {
        passenger.assignedRiderId = suggestion.suggestedRiderId
      }
    }
    await saveDb(db)
  }

  return {
    ...result,
    applied: apply
  }
})
