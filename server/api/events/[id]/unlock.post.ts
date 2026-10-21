import { getDb } from '../../../utils/db'
import { setEventUnlocked, checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const idOrSlug = getRouterParam(event, 'id')
  checkRateLimit(event, `unlock:${idOrSlug || 'any'}`, 15, 15 * 60 * 1000)

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
    recordFailedAttempt(event, `unlock:${idOrSlug}`, 15 * 60 * 1000)
    throw createError({
      statusCode: 403,
      statusMessage: 'Password non corretta'
    })
  }

  resetRateLimit(event, `unlock:${idOrSlug}`)
  setEventUnlocked(event, foundEvent.id)

  return { success: true, eventId: foundEvent.id }
})
