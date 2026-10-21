import { getDb, saveDb, hashPassword, verifyPassword } from '../../utils/db'
import { createOrganizerSession, checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  checkRateLimit(event, 'login', 12, 15 * 60 * 1000)

  const body = await readBody(event)
  const { email, password } = body || {}

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email e password sono richieste'
    })
  }

  const cleanEmail = String(email).trim().toLowerCase()
  const rawPassword = String(password)

  const db = await getDb()
  const organizer = db.organizers.find(o => o.email.toLowerCase() === cleanEmail)

  if (!organizer || !verifyPassword(rawPassword, organizer.passwordHash)) {
    recordFailedAttempt(event, 'login', 15 * 60 * 1000)
    throw createError({
      statusCode: 401,
      statusMessage: 'Credenziali non valide'
    })
  }

  resetRateLimit(event, 'login')

  // Transparently upgrade legacy SHA-256 password hash to salted scrypt
  if (organizer.passwordHash && !organizer.passwordHash.startsWith('scrypt:')) {
    organizer.passwordHash = hashPassword(rawPassword)
    await saveDb(db)
  }

  const { passwordHash: _, ...safeUser } = organizer
  createOrganizerSession(event, safeUser)

  return { user: safeUser }
})
