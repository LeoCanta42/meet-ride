import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { passengerId, token, riderId, asDriver } = body || {}

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento mancante' })
  }

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
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato' })
  }

  // Find passenger (prioritize explicit passengerId so secondary vehicles sharing a token don't shadow)
  const passenger = passengerId
    ? db.participants.find(p => p.eventId === foundEvent.id && p.id === passengerId)
    : db.participants.find(p => p.eventId === foundEvent.id && p.role === 'passenger' && token && p.token === token)

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

  // If this passenger was currently designated driver of any car, clear that assignment
  const previouslyDrivenCar = db.participants.find(
    p => p.eventId === foundEvent.id && p.role === 'rider' && p.driverParticipantId === passenger.id
  )
  if (previouslyDrivenCar && (previouslyDrivenCar.id !== riderId || !asDriver)) {
    previouslyDrivenCar.driverParticipantId = null
    previouslyDrivenCar.hasDriver = false
  }

  // If riderId is null, passenger wants to leave current car
  if (!riderId) {
    passenger.assignedRiderId = null
    foundEvent.routePlan = null
    await saveDb(db)
    return { success: true, assignedRiderId: null }
  }

  // Verify rider
  const rider = db.participants.find(p => p.id === riderId && p.eventId === foundEvent.id && p.role === 'rider')
  if (!rider) {
    throw createError({ statusCode: 404, statusMessage: 'Auto o guidatore non trovato' })
  }

  // If requested to assign as driver
  if (asDriver) {
    if (rider.driverParticipantId && rider.driverParticipantId !== passenger.id) {
      const oldDriver = db.participants.find(p => p.id === rider.driverParticipantId && p.eventId === foundEvent.id)
      if (oldDriver) {
        oldDriver.assignedRiderId = null
      }
    }
    rider.driverParticipantId = passenger.id
    rider.hasDriver = true
    passenger.assignedRiderId = rider.id
    foundEvent.routePlan = null
    await saveDb(db)
    return { success: true, assignedRiderId: rider.id, asDriver: true }
  }

  // Check capacity (excluding driver seat)
  const currentPassengers = db.participants.filter(
    p => p.eventId === foundEvent.id && p.assignedRiderId === rider.id && (!rider.driverParticipantId || p.id !== rider.driverParticipantId)
  )
  const totalSeats = rider.totalSeats || 4

  if (passenger.assignedRiderId !== rider.id && currentPassengers.length >= totalSeats) {
    throw createError({ statusCode: 400, statusMessage: 'Quest\'auto è già al completo' })
  }

  if (passenger.assignedRiderId !== rider.id) {
    foundEvent.routePlan = null
  }
  passenger.assignedRiderId = rider.id
  await saveDb(db)

  return { success: true, assignedRiderId: rider.id }
})
