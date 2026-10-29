export interface OrganizerUser {
  id: string
  email: string
  name: string
  role?: 'admin' | 'organizer'
  isAdmin?: boolean
  isApproved?: boolean
  createdAt: string
  eventsCount?: number
}

export interface Coordinates {
  lat: number
  lng: number
}

export interface ManualMeetingPoint {
  id: string
  name: string
  time?: string
  riderIds: string[]
  coords?: Coordinates | null
  notes?: string
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
  arrivalTime?: string | null // Desired arrival time (e.g. "20:30")
  sharedPassword?: string // organizer sees it or stored on server
  hasPassword?: boolean // public flag
  status: 'active' | 'archived'
  meetingPoints?: ManualMeetingPoint[]
  routePlan?: ConvoyRoutePlan | null
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
  hasDriver?: boolean // default true; if false, vehicle is hosted without a driver
  ownerParticipantId?: string | null // if vehicle belongs to another participant (2nd car)
  secondaryVehicle?: Partial<Participant> | null
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
  hasDriver?: boolean
}

export interface ConvoyPassengerAssignment {
  passengerId: string
  passengerName: string
  assignedRiderId: string
  carLabel: string
  reason: string
}

export interface ConvoyUnassignedPassenger {
  passengerId: string
  passengerName: string
  reason: string
}

export interface ConvoyWaypoint {
  name: string
  type: 'start' | 'pickup' | 'meeting_point' | 'destination'
  time: string
  carNames: string[]
  lat: number
  lng: number
  description: string
}

export interface ConvoyStep {
  step: number
  time: string
  instruction: string
}

export interface ConvoyRoutePlan {
  summary: string
  arrivalTime: string
  inputFingerprint?: string
  totalConvoyDistanceKm?: number
  waypoints: ConvoyWaypoint[]
  steps: ConvoyStep[]
  passengerAssignments?: ConvoyPassengerAssignment[]
  unassignedPassengers?: ConvoyUnassignedPassenger[]
  calculatedAt: string
}

export interface OptimizationSuggestion {
  passengerId: string
  passengerName: string
  passengerPickupLocation?: string
  currentRiderId: string | null
  suggestedRiderId: string
  suggestedRiderName: string
  carModel?: string
  carDepartureLocation?: string
  distanceKm?: number
  reason: string
}

export interface UnusedCarInfo {
  riderId: string
  driverName: string
  carModel: string
  departureLocation: string
  reason: string
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[]
  totalMoved: number
  summary: string
  unassignedRemaining: number
  usedCarsCount?: number
  totalCarsCount?: number
  unusedCars?: UnusedCarInfo[]
}
