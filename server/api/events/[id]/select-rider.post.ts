import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { passengerId, token, riderId } = body || {}

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
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato' })
  }

  // Find passenger
  const passenger = db.participants.find(p =>
    p.eventId === foundEvent.id &&
    ((passengerId && p.id === passengerId) || (token && p.token === token))
  )

  if (!passenger) {
    throw createError({ statusCode: 404, statusMessage: 'Passeggero non trovato' })
  }

  // Security check: only organizer or passenger with matching token can change their car assignment
  if (!isOrganizer && (!token || passenger.token !== token)) {
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato a modificare il posto di questo passeggero' })
  }

  if (passenger.role !== 'passenger') {
    throw createError({ statusCode: 400, statusMessage: 'Solo i passeggeri possono selezionare un guidatore' })
  }

  // If riderId is null, passenger wants to leave current car
  if (!riderId) {
    passenger.assignedRiderId = null
    await saveDb(db)
    return { success: true, assignedRiderId: null }
  }

  // Verify rider
  const rider = db.participants.find(p => p.id === riderId && p.eventId === foundEvent.id && p.role === 'rider')
  if (!rider) {
    throw createError({ statusCode: 404, statusMessage: 'Auto o guidatore non trovato' })
  }

  // Check capacity
  const currentPassengers = db.participants.filter(p => p.eventId === foundEvent.id && p.assignedRiderId === rider.id)
  const totalSeats = rider.totalSeats || 4

  if (passenger.assignedRiderId !== rider.id && currentPassengers.length >= totalSeats) {
    throw createError({ statusCode: 400, statusMessage: 'Quest\'auto è già al completo' })
  }

  passenger.assignedRiderId = rider.id
  await saveDb(db)

  return { success: true, assignedRiderId: rider.id }
})
