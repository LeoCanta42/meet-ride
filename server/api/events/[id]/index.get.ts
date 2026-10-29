import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer, isEventUnlocked } from '../../../utils/auth'
import { geocodePlaceName } from '../../../utils/convoy'
import type { CarWithSeats, Participant } from '~/types'

function sanitizeParticipantForClient(
  p: Participant,
  callerTokens: Set<string>,
  myParticipantId?: string | null
): Participant {
  const isOwner = Boolean(
    (p.token && callerTokens.has(p.token)) ||
    (myParticipantId && p.ownerParticipantId === myParticipantId)
  )
  const { pin, token, ...rest } = p
  return {
    ...rest,
    hasPin: Boolean(pin),
    pin: isOwner ? pin : undefined,
    token: isOwner ? token : undefined
  }
}

export default defineEventHandler(async (event) => {
  const idOrSlug = getRouterParam(event, 'id')
  if (!idOrSlug) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento non fornito' })
  }

  const db = await getDb()
  const foundEvent = db.events.find(e => e.id === idOrSlug || e.slug === idOrSlug)

  if (!foundEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const organizer = await getAuthenticatedOrganizer(event)
  const isOrganizer = Boolean(
    organizer && (organizer.id === foundEvent.organizerId || organizer.role === 'admin' || organizer.isAdmin === true)
  )
  const unlocked = isOrganizer || isEventUnlocked(event, foundEvent.id)

  // If locked, return minimal public info so the client can show the password gate
  if (!unlocked) {
    return {
      event: {
        id: foundEvent.id,
        slug: foundEvent.slug,
        title: foundEvent.title,
        destination: foundEvent.destination,
        eventDate: foundEvent.eventDate,
        hasPassword: true
      },
      isUnlocked: false,
      isOrganizer: false
    }
  }

  const query = getQuery(event)
  const rawHeaderTokens = getHeader(event, 'x-participant-token') || ''
  const callerTokens = new Set<string>(
    [
      ...rawHeaderTokens.split(','),
      typeof query.p === 'string' ? query.p : '',
      typeof query.token === 'string' ? query.token : '',
      typeof query.myToken === 'string' ? query.myToken : ''
    ]
      .map(s => s.trim())
      .filter(Boolean)
  )

  // Full data for unlocked guests or organizer
  let dbUpdated = false
  if (!foundEvent.destinationCoords && foundEvent.destination) {
    foundEvent.destinationCoords = await geocodePlaceName(foundEvent.destination)
    if (foundEvent.destinationCoords) dbUpdated = true
  }

  const eventParticipants = db.participants.filter(p => p.eventId === foundEvent.id)
  for (const p of eventParticipants) {
    if (p.role === 'rider' && !p.departureCoords && p.departureLocation) {
      p.departureCoords = await geocodePlaceName(p.departureLocation, foundEvent.destination)
      if (p.departureCoords) dbUpdated = true
    }
  }

  if (dbUpdated) {
    await saveDb(db)
  }

  const myParticipantRaw =
    eventParticipants.find(p => p.token && callerTokens.has(p.token) && !p.ownerParticipantId) ||
    eventParticipants.find(p => p.token && callerTokens.has(p.token)) ||
    null

  const riders = eventParticipants.filter(p => p.role === 'rider')
  const passengers = eventParticipants.filter(p => p.role === 'passenger')

  const cars: CarWithSeats[] = riders.map(rider => {
    // Resolve designated driver if this car has a passenger assigned as driver
    const designatedDriver = rider.driverParticipantId
      ? (passengers.find(p => p.id === rider.driverParticipantId) || db.participants.find(p => p.id === rider.driverParticipantId) || null)
      : null

    // Effective driver: either designated driver or rider if car originally has driver
    const effectiveDriver = designatedDriver || (rider.hasDriver !== false ? rider : null)
    const hasDriver = Boolean(designatedDriver || rider.hasDriver !== false)

    // Passenger seats exclude any passenger who took the driver role
    const carPassengers = passengers
      .filter(p => p.assignedRiderId === rider.id && (!rider.driverParticipantId || p.id !== rider.driverParticipantId))
      .map(p => sanitizeParticipantForClient(p, callerTokens, myParticipantRaw?.id))

    const total = rider.totalSeats || 4
    const occupied = carPassengers.length
    const peopleCount = (hasDriver ? 1 : 0) + occupied
    const totalPrice = typeof rider.price === 'number' && rider.price > 0 ? rider.price : null
    const pricePerPerson = totalPrice !== null && peopleCount > 0 ? Math.round((totalPrice / peopleCount) * 100) / 100 : null
    const pricePerPersonFull = totalPrice !== null ? Math.round((totalPrice / ((hasDriver ? 1 : 0) + total)) * 100) / 100 : null

    return {
      rider: sanitizeParticipantForClient(rider, callerTokens, myParticipantRaw?.id),
      passengers: carPassengers,
      driver: effectiveDriver ? sanitizeParticipantForClient(effectiveDriver, callerTokens, myParticipantRaw?.id) : null,
      totalSeats: total,
      occupiedSeats: occupied,
      availableSeats: Math.max(0, total - occupied),
      isFull: occupied >= total,
      totalPrice,
      peopleCount,
      pricePerPerson,
      pricePerPersonFull,
      hasDriver
    }
  })

  const unassignedPassengers = passengers
    .filter(p => !p.assignedRiderId)
    .map(p => sanitizeParticipantForClient(p, callerTokens, myParticipantRaw?.id))

  // Omit plaintext sharedPassword if viewer is not the organizer
  const safeEvent = {
    ...foundEvent,
    sharedPassword: isOrganizer ? foundEvent.sharedPassword : '***'
  }

  return {
    event: safeEvent,
    isUnlocked: true,
    isOrganizer,
    cars,
    unassignedPassengers,
    myParticipant: myParticipantRaw ? sanitizeParticipantForClient(myParticipantRaw, callerTokens, myParticipantRaw.id) : null,
    totalRiders: riders.length,
    totalPassengers: passengers.length
  }
})
