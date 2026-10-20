import crypto from 'node:crypto'
import type { OrganizerUser, EventItem, Participant } from '~/types'
import { getSupabaseServerClient } from './supabase'

interface DatabaseSchema {
  organizers: (OrganizerUser & { passwordHash: string })[]
  events: EventItem[]
  participants: Participant[]
}

const STORAGE_KEY = 'database.json'

const defaultDb: DatabaseSchema = {
  organizers: [],
  events: [],
  participants: []
}

// In-memory cache + persistent storage via Nitro unstorage or Supabase
let inMemoryDb: DatabaseSchema | null = null

export async function getDb(): Promise<DatabaseSchema> {
  if (inMemoryDb) {
    return inMemoryDb
  }

  const supabase = getSupabaseServerClient()

  if (supabase) {
    try {
      // 1. Fetch from Supabase
      const [orgsRes, eventsRes, partsRes] = await Promise.all([
        supabase.from('organizers').select('*'),
        supabase.from('events').select('*'),
        supabase.from('participants').select('*')
      ])

      if (!orgsRes.error && !eventsRes.error && !partsRes.error) {
        const organizers = (orgsRes.data || []).map(o => ({
          id: o.id,
          email: o.email,
          name: o.name,
          passwordHash: o.password_hash || '',
          createdAt: o.created_at
        }))

        const events: EventItem[] = (eventsRes.data || []).map(e => ({
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

        const participants: Participant[] = (partsRes.data || []).map(p => ({
          id: p.id,
          eventId: p.event_id,
          name: p.name,
          role: p.role as any,
          phone: p.phone || undefined,
          notes: p.notes || undefined,
          pickupLocation: p.pickup_location || undefined,
          pickupCoords: p.pickup_lat && p.pickup_lng ? { lat: p.pickup_lat, lng: p.pickup_lng } : null,
          carModel: p.car_model || undefined,
          totalSeats: p.total_seats || 4,
          departureTime: p.departure_time || undefined,
          departureLocation: p.departure_location || undefined,
          departureCoords: p.departure_lat && p.departure_lng ? { lat: p.departure_lat, lng: p.departure_lng } : null,
          assignedRiderId: p.assigned_rider_id || null,
          token: p.token,
          createdAt: p.created_at
        }))

        inMemoryDb = { organizers, events, participants }
        return inMemoryDb
      }
    } catch (err) {
      console.warn('[DB] Supabase read failed, falling back to local store:', err)
    }
  }

  // Fallback to local file storage
  try {
    const storage = useStorage('meetride')
    const raw = await storage.getItem<DatabaseSchema>(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.events)) {
      inMemoryDb = raw
      return inMemoryDb
    }
  } catch (err) {
    console.warn('[DB] Failed reading from local storage:', err)
  }

  // Seed sample event if database is brand new so user can immediately test!
  const seeded = getInitialSeedData()
  inMemoryDb = seeded
  await saveDb(seeded)
  return inMemoryDb
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
  inMemoryDb = data

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
      // Upsert organizers
      if (data.organizers.length > 0) {
        await supabase.from('organizers').upsert(
          data.organizers.map(o => ({
            id: o.id,
            email: o.email,
            name: o.name,
            password_hash: o.passwordHash,
            created_at: o.createdAt
          }))
        )
      }

      // Upsert events
      if (data.events.length > 0) {
        await supabase.from('events').upsert(
          data.events.map(e => ({
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
        )
      }

      // Upsert participants
      if (data.participants.length > 0) {
        await supabase.from('participants').upsert(
          data.participants.map(p => ({
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
            token: p.token || '',
            created_at: p.createdAt
          }))
        )
      }
    } catch (err) {
      console.warn('[DB] Supabase sync failed:', err)
    }
  }
}

// Password hashing helper
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'meet_ride_salt_2026').digest('hex')
}

// Helper to generate slug from title
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6)
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
    passwordHash: hashPassword('password123'),
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
      departureTime: '15:30',
      departureLocation: 'Milano Centrale / Stazione FS',
      departureCoords: { lat: 45.4854, lng: 9.2045 },
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
      departureTime: '16:00',
      departureLocation: 'Monza / Centro Commerciale Brianza',
      departureCoords: { lat: 45.5845, lng: 9.2744 },
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
      createdAt: new Date().toISOString()
    }
  ]

  return {
    organizers: [demoOrganizer],
    events: [demoEvent],
    participants: demoParticipants
  }
}
