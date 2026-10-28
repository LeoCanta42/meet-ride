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

  // Security check: only the event organizer or the participant with the matching secret token can delete
  if (!isOrganizer && (!token || target.token !== token)) {
    throw createError({ statusCode: 403, statusMessage: 'Non autorizzato a rimuovere questo partecipante' })
  }

  const idsToDelete: string[] = [target.id]

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

  await deleteParticipantsFromDb(idsToDelete, db)

  return { success: true }
})
