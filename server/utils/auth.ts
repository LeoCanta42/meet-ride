import type { H3Event } from 'h3'
import type { OrganizerUser } from '~/types'
import { getDb } from './db'

const ORGANIZER_COOKIE_NAME = 'meetride_organizer_session'

// Simple token storage
interface SessionTokenData {
  userId: string
  expiresAt: number
}

const activeSessions = new Map<string, SessionTokenData>()

export function createOrganizerSession(event: H3Event, user: OrganizerUser): string {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

  activeSessions.set(token, {
    userId: user.id,
    expiresAt
  })

  setCookie(event, ORGANIZER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/'
  })

  return token
}

export async function getAuthenticatedOrganizer(event: H3Event): Promise<OrganizerUser | null> {
  const token = getCookie(event, ORGANIZER_COOKIE_NAME) || getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token) return null

  const session = activeSessions.get(token)
  if (!session || session.expiresAt < Date.now()) {
    return null
  }

  const db = await getDb()
  const found = db.organizers.find(o => o.id === session.userId)
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

// Event unlocked session token:
// For guests entering the shared password
export function setEventUnlocked(event: H3Event, eventId: string): void {
  setCookie(event, `mr_unlocked_${eventId}`, '1', {
    maxAge: 7 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/'
  })
}

export function isEventUnlocked(event: H3Event, eventId: string): boolean {
  return getCookie(event, `mr_unlocked_${eventId}`) === '1'
}
