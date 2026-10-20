import type { EventItem, CarWithSeats, Participant, OptimizationResult } from '~/types'

export function useEvent() {
  const currentEvent = useState<EventItem | null>('mr_current_event', () => null)
  const cars = useState<CarWithSeats[]>('mr_current_cars', () => [])
  const unassignedPassengers = useState<Participant[]>('mr_current_unassigned', () => [])
  const isUnlocked = useState<boolean>('mr_current_unlocked', () => false)
  const isOrganizer = useState<boolean>('mr_current_is_organizer', () => false)
  const myParticipant = useState<Participant | null>('mr_my_participant', () => null)
  const loading = useState<boolean>('mr_event_loading', () => false)

  const myEvents = useState<(EventItem & { stats?: any })[]>('mr_my_events', () => [])
  const myEventsLoading = useState<boolean>('mr_my_events_loading', () => false)

  function getLocalParticipantToken(eventId: string): string | null {
    if (!import.meta.client) return null
    return localStorage.getItem(`mr_p_token_${eventId}`)
  }

  function setLocalParticipantToken(eventId: string, token: string) {
    if (import.meta.client) {
      localStorage.setItem(`mr_p_token_${eventId}`, token)
    }
  }

  function removeLocalParticipantToken(eventId: string) {
    if (import.meta.client) {
      localStorage.removeItem(`mr_p_token_${eventId}`)
    }
  }

  async function loadEvent(idOrSlug: string): Promise<boolean> {
    loading.value = true
    try {
      const res = await $fetch<{
        event: EventItem
        isUnlocked: boolean
        isOrganizer: boolean
        cars?: CarWithSeats[]
        unassignedPassengers?: Participant[]
      }>(`/api/events/${idOrSlug}`)

      currentEvent.value = res.event
      isUnlocked.value = res.isUnlocked
      isOrganizer.value = res.isOrganizer
      cars.value = res.cars || []
      unassignedPassengers.value = res.unassignedPassengers || []

      // Identify current user's participant record if they have registered
      const token = getLocalParticipantToken(res.event.id)
      if (token && res.isUnlocked) {
        let found: Participant | null = null
        for (const car of cars.value) {
          if (car.rider.token === token) {
            found = car.rider
            break
          }
          const p = car.passengers.find((x: Participant) => x.token === token)
          if (p) {
            found = p
            break
          }
        }
        if (!found) {
          found = unassignedPassengers.value.find((x: Participant) => x.token === token) || null
        }
        myParticipant.value = found
      } else {
        myParticipant.value = null
      }

      return true
    } catch (err) {
      console.error('Error loading event:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function unlockEvent(idOrSlug: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/events/${idOrSlug}/unlock`, {
        method: 'POST',
        body: { password }
      })
      await loadEvent(idOrSlug)
      return { success: true }
    } catch (err: any) {
      const msg = err.data?.statusMessage || 'Password non valida'
      return { success: false, error: msg }
    }
  }

  async function registerParticipant(data: Partial<Participant>): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const token = getLocalParticipantToken(currentEvent.value.id) || undefined
      const res = await $fetch<{ participant: Participant; token: string }>(
        `/api/events/${currentEvent.value.id}/participants`,
        {
          method: 'POST',
          body: {
            ...data,
            id: myParticipant.value?.id,
            token
          }
        }
      )

      if (res.token) {
        setLocalParticipantToken(currentEvent.value.id, res.token)
      }
      myParticipant.value = res.participant

      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella registrazione' }
    }
  }

  async function leaveEvent(): Promise<boolean> {
    if (!currentEvent.value || !myParticipant.value) return false

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/participants`, {
        method: 'DELETE',
        body: {
          participantId: myParticipant.value.id,
          token: myParticipant.value.token
        }
      })

      removeLocalParticipantToken(currentEvent.value.id)
      myParticipant.value = null
      await loadEvent(currentEvent.value.id)
      return true
    } catch (err) {
      console.error('Error leaving event:', err)
      return false
    }
  }

  async function selectCar(riderId: string | null): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value || !myParticipant.value) {
      return { success: false, error: 'Devi prima registrarti come passeggero' }
    }

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/select-rider`, {
        method: 'POST',
        body: {
          passengerId: myParticipant.value.id,
          token: myParticipant.value.token,
          riderId
        }
      })

      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Impossibile selezionare quest\'auto' }
    }
  }

  async function optimizeSeats(apply = false): Promise<OptimizationResult | null> {
    if (!currentEvent.value) return null

    try {
      const res = await $fetch<OptimizationResult & { applied: boolean }>(
        `/api/events/${currentEvent.value.id}/optimize`,
        {
          method: 'POST',
          body: { apply }
        }
      )

      if (apply) {
        await loadEvent(currentEvent.value.id)
      }
      return res
    } catch (err) {
      console.error('Error optimizing seats:', err)
      return null
    }
  }

  async function loadMyEvents(): Promise<void> {
    myEventsLoading.value = true
    try {
      const res = await $fetch<{ events: (EventItem & { stats?: any })[] }>('/api/events')
      myEvents.value = res.events
    } catch (err) {
      console.error('Error loading organizer events:', err)
      myEvents.value = []
    } finally {
      myEventsLoading.value = false
    }
  }

  async function createEvent(payload: {
    title: string
    description?: string
    destination: string
    destinationCoords?: { lat: number; lng: number } | null
    eventDate: string
    sharedPassword: string
  }): Promise<{ success: boolean; event?: EventItem; error?: string }> {
    try {
      const res = await $fetch<{ event: EventItem }>('/api/events', {
        method: 'POST',
        body: payload
      })
      await loadMyEvents()
      return { success: true, event: res.event }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella creazione dell\'evento' }
    }
  }

  async function deleteEvent(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/events/${id}`, { method: 'DELETE' })
      myEvents.value = myEvents.value.filter(e => e.id !== id)
      return true
    } catch (err) {
      console.error('Error deleting event:', err)
      return false
    }
  }

  return {
    currentEvent,
    cars,
    unassignedPassengers,
    isUnlocked,
    isOrganizer,
    myParticipant,
    loading,
    myEvents,
    myEventsLoading,
    loadEvent,
    unlockEvent,
    registerParticipant,
    leaveEvent,
    selectCar,
    optimizeSeats,
    loadMyEvents,
    createEvent,
    deleteEvent
  }
}
