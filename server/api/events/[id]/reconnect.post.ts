import { getDb, saveDb } from '../../../utils/db'
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
  const isOrganizer = Boolean(
    organizer && (organizer.id === foundEvent.organizerId || organizer.role === 'admin' || organizer.isAdmin === true)
  )
  const unlocked = isOrganizer || isEventUnlocked(event, foundEvent.id)

  if (!unlocked) {
    throw createError({ statusCode: 403, statusMessage: 'Inserisci la password dell\'evento per accedere' })
  }

  const body = await readBody(event).catch(() => ({}))
  const { participantId, credential, pin } = body || {}
  const rawCred = credential || pin

  if (!rawCred || !String(rawCred).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Inserisci il PIN o Token' })
  }

  const input = String(rawCred).trim()

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

  // If no PIN was configured for this participant, reconnect by PIN is not possible
  if (!participant.pin || !participant.pin.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nessun PIN impostato per questo profilo. Per accedere da un altro dispositivo, utilizza il tuo Link Personale o contatta l\'organizzatore.'
    })
  }

  let matched = false

  // 1. Direct secret token match
  if (participant.token && input === participant.token) {
    matched = true
  }

  // 2. PIN match (strict secure verification - phone number is NOT allowed for cross-device access)
  if (!matched && participant.pin && input === participant.pin.trim()) {
    matched = true
  }

  if (!matched) {
    recordFailedAttempt(event, `reconnect:${eventId}`, 15 * 60 * 1000)
    throw createError({
      statusCode: 401,
      statusMessage: 'PIN errato. Inserisci il codice PIN scelto al momento dell\'iscrizione.'
    })
  }

  resetRateLimit(event, `reconnect:${eventId}`)

  // Ensure participant has a token generated and persisted
  if (!participant.token) {
    participant.token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    await saveDb(db)
  }

  const { pin: _pin, ...safeParticipant } = participant

  return {
    success: true,
    participant: { ...safeParticipant, hasPin: Boolean(_pin) },
    token: participant.token
  }
})
