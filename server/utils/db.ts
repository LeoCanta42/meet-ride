import crypto from 'node:crypto'
import type { OrganizerUser, EventItem, Participant } from '~/types'
import { getSupabaseServerClient } from './supabase'

export interface DatabaseSchema {
  organizers: (OrganizerUser & { passwordHash: string })[]
  events: EventItem[]
  participants: Participant[]
}

const STORAGE_KEY = 'database.json'

// Fallback in-memory cache ONLY used when neither Supabase nor Nitro filesystem storage is available
let fallbackMemoryDb: DatabaseSchema | null = null

/**
 * Encodes optional metadata into token string when remote Supabase table
 * has not yet been migrated with `pin` / `price` columns.
 */
function packTokenWithMeta(token: string, pin?: string, price?: number | null): string {
  const baseToken = (token || '').split('|')[0] || crypto.randomBytes(16).toString('hex')
  const parts = [baseToken]
  if (pin) parts.push(`pin:${encodeURIComponent(pin)}`)
  if (price !== undefined && price !== null && !Number.isNaN(Number(price))) {
    parts.push(`price:${Number(price)}`)
  }
  return parts.join('|')
}

function unpackTokenMeta(rawToken?: string | null): {
  token: string
  pin?: string
  price?: number | null
} {
  if (!rawToken) return { token: '' }
  const segments = rawToken.split('|')
  const token = segments[0] || ''
  let pin: string | undefined
  let price: number | null | undefined

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] || ''
    if (seg.startsWith('pin:')) {
      pin = decodeURIComponent(seg.slice(4))
    } else if (seg.startsWith('price:')) {
      const val = parseFloat(seg.slice(6))
      if (!Number.isNaN(val)) price = val
    }
  }
  return { token, pin, price }
}

