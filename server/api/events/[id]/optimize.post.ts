import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'
import { optimizeSeatAllocationWithGemini } from '../../../utils/optimizer'
import type { Participant, OptimizationSuggestion } from '~/types'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))
  const apply = !!body?.apply
  const providedSuggestions: OptimizationSuggestion[] | undefined = Array.isArray(body?.suggestions)
    ? body.suggestions
    : undefined

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
      statusMessage: 'Solo l\'organizzatore dell\'evento può utilizzare l\'ottimizzatore AI'
    })
  }

  const eventParticipants = db.participants.filter(p => p.eventId === foundEvent.id)
  const riders = eventParticipants.filter(p => p.role === 'rider')
  const passengers = eventParticipants.filter(p => p.role === 'passenger')

  // If applying already-previewed suggestions, apply them directly without a second AI call
  if (apply && providedSuggestions && providedSuggestions.length > 0) {
    const carSeatCount = new Map<string, number>()

    // Reset all event passengers first so the new distribution is applied cleanly
    for (const p of passengers) {
      p.assignedRiderId = null
    }

    let appliedCount = 0
    for (const suggestion of providedSuggestions) {
      const passenger = db.participants.find(
        (p: Participant) => p.id === suggestion.passengerId && p.eventId === foundEvent.id && p.role === 'passenger'
      )
      const rider = db.participants.find(
        (r: Participant) => r.id === suggestion.suggestedRiderId && r.eventId === foundEvent.id && r.role === 'rider'
      )
      if (passenger && rider) {
        const used = carSeatCount.get(rider.id) || 0
        const maxSeats = rider.totalSeats || 4
        if (used < maxSeats) {
          carSeatCount.set(rider.id, used + 1)
          passenger.assignedRiderId = rider.id
          appliedCount++
        }
      }
    }

    // Clear outdated routePlan when passenger distribution changes
    foundEvent.routePlan = null
    foundEvent.updatedAt = new Date().toISOString()
    await saveDb(db)

    return {
      suggestions: providedSuggestions,
      totalMoved: appliedCount,
      summary: `${appliedCount} passeggeri assegnati alle auto con successo.`,
      unassignedRemaining: passengers.filter(p => !p.assignedRiderId).length,
      applied: true
    }
  }

  // Execute Gemini AI Optimization
  const result = await optimizeSeatAllocationWithGemini(foundEvent, riders, passengers)

  if (apply && result.suggestions.length > 0) {
    const carSeatCount = new Map<string, number>()
    for (const p of passengers) {
      p.assignedRiderId = null
    }
    for (const suggestion of result.suggestions) {
      const passenger = db.participants.find(
        (p: Participant) => p.id === suggestion.passengerId && p.eventId === foundEvent.id && p.role === 'passenger'
      )
      const rider = db.participants.find(
        (r: Participant) => r.id === suggestion.suggestedRiderId && r.eventId === foundEvent.id && r.role === 'rider'
      )
      if (passenger && rider) {
        const used = carSeatCount.get(rider.id) || 0
        const maxSeats = rider.totalSeats || 4
        if (used < maxSeats) {
          carSeatCount.set(rider.id, used + 1)
          passenger.assignedRiderId = rider.id
        }
      }
    }
    foundEvent.routePlan = null
    foundEvent.updatedAt = new Date().toISOString()
    await saveDb(db)
  } else {
    // Persist any geocoded coordinates discovered during optimization
    await saveDb(db)
  }

  return {
    ...result,
    applied: apply
  }
})
