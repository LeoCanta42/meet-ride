import { getDb, deleteEventFromDb } from '../../../utils/db'
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

  await deleteEventFromDb(id!, db)
  return { success: true }
})
