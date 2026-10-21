export interface OrganizerUser {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface Coordinates {
  lat: number
  lng: number
}

export interface EventItem {
  id: string
  organizerId: string
  slug: string
  title: string
  description?: string
  destination: string
  destinationCoords?: Coordinates | null
  eventDate: string
  sharedPassword?: string // organizer sees it or stored on server
  hasPassword?: boolean // public flag
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export type ParticipantRole = 'rider' | 'passenger'

export interface Participant {
  id: string
  eventId: string
  name: string
  role: ParticipantRole
  phone?: string
  pin?: string
  hasPin?: boolean
  notes?: string
  // Locations
  pickupLocation?: string
  pickupCoords?: Coordinates | null
  // Rider specific
  carModel?: string
  totalSeats?: number // e.g. 4
  price?: number | null // Total car trip cost in EUR (split among people in the car)
  departureTime?: string
  departureLocation?: string
  departureCoords?: Coordinates | null
  // Passenger specific
  assignedRiderId?: string | null
  // System
  createdAt: string
  token?: string // browser identity token
}

export interface CarWithSeats {
  rider: Participant
  passengers: Participant[]
  totalSeats: number
  occupiedSeats: number
  availableSeats: number
  isFull: boolean
  totalPrice?: number | null
  peopleCount: number
  pricePerPerson?: number | null
  pricePerPersonFull?: number | null
}

export interface OptimizationSuggestion {
  passengerId: string
  passengerName: string
  currentRiderId: string | null
  suggestedRiderId: string
  suggestedRiderName: string
  distanceKm?: number
  reason: string
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[]
  totalMoved: number
  summary: string
  unassignedRemaining: number
}
