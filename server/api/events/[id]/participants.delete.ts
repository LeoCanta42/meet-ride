import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { participantId, token } = body || {}

  if (!eventId || (!participantId && !token)) {
    throw createError({ statusCode: 400, statusMessage: 'Parametri mancanti' })
  }

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === eventId || e.slug === eventId)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const organizer = await getAuthenticatedOrganizer(event)
  const isOrganizer = organizer?.id === foundEvent.organizerId
  const unlocked = isOrganizer || isEventUnlocked(event, foundEvent.id)

  if (!unlocked) {
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato' })
  }

  const target = db.participants.find(p =>
    p.eventId === foundEvent.id &&
    ((participantId && p.id === participantId) || (token && p.token === token))
  )

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Partecipante non trovato' })
  }

  // If this participant was a rider, unassign passengers in their car
  if (target.role === 'rider') {
    db.participants.forEach(p => {
      if (p.assignedRiderId === target.id) {
        p.assignedRiderId = null
      }
    })
  }

  db.participants = db.participants.filter(p => p.id !== target.id)
  await saveDb(db)

  return { success: true }
})
