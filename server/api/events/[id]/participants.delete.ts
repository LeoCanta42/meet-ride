import { getDb, deleteParticipantsFromDb } from '../../../utils/db'
import { isEventUnlocked, getAuthenticatedOrganizer } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { participantId, token } = body || {}

  if (!eventId || (!participantId && !token)) {
    throw createError({ statusCode: 400, statusMessage: 'Parametri mancanti' })
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

  const target = participantId
    ? db.participants.find(p => p.eventId === foundEvent.id && p.id === participantId)
    : db.participants.find(p => p.eventId === foundEvent.id && token && p.token === token)

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Partecipante non trovato' })
  }

  // Security check: only the event organizer/admin or the participant (or owner of secondary car) with matching token can delete
  const owner = target.ownerParticipantId
    ? db.participants.find(p => p.id === target.ownerParticipantId && p.eventId === foundEvent.id)
    : null
  const isTokenOwner = Boolean(token && (target.token === token || (owner && owner.token === token)))
  if (!isOrganizer && !isTokenOwner) {
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato a rimuovere questo partecipante' })
  }

  const idsToDelete: string[] = [target.id]

  // If this participant was a driver of any car, reset that car to driverless
  db.participants.forEach(p => {
    if (p.eventId === foundEvent.id && p.driverParticipantId === target.id) {
      p.driverParticipantId = null
      p.hasDriver = false
    }
  })

  // If this participant was a rider, unassign passengers in their car
  if (target.role === 'rider') {
    db.participants.forEach(p => {
      if (p.assignedRiderId === target.id) {
        p.assignedRiderId = null
      }
    })
  }

  // If the target is a primary participant (no ownerParticipantId), also clean up any hosted cars owned by them
  if (!target.ownerParticipantId) {
    const ownedCars = db.participants.filter(p => p.ownerParticipantId === target.id && p.eventId === foundEvent.id)
    for (const car of ownedCars) {
      idsToDelete.push(car.id)
      db.participants.forEach(p => {
        if (p.assignedRiderId === car.id) {
          p.assignedRiderId = null
        }
      })
    }
  }

  // Clean up any deleted rider IDs from manual meetingPoints
  if (Array.isArray(foundEvent.meetingPoints) && foundEvent.meetingPoints.length > 0) {
    const deletedSet = new Set(idsToDelete)
    let remainingMps = foundEvent.meetingPoints
      .map(mp => ({
        ...mp,
        riderIds: (mp.riderIds || []).filter(rid => !deletedSet.has(rid))
      }))
      .filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)

    // Clean up meetingPointIds pointing to removed meeting points
    const remainingIds = new Set(remainingMps.map(m => m.id))
    foundEvent.meetingPoints = remainingMps
      .map(mp => ({
        ...mp,
        meetingPointIds: (mp.meetingPointIds || []).filter(mid => remainingIds.has(mid))
      }))
      .filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)
  }

  // Clear outdated routePlan when participants are removed
  foundEvent.routePlan = null
  foundEvent.updatedAt = new Date().toISOString()

  await deleteParticipantsFromDb(idsToDelete, db)

  return { success: true }
})
