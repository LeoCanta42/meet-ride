import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'
import { calculateConvoyRouteWithGemini } from '../../../utils/convoy'

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
  const isOrganizer = Boolean(
    organizer && (organizer.id === foundEvent.organizerId || organizer.role === 'admin' || organizer.isAdmin === true)
  )

  if (!isOrganizer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo l\'organizzatore dell\'evento può calcolare l\'itinerario di gruppo e assegnare i posti con Gemini AI'
    })
  }

  const riders = db.participants.filter(p => p.eventId === foundEvent.id && p.role === 'rider')
  const passengers = db.participants.filter(p => p.eventId === foundEvent.id && p.role === 'passenger')

  if (riders.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nessun veicolo o guidatore presente per questo evento.'
    })
  }

  const plan = await calculateConvoyRouteWithGemini(foundEvent, riders, passengers)

  // Autonomously apply seat assignments to passengers in database
  if (Array.isArray(plan.passengerAssignments)) {
    for (const assignment of plan.passengerAssignments) {
      if (assignment.passengerId && assignment.assignedRiderId) {
        const p = db.participants.find(part => part.id === assignment.passengerId && part.eventId === foundEvent.id)
        const r = db.participants.find(part => part.id === assignment.assignedRiderId && part.eventId === foundEvent.id && part.role === 'rider')
        if (p && r) {
          p.assignedRiderId = r.id
        }
      }
    }
  }

  // Handle passengers that AI flagged as unassigned
  if (Array.isArray(plan.unassignedPassengers)) {
    for (const unassigned of plan.unassignedPassengers) {
      const p = db.participants.find(part => part.id === unassigned.passengerId && part.eventId === foundEvent.id)
      if (p) {
        p.assignedRiderId = null
      }
    }
  }

  foundEvent.routePlan = plan
  foundEvent.updatedAt = new Date().toISOString()
  await saveDb(db)

  return {
    success: true,
    routePlan: plan,
    assignedCount: plan.passengerAssignments?.length || 0
  }
})
