import crypto from 'node:crypto'
import { getDb, saveDb, hashPassword } from '../../utils/db'
import { createOrganizerSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name } = body || {}

  if (!email || !password || !name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email, password e nome sono obbligatori'
    })
  }

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail.includes('@')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Formato email non valido'
    })
  }

  if (password.length < 6) {
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

  const newOrganizer = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  }

  db.organizers.push(newOrganizer)
  await saveDb(db)

  const { passwordHash: _, ...safeUser } = newOrganizer
  createOrganizerSession(event, safeUser)

  return { user: safeUser }
})
