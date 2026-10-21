import { getDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer, checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento mancante' })
  }

  checkRateLimit(event, `reconnect:${eventId}`, 12, 15 * 60 * 1000)

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === eventId || e.slug === eventId)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const organizer = await getAuthenticatedOrganizer(event)
  const isOrganizer = organizer?.id === foundEvent.organizerId
  const unlocked = isOrganizer || isEventUnlocked(event, foundEvent.id)

  if (!unlocked) {
    throw createError({ statusCode: 403, statusMessage: 'Inserisci la password dell\'evento per accedere' })
  }

  const body = await readBody(event).catch(() => ({}))
  const { participantId, credential } = body || {}

  if (!credential || !String(credential).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Inserisci Telefono, PIN o Token' })
  }

  const input = String(credential).trim()

  // Allow direct token match across all participants in this event (for "Link o Token" tab)
  const directTokenParticipant = db.participants.find(
    p => p.eventId === foundEvent.id && p.token && p.token === input
  )
  if (directTokenParticipant) {
    resetRateLimit(event, `reconnect:${eventId}`)
    const { pin: _pin, ...safeParticipant } = directTokenParticipant
    return {
      success: true,
      participant: { ...safeParticipant, hasPin: Boolean(_pin) },
      token: directTokenParticipant.token
    }
  }

  if (!participantId) {
    throw createError({ statusCode: 400, statusMessage: 'Seleziona il partecipante dalla lista' })
  }

  const participant = db.participants.find(p => p.id === participantId && p.eventId === foundEvent.id)
  if (!participant) {
    throw createError({ statusCode: 404, statusMessage: 'Partecipante non trovato in questo evento' })
  }

  const inputDigits = input.replace(/\D/g, '')
  let matched = false

  // 1. Direct secret token match
  if (participant.token && input === participant.token) {
    matched = true
  }

  // 2. PIN match
  if (!matched && participant.pin && input === participant.pin.trim()) {
    matched = true
  }

  // 3. Phone number match (comparing at least last 6 digits to prevent short-digit guessing)
  if (!matched && participant.phone && inputDigits.length >= 6) {
    const phoneDigits = participant.phone.replace(/\D/g, '')
    if (
      phoneDigits === inputDigits ||
      (phoneDigits.length >= 6 && phoneDigits.endsWith(inputDigits)) ||
      (phoneDigits.length >= 6 && inputDigits.endsWith(phoneDigits))
    ) {
      matched = true
    }
  }

  if (!matched) {
    recordFailedAttempt(event, `reconnect:${eventId}`, 15 * 60 * 1000)
    throw createError({
      statusCode: 401,
      statusMessage: 'Telefono o PIN errato. Verifica i dati inseriti al momento dell\'iscrizione.'
    })
  }

  resetRateLimit(event, `reconnect:${eventId}`)
  const { pin: _pin, ...safeParticipant } = participant

  return {
    success: true,
    participant: { ...safeParticipant, hasPin: Boolean(_pin) },
    token: participant.token
  }
})
