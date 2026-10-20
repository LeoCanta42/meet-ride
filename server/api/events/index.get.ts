import { getDb } from '../../utils/db'
import { getAuthenticatedOrganizer } from '../../utils/auth'
import type { Participant } from '~/types'

export default defineEventHandler(async (event) => {
  const organizer = await getAuthenticatedOrganizer(event)
  if (!organizer) {
    return { events: [] }
  }

  const db = await getDb()
  const organizerEvents = db.events.filter(e => e.organizerId === organizer.id)

  // Attach participant and seat counts
  const results = organizerEvents.map(ev => {
    const participants = db.participants.filter(p => p.eventId === ev.id)
    const riders = participants.filter(p => p.role === 'rider')
    const passengers = participants.filter(p => p.role === 'passenger')
    const totalSeats = riders.reduce((acc: number, r: Participant) => acc + (r.totalSeats || 0), 0)
    const occupiedSeats = passengers.filter(p => !!p.assignedRiderId).length

    return {
      ...ev,
      stats: {
        ridersCount: riders.length,
        passengersCount: passengers.length,
        totalSeats,
        occupiedSeats,
        availableSeats: Math.max(0, totalSeats - occupiedSeats)
      }
    }
  })

  return { events: results }
})
