import crypto from 'node:crypto'
import { getDb, saveDb, hashPassword } from '../../utils/db'
import { createOrganizerSession, checkRateLimit } from '../../utils/auth'
import { getSupabaseServerClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  checkRateLimit(event, 'register', 10, 15 * 60 * 1000)

  const body = await readBody(event)
  const { email, password, name } = body || {}

  if (!email || !password || !name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password e nome sono obbligatori'
    })
  }

  const cleanEmail = String(email).trim().toLowerCase()
  const cleanName = String(name).trim().slice(0, 100)
  const rawPassword = String(password)

  if (!cleanEmail.includes('@') || cleanEmail.length > 254) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Formato email non valido'
    })
  }

  if (rawPassword.length < 6 || rawPassword.length > 128) {
    throw createError({
      statusCode: 400,
      statusMessage: 'La password deve contenere almeno 6 caratteri'
    })
  }

  const db = await getDb()
  const exists = db.organizers.find(o => o.email.toLowerCase() === cleanEmail)
  if (exists) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Esiste già un account con questa email'
    })
  }

  const newOrganizer: {
    id: string
    email: string
    name: string
    passwordHash: string
    createdAt: string
  } = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: cleanName,
    passwordHash: hashPassword(rawPassword),
    createdAt: new Date().toISOString()
  }

  // If Supabase is configured, ensure direct insert/upsert succeeds immediately
  const supabase = getSupabaseServerClient()
  if (supabase) {
    const { data: inserted, error: insertError } = await supabase
      .from('organizers')
      .upsert(
        {
          id: newOrganizer.id,
          email: newOrganizer.email,
          name: newOrganizer.name,
          password_hash: newOrganizer.passwordHash,
          created_at: newOrganizer.createdAt
        },
        { onConflict: 'email' }
      )
      .select('id, email, name, password_hash, created_at')
      .single()

    if (insertError) {
      console.error('[Auth Register] Supabase insert error:', insertError.message)
      throw createError({
        statusCode: 500,
        statusMessage: `Errore nel salvataggio dell'account sul database: ${insertError.message}`
      })
    }

    if (inserted?.id) {
      newOrganizer.id = inserted.id
    }
  }

  db.organizers.push(newOrganizer)
  await saveDb(db)

  const { passwordHash: _, ...safeUser } = newOrganizer
  createOrganizerSession(event, safeUser)

  return { user: safeUser }
})
