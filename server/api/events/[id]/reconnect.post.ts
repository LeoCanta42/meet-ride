import { getDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

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
  const isOrganizer = organizer?.id === foundEvent.organizerId
  const unlocked = isOrganizer || isEventUnlocked(event, foundEvent.id)

  if (!unlocked) {
    throw createError({ statusCode: 403, statusMessage: 'Inserisci la password dell\'evento per accedere' })
  }

  const body = await readBody(event).catch(() => ({}))
  const { participantId, credential } = body || {}

  if (!participantId || !credential || !credential.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Seleziona il partecipante e inserisci Telefono, PIN o Token' })
  }

  const participant = db.participants.find(p => p.id === participantId && p.eventId === foundEvent.id)
  if (!participant) {
    throw createError({ statusCode: 404, statusMessage: 'Partecipante non trovato in questo evento' })
  }

  const input = credential.trim()
  const inputDigits = input.replace(/\D/g, '')

  let matched = false

  // 1. Direct secret token match
  if (participant.token && input === participant.token) {
    matched = true
  }

  // 2. 4-digit PIN match
  if (!matched && participant.pin && input === participant.pin.trim()) {
    matched = true
  }

  // 3. Phone number match (comparing digits, ignoring spaces, dashes, country code prefix)
  if (!matched && participant.phone && inputDigits.length >= 4) {
    const phoneDigits = participant.phone.replace(/\D/g, '')
    if (
      phoneDigits === inputDigits ||
      phoneDigits.endsWith(inputDigits) ||
      inputDigits.endsWith(phoneDigits)
    ) {
      matched = true
    }
  }

  if (!matched) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Telefono o PIN errato. Verifica i dati inseriti al momento dell\'iscrizione.'
    })
  }

  return {
    success: true,
    participant,
    token: participant.token
  }
})
