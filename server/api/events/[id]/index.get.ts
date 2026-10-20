import { getDb } from '../../../utils/db'
import { getAuthenticatedOrganizer, isEventUnlocked } from '../../../utils/auth'
import type { CarWithSeats, Participant } from '~/types'

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

  // Full data for unlocked guests or organizer
  const eventParticipants = db.participants.filter(p => p.eventId === foundEvent.id)
  const riders = eventParticipants.filter(p => p.role === 'rider')
  const passengers = eventParticipants.filter(p => p.role === 'passenger')

  const cars: CarWithSeats[] = riders.map(rider => {
    const carPassengers = passengers.filter(p => p.assignedRiderId === rider.id)
    const total = rider.totalSeats || 4
    const occupied = carPassengers.length
    return {
      rider,
      passengers: carPassengers,
      totalSeats: total,
      occupiedSeats: occupied,
      availableSeats: Math.max(0, total - occupied),
      isFull: occupied >= total
    }
  })

  const unassignedPassengers = passengers.filter(p => !p.assignedRiderId)

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
