import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'
import type { Participant, ParticipantRole } from '~/types'

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
    throw createError({ statusCode: 403, statusMessage: 'Inserisci la password dell\'evento' })
  }

  const body = await readBody(event)
  const {
    id: participantId,
    token: incomingToken,
    name,
    role,
    phone,
    notes,
    pickupLocation,
    pickupCoords,
    carModel,
    totalSeats,
    departureTime,
    departureLocation,
    departureCoords
  } = body || {}

  if (!name || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Il nome è obbligatorio' })
  }

  if (role !== 'rider' && role !== 'passenger') {
    throw createError({ statusCode: 400, statusMessage: 'Ruolo non valido' })
  }

  const token = incomingToken || Math.random().toString(36).substring(2) + Date.now().toString(36)
  const now = new Date().toISOString()

  let participantIndex = -1
  if (participantId) {
    participantIndex = db.participants.findIndex(p => p.id === participantId && p.eventId === foundEvent.id)
  } else if (incomingToken) {
    participantIndex = db.participants.findIndex(p => p.token === incomingToken && p.eventId === foundEvent.id)
  }

  const parsedSeats = role === 'rider' ? Math.max(1, Math.min(12, parseInt(totalSeats, 10) || 4)) : undefined

  let updatedOrCreated: Participant

  if (participantIndex >= 0 && db.participants[participantIndex]) {
    // Update existing participant
    const existing = db.participants[participantIndex]!
    // If role changed from rider to passenger, unassign any passengers who were seated in their car
    if (existing.role === 'rider' && role === 'passenger') {
      db.participants.forEach(p => {
        if (p.assignedRiderId === existing.id) {
          p.assignedRiderId = null
        }
      })
    }

    updatedOrCreated = {
      id: existing.id,
      eventId: existing.eventId,
      createdAt: existing.createdAt,
      name: name.trim(),
      role: role as ParticipantRole,
      phone: phone ? phone.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      pickupLocation: pickupLocation ? pickupLocation.trim() : undefined,
      pickupCoords: pickupCoords || null,
      carModel: role === 'rider' ? (carModel || 'Auto').trim() : undefined,
      totalSeats: parsedSeats,
      departureTime: role === 'rider' ? (departureTime || '').trim() : undefined,
      departureLocation: role === 'rider' ? (departureLocation || '').trim() : undefined,
      departureCoords: role === 'rider' ? departureCoords || null : null,
      token: existing.token || token
    }
    db.participants[participantIndex] = updatedOrCreated
  } else {
    // New participant
    const newId = 'p-' + Math.random().toString(36).substring(2, 10)
    updatedOrCreated = {
      id: newId,
      eventId: foundEvent.id,
      name: name.trim(),
      role: role as ParticipantRole,
      phone: phone ? phone.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      pickupLocation: pickupLocation ? pickupLocation.trim() : undefined,
      pickupCoords: pickupCoords || null,
      carModel: role === 'rider' ? (carModel || 'Auto').trim() : undefined,
      totalSeats: parsedSeats,
      departureTime: role === 'rider' ? (departureTime || '').trim() : undefined,
      departureLocation: role === 'rider' ? (departureLocation || '').trim() : undefined,
      departureCoords: role === 'rider' ? departureCoords || null : null,
      assignedRiderId: null,
      createdAt: now,
      token
    }
    db.participants.push(updatedOrCreated)
  }

  await saveDb(db)

  return {
    participant: updatedOrCreated,
    token: updatedOrCreated.token
  }
})
