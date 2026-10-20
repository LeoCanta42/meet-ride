import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const organizer = await getAuthenticatedOrganizer(event)

  if (!organizer) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
  }

  const db = await getDb()
  const eventIndex = db.events.findIndex(e => e.id === id)

  if (eventIndex === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const existingEvent = db.events[eventIndex]
  if (!existingEvent || existingEvent.organizerId !== organizer.id) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi modificare questo evento' })
  }

  const body = await readBody(event)
  const { title, description, destination, destinationCoords, eventDate, sharedPassword } = body || {}

  const updated = {
    ...existingEvent,
    title: title ? title.trim() : existingEvent.title,
    description: description !== undefined ? description.trim() : existingEvent.description,
    destination: destination ? destination.trim() : existingEvent.destination,
    destinationCoords: destinationCoords !== undefined ? destinationCoords : existingEvent.destinationCoords,
    eventDate: eventDate ? new Date(eventDate).toISOString() : existingEvent.eventDate,
    sharedPassword: sharedPassword ? sharedPassword.trim() : existingEvent.sharedPassword,
    updatedAt: new Date().toISOString()
  }

  db.events[eventIndex] = updated

  await saveDb(db)
  return { event: updated }
})
