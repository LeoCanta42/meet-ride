import crypto from 'node:crypto'
import { getDb, saveDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'
import type { ManualMeetingPoint } from '~/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const organizer = await getAuthenticatedOrganizer(event)

  if (!organizer) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
  }

  const db = await getDb()
  const eventIndex = db.events.findIndex(e => e.id === id || e.slug === id)

  if (eventIndex === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato' })
  }

  const existingEvent = db.events[eventIndex]
  const isAdmin = organizer.role === 'admin' || organizer.isAdmin === true
  if (!existingEvent || (existingEvent.organizerId !== organizer.id && !isAdmin)) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi modificare questo evento' })
  }

  const body = await readBody(event)
  const { title, description, destination, destinationCoords, eventDate, arrivalTime, sharedPassword, routePlan, meetingPoints } = body || {}

  const newDestination = destination ? destination.trim() : existingEvent.destination
  const destinationChanged = newDestination.toLowerCase() !== (existingEvent.destination || '').trim().toLowerCase()

  let updatedMeetingPoints = existingEvent.meetingPoints || []
  if (Array.isArray(meetingPoints)) {
    const validRiderIds = new Set(
      db.participants
        .filter(p => p.eventId === existingEvent.id && p.role === 'rider')
        .map(p => p.id)
    )
    updatedMeetingPoints = meetingPoints
      .map((mp: any): ManualMeetingPoint => {
        const cleanName = String(mp?.name || '').trim()
        const prevMp = (existingEvent.meetingPoints || []).find(prev => prev.id === mp?.id)
        const nameChanged = !prevMp || prevMp.name.trim().toLowerCase() !== cleanName.toLowerCase()
        return {
          id: String(mp?.id || crypto.randomUUID()),
          name: cleanName,
          time: mp?.time ? String(mp.time).trim() : undefined,
          riderIds: Array.isArray(mp?.riderIds)
            ? Array.from(new Set(mp.riderIds.map(String).filter((rid: string) => validRiderIds.has(rid))))
            : [],
          coords: mp?.coords !== undefined ? mp.coords : (nameChanged ? null : prevMp?.coords || null),
          notes: mp?.notes ? String(mp.notes).trim() : undefined
        }
      })
      .filter(mp => mp.name && mp.riderIds.length >= 2)
  }

  const updated = {
    ...existingEvent,
    title: title ? title.trim() : existingEvent.title,
    description: description !== undefined ? description.trim() : existingEvent.description,
    destination: newDestination,
    destinationCoords: destinationCoords !== undefined
      ? destinationCoords
      : (destinationChanged ? null : existingEvent.destinationCoords),
    eventDate: eventDate ? new Date(eventDate).toISOString() : existingEvent.eventDate,
    arrivalTime: arrivalTime !== undefined ? (arrivalTime ? String(arrivalTime).trim() : null) : existingEvent.arrivalTime,
    sharedPassword: sharedPassword ? sharedPassword.trim() : existingEvent.sharedPassword,
    meetingPoints: updatedMeetingPoints,
    routePlan: routePlan !== undefined ? routePlan : existingEvent.routePlan,
    updatedAt: new Date().toISOString()
  }

  db.events[eventIndex] = updated

  await saveDb(db)
  return { event: updated }
})
