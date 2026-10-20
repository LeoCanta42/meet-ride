import crypto from 'node:crypto'
import type { OrganizerUser, EventItem, Participant } from '~/types'

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

// In-memory cache + persistent storage via Nitro unstorage
let inMemoryDb: DatabaseSchema | null = null

export async function getDb(): Promise<DatabaseSchema> {
  if (inMemoryDb) {
    return inMemoryDb
  }

  try {
    const storage = useStorage('meetride')
    const raw = await storage.getItem<DatabaseSchema>(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.events)) {
      inMemoryDb = raw
      return inMemoryDb
    }
  } catch (err) {
    console.warn('[DB] Failed reading from storage:', err)
  }

  // Seed sample event if database is brand new so user can immediately test!
  const seeded = getInitialSeedData()
  inMemoryDb = seeded
  await saveDb(seeded)
  return inMemoryDb
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
  inMemoryDb = data
  try {
    const storage = useStorage('meetride')
    await storage.setItem(STORAGE_KEY, data)
  } catch (err) {
    console.error('[DB] Failed saving to storage:', err)
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
  const demoOrganizerId = 'org-demo-1'
  const demoEventId = 'event-courmayeur-demo'
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

  const rider1Id = 'rider-1'
  const rider2Id = 'rider-2'

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
      id: 'passenger-1',
      eventId: demoEventId,
      name: 'Federico Neri',
      role: 'passenger',
      phone: '+39 333 1122334',
      pickupLocation: 'Milano Loreto',
      pickupCoords: { lat: 45.4862, lng: 9.2173 },
      assignedRiderId: rider1Id, // seated with Andrea
      notes: 'Ho sci e una borsa morbida',
      createdAt: new Date().toISOString()
    },
    {
      id: 'passenger-2',
      eventId: demoEventId,
      name: 'Sara Colombo',
      role: 'passenger',
      phone: '+39 339 5566778',
      pickupLocation: 'Milano Repubblica',
      pickupCoords: { lat: 45.4789, lng: 9.1982 },
      assignedRiderId: rider1Id, // seated with Andrea
      notes: 'Zaino e scarponi',
      createdAt: new Date().toISOString()
    },
    {
      id: 'passenger-3',
      eventId: demoEventId,
      name: 'Matteo Gatti',
      role: 'passenger',
      phone: '+39 328 4433221',
      pickupLocation: 'Sesto San Giovanni / Rondò',
      pickupCoords: { lat: 45.5342, lng: 9.2274 },
      assignedRiderId: null, // waiting for allocation
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
