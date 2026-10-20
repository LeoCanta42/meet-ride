import type { Participant, OptimizationSuggestion, OptimizationResult } from '~/types'

/**
 * Calculates distance in kilometers between two lat/lng points using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * Simple text proximity heuristic based on word overlap for location strings
 * (e.g., "Milano Centrale" vs "Milano Loreto" vs "Monza")
 */
function calculateTextProximityScore(loc1?: string, loc2?: string): number {
  if (!loc1 || !loc2) return 50 // default medium distance

  const words1 = loc1.toLowerCase().split(/[\s,./-]+/).filter(w => w.length > 2)
  const words2 = loc2.toLowerCase().split(/[\s,./-]+/).filter(w => w.length > 2)

  let matches = 0
  for (const w of words1) {
    if (words2.includes(w)) {
      matches++
    }
  }

  if (matches > 0) {
    return Math.max(2, 20 - matches * 8) // estimated 2 - 12 km
  }
  return 40 // default fallback distance estimate
}

export function computeProximity(
  pCoords?: { lat: number; lng: number } | null,
  pLoc?: string,
  rCoords?: { lat: number; lng: number } | null,
  rLoc?: string
): number {
  if (pCoords?.lat && pCoords?.lng && rCoords?.lat && rCoords?.lng) {
    return calculateHaversineDistance(pCoords.lat, pCoords.lng, rCoords.lat, rCoords.lng)
  }
  return calculateTextProximityScore(pLoc, rLoc)
}

export function optimizeSeatAllocation(
  riders: Participant[],
  passengers: Participant[]
): OptimizationResult {
  const suggestions: OptimizationSuggestion[] = []

  // Track current car occupancy
  const carCapacity = new Map<string, {
    rider: Participant
    totalSeats: number
    occupied: number
    passengers: Participant[]
  }>()

  for (const rider of riders) {
    const total = rider.totalSeats || 4
    const seatedPassengers = passengers.filter(p => p.assignedRiderId === rider.id)
    carCapacity.set(rider.id, {
      rider,
      totalSeats: total,
      occupied: seatedPassengers.length,
      passengers: [...seatedPassengers]
    })
  }

  // 1. First priority: Assign unassigned passengers to the nearest car with available capacity
  const unassigned = passengers.filter(p => !p.assignedRiderId)

  for (const passenger of unassigned) {
    let bestRiderId: string | null = null
    let minDistance = Infinity

    for (const [riderId, car] of carCapacity.entries()) {
      if (car.occupied < car.totalSeats) {
        const dist = computeProximity(
          passenger.pickupCoords,
          passenger.pickupLocation,
          car.rider.departureCoords,
          car.rider.departureLocation
        )

        if (dist < minDistance) {
          minDistance = dist
          bestRiderId = riderId
        }
      }
    }

    if (bestRiderId) {
      const bestCar = carCapacity.get(bestRiderId)!
      bestCar.occupied++
      bestCar.passengers.push(passenger)

      suggestions.push({
        passengerId: passenger.id,
        passengerName: passenger.name,
        currentRiderId: null,
        suggestedRiderId: bestRiderId,
        suggestedRiderName: bestCar.rider.name,
        distanceKm: minDistance < 100 ? minDistance : undefined,
        reason: minDistance <= 15
          ? `Vicino al punto di partenza (${minDistance} km)`
          : `Posto disponibile nell'auto di ${bestCar.rider.name}`
      })
    }
  }

  // 2. Second pass: Check if any already-seated passenger has a significantly closer driver (detour improvement)
  for (const [currentRiderId, car] of carCapacity.entries()) {
    for (const seatedPassenger of [...car.passengers]) {
      // Current distance
      const currentDist = computeProximity(
        seatedPassenger.pickupCoords,
        seatedPassenger.pickupLocation,
        car.rider.departureCoords,
        car.rider.departureLocation
      )

      // Look for a substantially closer car (at least 8 km closer) with available seat
      for (const [otherRiderId, otherCar] of carCapacity.entries()) {
        if (otherRiderId === currentRiderId) continue

        if (otherCar.occupied < otherCar.totalSeats) {
          const otherDist = computeProximity(
            seatedPassenger.pickupCoords,
            seatedPassenger.pickupLocation,
            otherCar.rider.departureCoords,
            otherCar.rider.departureLocation
          )

          if (currentDist - otherDist > 8) {
            // Reassign
            car.occupied--
            car.passengers = car.passengers.filter(p => p.id !== seatedPassenger.id)
            otherCar.occupied++
            otherCar.passengers.push(seatedPassenger)

            suggestions.push({
              passengerId: seatedPassenger.id,
              passengerName: seatedPassenger.name,
              currentRiderId,
              suggestedRiderId: otherRiderId,
              suggestedRiderName: otherCar.rider.name,
              distanceKm: otherDist < 100 ? otherDist : undefined,
              reason: `Risparmio di ${Math.round(currentDist - otherDist)} km sulla tratta di ritrovo`
            })
            break
          }
        }
      }
    }
  }

  const unassignedRemaining = passengers.filter(
    p => !p.assignedRiderId && !suggestions.some(s => s.passengerId === p.id)
  ).length

  return {
    suggestions,
    totalMoved: suggestions.length,
    summary: suggestions.length === 0
      ? 'Tutti i posti sono già ottimali.'
      : `${suggestions.length} passeggeri possono essere allocati per ottimizzare i percorsi.`,
    unassignedRemaining
  }
}
