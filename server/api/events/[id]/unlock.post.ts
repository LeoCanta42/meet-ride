import { getDb } from '../../../utils/db'
import { setEventUnlocked } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const idOrSlug = getRouterParam(event, 'id')
  const body = await readBody(event)
  const password = (body?.password || '').trim()

  if (!idOrSlug || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password richiesta'
    })
  }

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === idOrSlug || e.slug === idOrSlug)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  // Case-insensitive trimmed password check for seamless user experience
  const expectedPassword = (foundEvent.sharedPassword || '').trim().toLowerCase()
  const isMatch = expectedPassword === password.toLowerCase()

  if (!isMatch) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Password non corretta'
    })
  }

  setEventUnlocked(event, foundEvent.id)

  return { success: true, eventId: foundEvent.id }
})
