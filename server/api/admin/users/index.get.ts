import { getDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const current = await getAuthenticatedOrganizer(event)
  if (!current || (!current.isAdmin && current.role !== 'admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accesso riservato all\'amministratore'
    })
  }

  const db = await getDb()

  const users = db.organizers.map(o => {
    const isAdmin = o.role === 'admin' || o.isAdmin === true
    const isApproved = isAdmin || o.isApproved === true
    const eventsCount = db.events.filter(e => e.organizerId === o.id).length

    return {
      id: o.id,
      email: o.email,
      name: o.name,
      role: isAdmin ? ('admin' as const) : ('organizer' as const),
      isAdmin,
      isApproved,
      createdAt: o.createdAt,
      eventsCount
    }
  })

  // Sort by created_at descending (newest registrations first)
  users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { users }
})
