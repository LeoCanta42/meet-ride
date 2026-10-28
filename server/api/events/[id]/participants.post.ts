import crypto from 'node:crypto'
import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer, generateSecureToken } from '../../../utils/auth'
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
    pin,
    notes,
    pickupLocation,
    pickupCoords,
    carModel,
    totalSeats,
    price,
    departureTime,
    departureLocation,
    departureCoords,
    hasDriver,
    ownerParticipantId,
    isAdditionalCar,
    isOrganizerAction
  } = body || {}

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : ''
  if (!cleanName) {
    throw createError({ statusCode: 400, statusMessage: 'Il nome è obbligatorio' })
  }

  if (role !== 'rider' && role !== 'passenger') {
    throw createError({ statusCode: 400, statusMessage: 'Ruolo non valido' })
  }

  // Location validation: mandatory for both rider and passenger
  let cleanDepartureLocation = ''
  let cleanPickupLocation = ''

  if (role === 'rider') {
    cleanDepartureLocation = typeof departureLocation === 'string' ? departureLocation.trim().slice(0, 150) : ''
    if (!cleanDepartureLocation) {
      throw createError({ statusCode: 400, statusMessage: 'Il luogo di partenza è obbligatorio per i guidatori' })
    }
  } else if (role === 'passenger') {
    cleanPickupLocation = typeof pickupLocation === 'string' ? pickupLocation.trim().slice(0, 150) : ''
    if (!cleanPickupLocation) {
      throw createError({ statusCode: 400, statusMessage: 'Il luogo di ritrovo/partenza è obbligatorio per i passeggeri' })
    }
  }

  // If this is an organizer creating on behalf of another user, generate an independent token
  const token = (isOrganizer && isOrganizerAction && !participantId)
    ? generateSecureToken(16)
    : ((typeof incomingToken === 'string' && incomingToken.trim()) ? incomingToken.trim() : generateSecureToken(16))
  const now = new Date().toISOString()

  let participantIndex = -1
  if (participantId) {
    participantIndex = db.participants.findIndex(p => p.id === participantId && p.eventId === foundEvent.id)
    if (participantIndex >= 0) {
      const target = db.participants[participantIndex]!
      if (!isOrganizer && target.token && target.token !== incomingToken) {
        throw createError({ statusCode: 403, statusMessage: 'Non autorizzato a modificare questo partecipante' })
      }
    }
  } else if (!isOrganizerAction && incomingToken && !isAdditionalCar && !ownerParticipantId) {
    participantIndex = db.participants.findIndex(p => p.token === incomingToken && p.eventId === foundEvent.id)
  }

  const parsedSeats = role === 'rider' ? Math.max(1, Math.min(12, parseInt(totalSeats, 10) || 4)) : undefined
  let parsedPrice: number | null = null
  if (role === 'rider' && price !== undefined && price !== null && price !== '') {
    const numPrice = Number(price)
    if (!Number.isNaN(numPrice) && numPrice >= 0) {
      parsedPrice = Math.round(Math.min(10000, numPrice) * 100) / 100
    }
  }

  const resolvedHasDriver = role === 'rider' ? (hasDriver !== false) : true
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

    // Preserve existing PIN if the user did not enter a new PIN during edit
    const resolvedPin =
      typeof pin === 'string' && pin.trim().length > 0
        ? pin.trim().slice(0, 20)
        : existing.pin

    updatedOrCreated = {
      id: existing.id,
      eventId: existing.eventId,
      createdAt: existing.createdAt,
      name: cleanName,
      role: role as ParticipantRole,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : undefined,
      pin: resolvedPin,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 300) : undefined,
      pickupLocation: role === 'passenger' ? cleanPickupLocation : undefined,
      pickupCoords: pickupCoords || null,
      carModel: role === 'rider' ? (typeof carModel === 'string' && carModel.trim() ? carModel.trim().slice(0, 80) : 'Auto') : undefined,
      totalSeats: parsedSeats,
      price: role === 'rider' ? parsedPrice : null,
      departureTime: role === 'rider' ? (typeof departureTime === 'string' && departureTime.trim() ? departureTime.trim().slice(0, 40) : undefined) : undefined,
      departureLocation: role === 'rider' ? cleanDepartureLocation : undefined,
      departureCoords: role === 'rider' ? departureCoords || null : null,
      hasDriver: resolvedHasDriver,
      ownerParticipantId: ownerParticipantId || existing.ownerParticipantId || null,
      assignedRiderId: role === 'passenger' ? (existing.assignedRiderId || null) : null,
      token: existing.token || token
    }
    db.participants[participantIndex] = updatedOrCreated
  } else {
    // New participant
    const newId = crypto.randomUUID()
    updatedOrCreated = {
      id: newId,
      eventId: foundEvent.id,
      name: cleanName,
      role: role as ParticipantRole,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : undefined,
      pin: typeof pin === 'string' && pin.trim() ? pin.trim().slice(0, 20) : undefined,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 300) : undefined,
      pickupLocation: role === 'passenger' ? cleanPickupLocation : undefined,
      pickupCoords: pickupCoords || null,
      carModel: role === 'rider' ? (typeof carModel === 'string' && carModel.trim() ? carModel.trim().slice(0, 80) : 'Auto') : undefined,
      totalSeats: parsedSeats,
      price: role === 'rider' ? parsedPrice : null,
      departureTime: role === 'rider' ? (typeof departureTime === 'string' && departureTime.trim() ? departureTime.trim().slice(0, 40) : undefined) : undefined,
      departureLocation: role === 'rider' ? cleanDepartureLocation : undefined,
      departureCoords: role === 'rider' ? departureCoords || null : null,
      hasDriver: resolvedHasDriver,
      ownerParticipantId: ownerParticipantId || null,
      assignedRiderId: null,
      createdAt: now,
      token
    }
    db.participants.push(updatedOrCreated)
  }

  await saveDb(db)

  const { pin: _pin, ...safeParticipant } = updatedOrCreated
  return {
    participant: {
      ...safeParticipant,
      hasPin: Boolean(_pin)
    },
    token: updatedOrCreated.token
  }
})
