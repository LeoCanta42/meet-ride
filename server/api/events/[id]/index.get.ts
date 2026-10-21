import { getDb } from '../../../utils/db'
import { getAuthenticatedOrganizer, isEventUnlocked } from '../../../utils/auth'
import type { CarWithSeats, Participant } from '~/types'

function sanitizeParticipantForClient(p: Participant, callerTokens: Set<string>): Participant {
  const isOwner = Boolean(p.token && callerTokens.has(p.token))
  const { pin, token, ...rest } = p
  return {
    ...rest,
    hasPin: Boolean(pin),
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
  const isOrganizer = organizer?.id === foundEvent.organizerId
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
      typeof query.token === 'string' ? query.token : ''
    ]
      .map(s => s.trim())
      .filter(Boolean)
  )

  // Full data for unlocked guests or organizer
  const eventParticipants = db.participants.filter(p => p.eventId === foundEvent.id)
  const riders = eventParticipants.filter(p => p.role === 'rider')
  const passengers = eventParticipants.filter(p => p.role === 'passenger')

  const cars: CarWithSeats[] = riders.map(rider => {
    const carPassengers = passengers
      .filter(p => p.assignedRiderId === rider.id)
      .map(p => sanitizeParticipantForClient(p, callerTokens))
    const total = rider.totalSeats || 4
    const occupied = carPassengers.length
    const peopleCount = 1 + occupied // Driver + seated passengers currently in the car
    const totalPrice = typeof rider.price === 'number' && rider.price > 0 ? rider.price : null
    const pricePerPerson = totalPrice !== null ? Math.round((totalPrice / peopleCount) * 100) / 100 : null
    const pricePerPersonFull = totalPrice !== null ? Math.round((totalPrice / (1 + total)) * 100) / 100 : null

    return {
      rider: sanitizeParticipantForClient(rider, callerTokens),
      passengers: carPassengers,
      totalSeats: total,
      occupiedSeats: occupied,
      availableSeats: Math.max(0, total - occupied),
      isFull: occupied >= total,
      totalPrice,
      peopleCount,
      pricePerPerson,
      pricePerPersonFull
    }
  })

  const unassignedPassengers = passengers
    .filter(p => !p.assignedRiderId)
    .map(p => sanitizeParticipantForClient(p, callerTokens))

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
    totalRiders: riders.length,
    totalPassengers: passengers.length
  }
})