export async function getDb(): Promise<DatabaseSchema> {
  const supabase = getSupabaseServerClient()

  if (supabase) {
    try {
      const [orgsRes, eventsRes, partsRes] = await Promise.all([
        supabase.from('organizers').select('*'),
        supabase.from('events').select('*'),
        supabase.from('participants').select('*')
      ])

      if (orgsRes.error) {
        console.error('[DB] Supabase error reading organizers:', orgsRes.error.message)
      }
      if (eventsRes.error) {
        console.error('[DB] Supabase error reading events:', eventsRes.error.message)
      }
      if (partsRes.error) {
        console.error('[DB] Supabase error reading participants:', partsRes.error.message)
      }

      // If at least organizers or events query succeeded, build state from Supabase
      if (!orgsRes.error && !eventsRes.error && !partsRes.error) {
        const organizers = (orgsRes.data || []).map((o: any) => ({
          id: o.id,
          email: (o.email || '').trim().toLowerCase(),
          name: o.name,
          passwordHash: o.password_hash || '',
          createdAt: o.created_at
        }))

        const events: EventItem[] = (eventsRes.data || []).map((e: any) => ({
          id: e.id,
          organizerId: e.organizer_id || '',
          slug: e.slug,
          title: e.title,
          description: e.description || '',
          destination: e.destination,
          destinationCoords: e.destination_lat && e.destination_lng
            ? { lat: e.destination_lat, lng: e.destination_lng }
            : null,
          eventDate: e.event_date,
          sharedPassword: e.shared_password,
          status: (e.status as any) || 'active',
          createdAt: e.created_at,
          updatedAt: e.updated_at
        }))

        const participants: Participant[] = (partsRes.data || []).map((p: any) => {
          const unpacked = unpackTokenMeta(p.token)
          const resolvedPin = p.pin || unpacked.pin || undefined
          const resolvedPrice =
            p.price !== undefined && p.price !== null
              ? Number(p.price)
              : unpacked.price !== undefined
                ? unpacked.price
                : null

          return {
            id: p.id,
            eventId: p.event_id,
            name: p.name,
            role: p.role as any,
            phone: p.phone || undefined,
            pin: resolvedPin,
            notes: p.notes || undefined,
            pickupLocation: p.pickup_location || undefined,
            pickupCoords: p.pickup_lat && p.pickup_lng ? { lat: p.pickup_lat, lng: p.pickup_lng } : null,
            carModel: p.car_model || undefined,
            totalSeats: p.total_seats || 4,
            price: resolvedPrice,
            departureTime: p.departure_time || undefined,
            departureLocation: p.departure_location || undefined,
            departureCoords: p.departure_lat && p.departure_lng ? { lat: p.departure_lat, lng: p.departure_lng } : null,
            assignedRiderId: p.assigned_rider_id || null,
            token: unpacked.token || p.token,
            createdAt: p.created_at
          }
        })

        // If brand new empty Supabase instance, seed initial demo data so demo works out of the box
        if (organizers.length === 0 && events.length === 0 && participants.length === 0) {
          const seeded = getInitialSeedData()
          await saveDb(seeded)
          return seeded
        }

        const freshDb = { organizers, events, participants }
        fallbackMemoryDb = freshDb
        return freshDb
      }
    } catch (err) {
      console.warn('[DB] Supabase read failed, falling back to local store:', err)
    }
  }

  // Fallback to local file storage (Nitro unstorage)
  try {
    const storage = useStorage('meetride')
    const raw = await storage.getItem<DatabaseSchema>(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.events)) {
      raw.organizers = Array.isArray(raw.organizers) ? raw.organizers : []
      raw.participants = Array.isArray(raw.participants) ? raw.participants : []
      fallbackMemoryDb = raw
      return raw
    }
  } catch (err) {
    console.warn('[DB] Failed reading from local storage:', err)
  }

  if (fallbackMemoryDb) {
    return fallbackMemoryDb
  }

  // Seed sample event if database is brand new
  const seeded = getInitialSeedData()
  fallbackMemoryDb = seeded
  await saveDb(seeded)
  return seeded
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
  fallbackMemoryDb = data

  // 1. Save to local storage cache
  try {
    const storage = useStorage('meetride')
    await storage.setItem(STORAGE_KEY, data)
  } catch (err) {
    console.error('[DB] Failed saving to local storage:', err)
  }

  // 2. Sync to Supabase if configured
  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      // Upsert organizers (handle both id and email conflicts safely)
      if (data.organizers.length > 0) {
        const orgRows = data.organizers.map(o => ({
          id: o.id,
          email: o.email.trim().toLowerCase(),
          name: o.name,
          password_hash: o.passwordHash,
          created_at: o.createdAt
        }))

        const { error: orgError } = await supabase
          .from('organizers')
          .upsert(orgRows, { onConflict: 'email' })

        if (orgError) {
          console.warn('[DB] Batch organizer upsert by email failed, retrying individually:', orgError.message)
          for (const row of orgRows) {
            const { error: singleErr } = await supabase
              .from('organizers')
              .upsert(row, { onConflict: 'id' })
            if (singleErr) {
              console.error('[DB] Organizer upsert error for', row.email, ':', singleErr.message)
            }
          }
        }
      }

      // Upsert events
      if (data.events.length > 0) {
        const eventRows = data.events.map(e => ({
          id: e.id,
          organizer_id: e.organizerId || null,
          slug: e.slug,
          title: e.title,
          description: e.description || '',
          destination: e.destination,
          destination_lat: e.destinationCoords?.lat || null,
          destination_lng: e.destinationCoords?.lng || null,
          event_date: e.eventDate,
          shared_password: e.sharedPassword || '',
          status: e.status,
          created_at: e.createdAt,
          updated_at: e.updatedAt
        }))

        const { error: evError } = await supabase.from('events').upsert(eventRows, { onConflict: 'id' })
        if (evError) {
          console.error('[DB] Events upsert error:', evError.message)
        }
      }

      // Upsert participants (with automatic fallback if pin/price columns aren't migrated yet)
      if (data.participants.length > 0) {
        const fullPartRows = data.participants.map(p => ({
          id: p.id,
          event_id: p.eventId,
          name: p.name,
          role: p.role,
          phone: p.phone || null,
          pin: p.pin || null,
          notes: p.notes || null,
          pickup_location: p.pickupLocation || null,
          pickup_lat: p.pickupCoords?.lat || null,
          pickup_lng: p.pickupCoords?.lng || null,
          car_model: p.carModel || null,
          total_seats: p.totalSeats || 4,
          price: p.price !== undefined && p.price !== null ? Number(p.price) : null,
          departure_time: p.departureTime || null,
          departure_location: p.departureLocation || null,
          departure_lat: p.departureCoords?.lat || null,
          departure_lng: p.departureCoords?.lng || null,
          assigned_rider_id: p.assignedRiderId || null,
          token: packTokenWithMeta(p.token || '', p.pin, p.price),
          created_at: p.createdAt
        }))

        const { error: partError } = await supabase
          .from('participants')
          .upsert(fullPartRows, { onConflict: 'id' })

        if (partError) {
          // Fallback without newer optional columns (`pin`, `price`) in case remote SQL schema wasn't migrated yet
          console.warn('[DB] Participants upsert with new columns failed, retrying with base schema:', partError.message)
          const basePartRows = data.participants.map(p => ({
            id: p.id,
            event_id: p.eventId,
            name: p.name,
            role: p.role,
            phone: p.phone || null,
            notes: p.notes || null,
            pickup_location: p.pickupLocation || null,
            pickup_lat: p.pickupCoords?.lat || null,
            pickup_lng: p.pickupCoords?.lng || null,
            car_model: p.carModel || null,
            total_seats: p.totalSeats || 4,
            departure_time: p.departureTime || null,
            departure_location: p.departureLocation || null,
            departure_lat: p.departureCoords?.lat || null,
            departure_lng: p.departureCoords?.lng || null,
            assigned_rider_id: p.assignedRiderId || null,
            token: packTokenWithMeta(p.token || '', p.pin, p.price),
            created_at: p.createdAt
          }))

          const { error: fallbackErr } = await supabase
            .from('participants')
            .upsert(basePartRows as any, { onConflict: 'id' })

          if (fallbackErr) {
            console.error('[DB] Participants fallback upsert error:', fallbackErr.message)
          }
        }
      }
    } catch (err) {
      console.warn('[DB] Supabase sync failed:', err)
    }
  }
}

