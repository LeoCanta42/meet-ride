import { getDb, saveDb } from '../../../utils/db'
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

  const db = await getDb()
  const target = db.organizers.find(o => o.id === targetId)

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Utente non trovato' })
  }

  const body = await readBody(event)
  const { isApproved, role } = body || {}

  // Prevent modifying caller's own admin role or approval to prevent accidental lockout
  if (target.id === current.id) {
    if (isApproved === false || (role && role !== 'admin')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Non puoi revocare la tua stessa approvazione o il tuo ruolo di amministratore'
      })
    }
  }

  if (typeof isApproved === 'boolean') {
    target.isApproved = isApproved
  }

  if (role === 'admin' || role === 'organizer') {
    target.role = role
    target.isAdmin = role === 'admin'
    if (role === 'admin') {
      target.isApproved = true
    }
  }

  // Update Supabase directly if configured
  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      await supabase
        .from('organizers')
        .update({
          role: target.role,
          is_approved: target.isApproved
        })
        .eq('id', target.id)
    } catch (err: any) {
      console.warn('[Admin API] Supabase update error:', err?.message || err)
    }
  }

  await saveDb(db)

  const { passwordHash: _, ...safeUser } = target
  return {
    success: true,
    user: safeUser
  }
})
