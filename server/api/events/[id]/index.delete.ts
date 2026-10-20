import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const organizer = await getAuthenticatedOrganizer(event)

  if (!organizer) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
  }

  const db = await getDb()
  const eventItem = db.events.find(e => e.id === id)

  if (!eventItem) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  if (eventItem.organizerId !== organizer.id) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi eliminare questo evento' })
  }

  // Delete event and related participants
  db.events = db.events.filter(e => e.id !== id)
  db.participants = db.participants.filter(p => p.eventId !== id)

  await saveDb(db)
  return { success: true }
})