export async function deleteEventFromDb(eventId: string, db: DatabaseSchema): Promise<void> {
  db.events = db.events.filter(e => e.id !== eventId)
  db.participants = db.participants.filter(p => p.eventId !== eventId)
  await saveDb(db)

  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      await supabase.from('participants').delete().eq('event_id', eventId)
      await supabase.from('events').delete().eq('id', eventId)
    } catch (err) {
      console.warn('[DB] Failed deleting event from Supabase:', err)
    }
  }
}

export async function deleteParticipantFromDb(participantId: string, db: DatabaseSchema): Promise<void> {
  db.participants = db.participants.filter(p => p.id !== participantId)
  await saveDb(db)

  const supabase = getSupabaseServerClient()
  if (supabase) {
    try {
      await supabase.from('participants').delete().eq('id', participantId)
    } catch (err) {
      console.warn('[DB] Failed deleting participant from Supabase:', err)
    }
  }
}

// Legacy SHA-256 hash for backward compatibility
function hashPasswordLegacy(password: string): string {
  return crypto.createHash('sha256').update(password + 'meet_ride_salt_2026').digest('hex')
}

// Strong scrypt password hashing helper
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derived}`
}

// Timing-safe password verification supporting both scrypt and legacy sha256 hashes
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash || !password) return false

  const candidates = [password]
  if (password.trim() !== password && password.trim().length > 0) {
    candidates.push(password.trim())
  }

  for (const candidate of candidates) {
    if (storedHash.startsWith('scrypt:')) {
      const parts = storedHash.split(':')
      if (parts.length === 3) {
        const salt = parts[1]!
        const expectedHex = parts[2]!
        try {
          const derived = crypto.scryptSync(candidate, salt, 64)
          const expectedBuf = Buffer.from(expectedHex, 'hex')
          if (derived.length === expectedBuf.length && crypto.timingSafeEqual(derived, expectedBuf)) {
            return true
          }
        } catch {
          // ignore malformed hash
        }
      }
    } else {
      const legacyHex = hashPasswordLegacy(candidate)
      try {
        const a = Buffer.from(legacyHex, 'utf8')
        const b = Buffer.from(storedHash, 'utf8')
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true
        }
      } catch {
        // ignore
      }
    }
  }

  return false
}

// Helper to generate slug from title
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const randomSuffix = crypto.randomBytes(3).toString('hex')
  return `${base || 'evento'}-${randomSuffix}`
}

function getInitialSeedData(): DatabaseSchema {
  const demoOrganizerId = '00000000-0000-0000-0000-000000000001'
  const demoEventId = '00000000-0000-0000-0000-000000000002'
  const demoSlug = 'courmayeur-weekend'

  const demoOrganizer = {
    id: demoOrganizerId,
    email: 'organizzatore@meetride.local',
    name: 'Marco Rossi',
    passwordHash: hashPasswordLegacy('password123'),
    createdAt: new Date().toISOString()
  }

  const demoEvent: EventItem = {
    id: demoEventId,
    organizerId: demoOrganizerId,
    slug: demoSlug,
    title: 'Weekend Sci e Relax a Courmayeur',
    description: 'Partenza venerdì pomeriggio per il weekend sulla neve. Ritrovo allo chalet per cena!',
    destination: 'Courmayeur, Valle d\'Aosta',
    destinationCoords: { lat: 45.7969, lng: 6.9686 },
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    sharedPassword: 'neve',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const rider1Id = '00000000-0000-0000-0000-000000000011'
  const rider2Id = '00000000-0000-0000-0000-000000000012'

  const demoParticipants: Participant[] = [
    {
      id: rider1Id,
      eventId: demoEventId,
      name: 'Andrea Bianchi',
      role: 'rider',
      phone: '+39 340 1234567',
      carModel: 'Volkswagen Golf Grigia',
      totalSeats: 4,
      price: 60,
      departureTime: '15:30',
      departureLocation: 'Milano Centrale / Stazione FS',
      departureCoords: { lat: 45.4854, lng: 9.2045 },
      token: 'demo_token_rider_1',
      createdAt: new Date().toISOString()
    },
    {
      id: rider2Id,
      eventId: demoEventId,
      name: 'Chiara Verdi',
      role: 'rider',
      phone: '+39 347 9876543',
      carModel: 'Peugeot 2008 Nera',
      totalSeats: 3,
      price: 45,
      departureTime: '16:00',
      departureLocation: 'Monza / Centro Commerciale Brianza',
      departureCoords: { lat: 45.5845, lng: 9.2744 },
      token: 'demo_token_rider_2',
      createdAt: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      eventId: demoEventId,
      name: 'Federico Neri',
      role: 'passenger',
      phone: '+39 333 1122334',
      pickupLocation: 'Milano Loreto',
      pickupCoords: { lat: 45.4862, lng: 9.2173 },
      assignedRiderId: rider1Id,
      notes: 'Ho sci e una borsa morbida',
      token: 'demo_token_pass_1',
      createdAt: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      eventId: demoEventId,
      name: 'Sara Colombo',
      role: 'passenger',
      phone: '+39 339 5566778',
      pickupLocation: 'Milano Repubblica',
      pickupCoords: { lat: 45.4789, lng: 9.1982 },
      assignedRiderId: rider1Id,
      notes: 'Zaino e scarponi',
      token: 'demo_token_pass_2',
      createdAt: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000023',
      eventId: demoEventId,
      name: 'Matteo Gatti',
      role: 'passenger',
      phone: '+39 328 4433221',
      pickupLocation: 'Sesto San Giovanni / Rondò',
      pickupCoords: { lat: 45.5342, lng: 9.2274 },
      assignedRiderId: null,
      notes: 'Flessibile, posso arrivare anche a Monza',
      token: 'demo_token_pass_3',
      createdAt: new Date().toISOString()
    }
  ]

  return {
    organizers: [demoOrganizer],
    events: [demoEvent],
    participants: demoParticipants
  }
}
