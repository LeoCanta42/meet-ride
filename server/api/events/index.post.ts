import crypto from 'node:crypto'
import { getDb, saveDb, generateSlug } from '../../utils/db'
import { getAuthenticatedOrganizer } from '../../utils/auth'
import type { EventItem } from '~/types'

export default defineEventHandler(async (event) => {
  const organizer = await getAuthenticatedOrganizer(event)
  if (!organizer) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Devi essere autenticato come organizzatore per creare un evento'
    })
  }

  const body = await readBody(event)
  const { title, description, destination, destinationCoords, eventDate, arrivalTime, sharedPassword } = body || {}

  if (!title || !destination || !eventDate || !sharedPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Titolo, destinazione, data e password condivisa sono obbligatori'
    })
  }

  const db = await getDb()
  const slug = generateSlug(title)
  const id = crypto.randomUUID()

  const newEvent: EventItem = {
    id,
    organizerId: organizer.id,
    slug,
    title: title.trim(),
    description: description ? description.trim() : '',
    destination: destination.trim(),
    destinationCoords: destinationCoords || null,
    eventDate: new Date(eventDate).toISOString(),
    arrivalTime: typeof arrivalTime === 'string' && arrivalTime.trim() ? arrivalTime.trim() : null,
    sharedPassword: sharedPassword.trim(),
    status: 'active',
    routePlan: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  db.events.push(newEvent)
  await saveDb(db)

  return { event: newEvent }
})
