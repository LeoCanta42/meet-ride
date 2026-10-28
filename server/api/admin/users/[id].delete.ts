import { getDb, saveDb, deleteEventFromDb } from '../../../utils/db'
import { getAuthenticatedOrganizer } from '../../../utils/auth'
import { getSupabaseServerClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const current = await getAuthenticatedOrganizer(event)
  if (!current || (!current.isAdmin && current.role !== 'admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accesso riservato all\'amministratore'
    })
  }

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'ID utente mancante' })
  }

  if (targetId === current.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Non puoi eliminare il tuo stesso account amministratore'
    })
  }

  const db = await getDb()
  const idx = db.organizers.findIndex(o => o.id === targetId)
  if (idx === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Utente non trovato' })
  }

  // Also remove all events created by this user
  const userEvents = db.events.filter(e => e.organizerId === targetId)
  for (const ev of userEvents) {
    await deleteEventFromDb(ev.id, db)
  }

  // Remove from organizers array
  db.organizers.splice(idx, 1)

  // Direct delete from Supabase if available
  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      await supabase.from('organizers').delete().eq('id', targetId)
    } catch (err: any) {
      console.warn('[Admin API] Supabase delete error:', err?.message || err)
    }
  }

  await saveDb(db)

  return { success: true }
})
