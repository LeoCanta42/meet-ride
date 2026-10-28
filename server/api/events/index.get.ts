import { getDb } from '../../utils/db'
import { getAuthenticatedOrganizer } from '../../utils/auth'
import type { Participant } from '~/types'

export default defineEventHandler(async (event) => {
  const organizer = await getAuthenticatedOrganizer(event)
  if (!organizer) {
    return { events: [] }
  }

  const query = getQuery(event)
  const scope = String(query.scope || '').trim().toLowerCase()
  const isAdmin = organizer.role === 'admin' || organizer.isAdmin === true

  const db = await getDb()

  // Admin can view all platform events or filter by scope
  let organizerEvents = db.events
  if (!isAdmin || scope === 'mine') {
    organizerEvents = db.events.filter(e => e.organizerId === organizer.id)
  }

  // Attach participant and seat counts, plus creator info for admin
  const results = organizerEvents.map(ev => {
    const participants = db.participants.filter(p => p.eventId === ev.id)
    const riders = participants.filter(p => p.role === 'rider')
    const passengers = participants.filter(p => p.role === 'passenger')
    const totalSeats = riders.reduce((acc: number, r: Participant) => acc + (r.totalSeats || 0), 0)
    const occupiedSeats = passengers.filter(p => !!p.assignedRiderId).length
    const creator = db.organizers.find(o => o.id === ev.organizerId)

    return {
      ...ev,
      creatorName: creator?.name || null,
      creatorEmail: creator?.email || null,
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
