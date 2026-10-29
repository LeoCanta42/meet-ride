import { getDb, saveDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { riderId, passengerId, action, token } = body || {}

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'ID evento mancante' })
  }
  if (!riderId) {
    throw createError({ statusCode: 400, statusMessage: 'ID vettura mancante' })
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

  const rider = db.participants.find(p => p.id === riderId && p.eventId === foundEvent.id && p.role === 'rider')
  if (!rider) {
    throw createError({ statusCode: 404, statusMessage: 'Vettura non trovata' })
  }

  // Action: unassign driver from this car
  if (action === 'unassign' || !passengerId) {
    const currentDriverId = rider.driverParticipantId
    if (currentDriverId) {
      const currentDriver = db.participants.find(p => p.id === currentDriverId && p.eventId === foundEvent.id)
      if (!isOrganizer && (!token || currentDriver?.token !== token)) {
        throw createError({ statusCode: 403, statusMessage: 'Non autorizzato a rimuovere l\'autista da questa vettura' })
      }
      if (currentDriver) {
        currentDriver.assignedRiderId = null
      }
    } else {
      // If car was originally created with a driver and caller wants to remove it
      if (!isOrganizer && (!token || rider.token !== token)) {
        throw createError({ statusCode: 403, statusMessage: 'Non autorizzato' })
      }
    }

    rider.driverParticipantId = null
    rider.hasDriver = false
    foundEvent.routePlan = null
    await saveDb(db)
    return { success: true, riderId: rider.id, hasDriver: false, driverParticipantId: null }
  }

  // Action: assign passenger as driver
  const passenger = db.participants.find(p => p.id === passengerId && p.eventId === foundEvent.id && p.role === 'passenger')
  if (!passenger) {
    throw createError({ statusCode: 404, statusMessage: 'Passeggero non trovato' })
  }

  if (!isOrganizer && (!token || passenger.token !== token)) {
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato ad assegnare questo passeggero come autista' })
  }

  // If passenger was currently driving another car in this event, free up that car
  const previouslyDrivenCar = db.participants.find(
    p => p.eventId === foundEvent.id && p.role === 'rider' && p.driverParticipantId === passenger.id && p.id !== rider.id
  )
  if (previouslyDrivenCar) {
    previouslyDrivenCar.driverParticipantId = null
    previouslyDrivenCar.hasDriver = false
  }

  // If this car already had a different driver participant, unseat them to waiting list
  if (rider.driverParticipantId && rider.driverParticipantId !== passenger.id) {
    const oldDriver = db.participants.find(p => p.id === rider.driverParticipantId && p.eventId === foundEvent.id)
    if (oldDriver) {
      oldDriver.assignedRiderId = null
    }
  }

  rider.driverParticipantId = passenger.id
  rider.hasDriver = true
  passenger.assignedRiderId = rider.id

  // If rider has no departure coords but passenger has pickup coords, adopt them
  if (!rider.departureCoords && passenger.pickupCoords) {
    rider.departureCoords = passenger.pickupCoords
  }
  if (!rider.departureLocation && passenger.pickupLocation) {
    rider.departureLocation = passenger.pickupLocation
  }

  foundEvent.routePlan = null
  await saveDb(db)

  return {
    success: true,
    riderId: rider.id,
    driverParticipantId: passenger.id,
    hasDriver: true
  }
})
