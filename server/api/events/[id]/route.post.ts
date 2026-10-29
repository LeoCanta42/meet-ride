import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'
import { calculateConvoyRouteWithGemini } from '../../../utils/convoy'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento mancante' })
  }

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === eventId || e.slug === eventId)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const organizer = await getAuthenticatedOrganizer(event)
  const isOrganizer = Boolean(
    organizer && (organizer.id === foundEvent.organizerId || organizer.role === 'admin' || organizer.isAdmin === true)
  )

  if (!isOrganizer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo l\'organizzatore dell\'evento può calcolare l\'itinerario sulla mappa'
    })
  }

  const body = await readBody(event).catch(() => ({}))
  if (Array.isArray(body?.meetingPoints)) {
    foundEvent.meetingPoints = body.meetingPoints
  }

  const riders = db.participants.filter(p => p.eventId === foundEvent.id && p.role === 'rider')
  const passengers = db.participants.filter(p => p.eventId === foundEvent.id && p.role === 'passenger')

  if (riders.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nessun veicolo o guidatore presente per questo evento.'
    })
  }

  const unassigned = passengers.filter(p => !p.assignedRiderId)
  if (unassigned.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Tutti i passeggeri devono essere assegnati a un'auto prima di generare la mappa dei percorsi (${unassigned.length} passeggeri ancora senza posto). Usa prima l'Ottimizzatore Posti o assegnali manualmente.`
    })
  }

  const plan = await calculateConvoyRouteWithGemini(foundEvent, riders, passengers)

  foundEvent.routePlan = plan
  foundEvent.updatedAt = new Date().toISOString()
  await saveDb(db)

  return {
    success: true,
    routePlan: plan
  }
})
