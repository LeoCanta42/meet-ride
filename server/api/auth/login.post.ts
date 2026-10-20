import { getDb, hashPassword } from '../../utils/db'
import { createOrganizerSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body || {}

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email e password sono richieste'
    })
  }

  const cleanEmail = email.trim().toLowerCase()
  const db = await getDb()
  const organizer = db.organizers.find(o => o.email.toLowerCase() === cleanEmail)

  if (!organizer || organizer.passwordHash !== hashPassword(password)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Credenziali non valide'
    })
  }

  const { passwordHash: _, ...safeUser } = organizer
  createOrganizerSession(event, safeUser)

  return { user: safeUser }
})
