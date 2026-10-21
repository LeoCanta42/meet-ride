import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import type { OrganizerUser } from '~/types'
import { getDb } from './db'

const ORGANIZER_COOKIE_NAME = 'meetride_organizer_session'

interface SessionTokenData {
  userId: string
  email: string
  expiresAt: number
}

const activeSessions = new Map<string, SessionTokenData>()

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NUXT_PUBLIC_SUPABASE_KEY ||
    'meet_ride_hmac_secret_key_2026_v2'
  )
}

function signPayload(payloadStr: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(payloadStr).digest('base64url')
}

function verifySignature(payloadStr: string, signature: string): boolean {
  const expected = signPayload(payloadStr)
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function generateSecureToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function createOrganizerSession(event: H3Event, user: OrganizerUser): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  const sessionData: SessionTokenData = {
    userId: user.id,
    email: user.email.trim().toLowerCase(),
    expiresAt
  }

  const encodedPayload = Buffer.from(JSON.stringify(sessionData), 'utf8').toString('base64url')
  const signature = signPayload(encodedPayload)
  const token = `${encodedPayload}.${signature}`

  activeSessions.set(token, sessionData)

  setCookie(event, ORGANIZER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60,
    path: '/'
  })

  return token
}

export async function getAuthenticatedOrganizer(event: H3Event): Promise<OrganizerUser | null> {
  const token = getCookie(event, ORGANIZER_COOKIE_NAME) || getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token) return null

  let session: SessionTokenData | null = activeSessions.get(token) || null

  if (!session && token.includes('.')) {
    const [encodedPayload, signature] = token.split('.')
    if (encodedPayload && signature && verifySignature(encodedPayload, signature)) {
      try {
        const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
        if (parsed && typeof parsed.userId === 'string' && typeof parsed.expiresAt === 'number') {
          session = parsed as SessionTokenData
        }
      } catch {
        session = null
      }
    }
  }

  if (!session || session.expiresAt < Date.now()) {
    return null
  }

  const db = await getDb()
  const found = db.organizers.find(
    o => o.id === session.userId || (session.email && o.email.toLowerCase() === session.email.toLowerCase())
  )
  if (!found) return null

  const { passwordHash: _, ...safeUser } = found
  return safeUser
}

export function clearOrganizerSession(event: H3Event): void {
  const token = getCookie(event, ORGANIZER_COOKIE_NAME)
  if (token) {
    activeSessions.delete(token)
  }
  deleteCookie(event, ORGANIZER_COOKIE_NAME, { path: '/' })
}

// Event unlocked session token (HMAC-signed so it cannot be forged in client cookies)
export function setEventUnlocked(event: H3Event, eventId: string): void {
  const payload = `unlocked:${eventId}`
  const sig = signPayload(payload)
  setCookie(event, `mr_unlocked_${eventId}`, `1.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  })
}

export function isEventUnlocked(event: H3Event, eventId: string): boolean {
  const val = getCookie(event, `mr_unlocked_${eventId}`)
  if (!val) return false
  if (val.startsWith('1.')) {
    const sig = val.slice(2)
    return verifySignature(`unlocked:${eventId}`, sig)
  }
  return false
}

// Lightweight brute-force protection for auth, event unlock, and PIN reconnect
interface RateLimitEntry {
  attempts: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export function getClientKey(event: H3Event, scope: string): string {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  return `${scope}:${ip}`
}

export function checkRateLimit(event: H3Event, scope: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): void {
  const key = getClientKey(event, scope)
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (entry) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
      return
    }
    if (entry.attempts >= maxAttempts) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Troppi tentativi falliti. Riprova tra qualche minuto.'
      })
    }
  }
}

export function recordFailedAttempt(event: H3Event, scope: string, windowMs = 15 * 60 * 1000): void {
  const key = getClientKey(event, scope)
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { attempts: 1, resetAt: now + windowMs })
  } else {
    entry.attempts += 1
  }
}

export function resetRateLimit(event: H3Event, scope: string): void {
  const key = getClientKey(event, scope)
  rateLimitMap.delete(key)
}
