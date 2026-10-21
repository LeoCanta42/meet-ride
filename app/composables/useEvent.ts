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

  function getAllLocalParticipantTokens(): string[] {
    if (!import.meta.client) return []
    const tokens: string[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('mr_p_token_')) {
          const val = localStorage.getItem(key)
          if (val) tokens.push(val)
        }
      }
    } catch {
      // ignore storage errors
    }
    return tokens
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
      let queryToken: string | undefined
      if (import.meta.client) {
        try {
          const route = useRoute()
          const q = (route.query.p || route.query.token) as string | undefined
          if (q && typeof q === 'string') {
            queryToken = q.trim()
          }
        } catch {
          // ignore
        }
      }

      const candidateTokens = [...getAllLocalParticipantTokens()]
      if (queryToken) candidateTokens.push(queryToken)

      const res = await $fetch<{
        event: EventItem
        isUnlocked: boolean
        isOrganizer: boolean
        cars?: CarWithSeats[]
        unassignedPassengers?: Participant[]
      }>(`/api/events/${idOrSlug}`, {
        headers: candidateTokens.length > 0
          ? { 'x-participant-token': candidateTokens.join(',') }
          : undefined
      })

      currentEvent.value = res.event
      isUnlocked.value = res.isUnlocked
      isOrganizer.value = res.isOrganizer
      cars.value = res.cars || []
      unassignedPassengers.value = res.unassignedPassengers || []

      // Check URL query parameters for personal access token (?p=xxx or ?token=xxx)
      if (import.meta.client) {
        try {
          const route = useRoute()
          const queryToken = (route.query.p || route.query.token) as string | undefined
          if (queryToken && typeof queryToken === 'string') {
            setLocalParticipantToken(res.event.id, queryToken.trim())
            const router = useRouter()
            const newQuery = { ...route.query }
            delete newQuery.p
            delete newQuery.token
            router.replace({ query: newQuery }).catch(() => {})
          }
        } catch {
          // ignore
        }
      }

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

  async function reconnectParticipant(participantId: string, credential: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const res = await $fetch<{ success: boolean; participant: Participant; token: string }>(
        `/api/events/${currentEvent.value.id}/reconnect`,
        {
          method: 'POST',
          body: { participantId, credential }
        }
      )

      if (res.token) {
        setLocalParticipantToken(currentEvent.value.id, res.token)
      }
      myParticipant.value = res.participant

      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Impossibile riconnettere il profilo' }
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

  async function optimizeSeats(apply = false): Promise<{ result?: OptimizationResult; error?: string }> {
    if (!currentEvent.value) return { error: 'Nessun evento selezionato' }

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
      return { result: res }
    } catch (err: any) {
      console.error('Error optimizing seats:', err)
      return { error: err.data?.statusMessage || err.message || 'Errore durante l\'ottimizzazione con Gemini AI' }
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
    reconnectParticipant,
    getLocalParticipantToken,
    setLocalParticipantToken,
    leaveEvent,
    selectCar,
    optimizeSeats,
    loadMyEvents,
    createEvent,
    deleteEvent
  }
}
