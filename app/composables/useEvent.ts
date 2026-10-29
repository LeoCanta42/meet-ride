import type { EventItem, CarWithSeats, Participant, OptimizationResult, OptimizationSuggestion } from '~/types'

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
    if (!idOrSlug) return false

    // Clear stale state if switching to a different event
    if (currentEvent.value && currentEvent.value.id !== idOrSlug && currentEvent.value.slug !== idOrSlug) {
      currentEvent.value = null
      isUnlocked.value = false
      cars.value = []
      unassignedPassengers.value = []
      myParticipant.value = null
    }

    loading.value = true
    try {
      // 1. Check URL query parameters for personal access token (?p=xxx or ?token=xxx) FIRST
      let queryToken: string | undefined
      if (import.meta.client) {
        try {
          const route = useRoute()
          const q = (route.query.p || route.query.token) as string | undefined
          if (q && typeof q === 'string') {
            queryToken = q.trim()
            setLocalParticipantToken(idOrSlug, queryToken)
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

      const specificToken = getLocalParticipantToken(idOrSlug)
      const candidateTokens = [...getAllLocalParticipantTokens()]
      if (specificToken && !candidateTokens.includes(specificToken)) candidateTokens.push(specificToken)
      if (queryToken && !candidateTokens.includes(queryToken)) candidateTokens.push(queryToken)

      const res = await $fetch<{
        event: EventItem
        isUnlocked: boolean
        isOrganizer: boolean
        cars?: CarWithSeats[]
        unassignedPassengers?: Participant[]
        myParticipant?: Participant | null
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

      // Synchronize myParticipant
      if (res.myParticipant) {
        myParticipant.value = res.myParticipant
        if (res.myParticipant.token) {
          setLocalParticipantToken(res.event.id, res.myParticipant.token)
        }
      } else {
        myParticipant.value = null
        if (specificToken) {
          removeLocalParticipantToken(res.event.id)
        }
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

  async function registerParticipant(data: Partial<Participant> & { isAdditionalCar?: boolean }): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const token = getLocalParticipantToken(currentEvent.value.id) || undefined
      const isAdditional = Boolean(data.isAdditionalCar)

      const res = await $fetch<{ participant: Participant; token: string }>(
        `/api/events/${currentEvent.value.id}/participants`,
        {
          method: 'POST',
          body: {
            ...data,
            id: data.id || (!isAdditional ? myParticipant.value?.id : undefined),
            token
          }
        }
      )

      if (res.token && !getLocalParticipantToken(currentEvent.value.id)) {
        setLocalParticipantToken(currentEvent.value.id, res.token)
      }

      if (!isAdditional || !myParticipant.value) {
        myParticipant.value = res.participant
      }

      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella registrazione' }
    }
  }

  async function deleteCar(riderId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }
    const token = getLocalParticipantToken(currentEvent.value.id) || undefined
    try {
      await $fetch(`/api/events/${currentEvent.value.id}/participants`, {
        method: 'DELETE',
        body: {
          participantId: riderId,
          token
        }
      })
      if (myParticipant.value?.id === riderId) {
        myParticipant.value = null
        removeLocalParticipantToken(currentEvent.value.id)
      }
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella rimozione della vettura' }
    }
  }

  // Organizer: create participant without overriding current session token
  async function createParticipantAsOrganizer(data: Partial<Participant>): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/participants`, {
        method: 'POST',
        body: {
          ...data,
          isOrganizerAction: true
        }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella creazione del partecipante' }
    }
  }

  // Organizer: update any participant directly
  async function updateParticipantAsOrganizer(participantId: string, data: Partial<Participant>): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/participants`, {
        method: 'POST',
        body: {
          ...data,
          id: participantId,
          isOrganizerAction: true
        }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella modifica del partecipante' }
    }
  }

  // Organizer: delete any participant
  async function deleteParticipantAsOrganizer(participantId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/participants`, {
        method: 'DELETE',
        body: { participantId }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nell\'eliminazione del partecipante' }
    }
  }

  // Organizer: assign or move any passenger to a car
  async function assignPassengerAsOrganizer(passengerId: string, riderId: string | null): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      await $fetch(`/api/events/${currentEvent.value.id}/select-rider`, {
        method: 'POST',
        body: { passengerId, riderId }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nell\'assegnazione del passeggero' }
    }
  }

  // Assign a passenger as driver of a car (by organizer or by passenger themselves)
  async function assignDriver(riderId: string, passengerId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const token = myParticipant.value?.token || getLocalParticipantToken(currentEvent.value.id) || undefined
      await $fetch(`/api/events/${currentEvent.value.id}/assign-driver`, {
        method: 'POST',
        body: {
          riderId,
          passengerId,
          token
        }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nell\'assegnazione dell\'autista' }
    }
  }

  // Remove/unassign driver from a car
  async function unassignDriver(riderId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const token = myParticipant.value?.token || getLocalParticipantToken(currentEvent.value.id) || undefined
      await $fetch(`/api/events/${currentEvent.value.id}/assign-driver`, {
        method: 'POST',
        body: {
          riderId,
          action: 'unassign',
          token
        }
      })
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nella rimozione dell\'autista' }
    }
  }

  // Current logged in passenger decides to become the driver of a car
  async function becomeDriver(riderId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value || !myParticipant.value) {
      return { success: false, error: 'Devi prima registrarti all\'evento' }
    }
    return assignDriver(riderId, myParticipant.value.id)
  }

  // Current logged in driver steps down from driving a car
  async function stepDownDriver(riderId: string): Promise<{ success: boolean; error?: string }> {
    return unassignDriver(riderId)
  }

  // Organizer: update event settings (including arrival time)
  async function updateEventDetails(payload: Partial<EventItem>): Promise<{ success: boolean; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const res = await $fetch<{ event: EventItem }>(`/api/events/${currentEvent.value.id}`, {
        method: 'PUT',
        body: payload
      })
      currentEvent.value = res.event
      await loadEvent(currentEvent.value.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.statusMessage || 'Errore nell\'aggiornamento dell\'evento' }
    }
  }

  // Feature 4: Calculate convoy route with Gemini AI
  async function calculateConvoyRoute(): Promise<{ success: boolean; routePlan?: any; error?: string }> {
    if (!currentEvent.value) return { success: false, error: 'Nessun evento selezionato' }

    try {
      const res = await $fetch<{ success: boolean; routePlan: any }>(
        `/api/events/${currentEvent.value.id}/route`,
        {
          method: 'POST',
          body: {
            meetingPoints: currentEvent.value.meetingPoints || []
          }
        }
      )
      if (res.routePlan) {
        currentEvent.value.routePlan = res.routePlan
      }
      await loadEvent(currentEvent.value.id)
      return { success: true, routePlan: res.routePlan }
    } catch (err: any) {
      console.error('Error calculating convoy route:', err)
      return { success: false, error: err.data?.statusMessage || 'Errore nel calcolo del percorso con Gemini AI' }
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

  async function optimizeSeats(apply = false, suggestions?: OptimizationSuggestion[]): Promise<{ result?: OptimizationResult; error?: string }> {
    if (!currentEvent.value) return { error: 'Nessun evento selezionato' }

    try {
      const res = await $fetch<OptimizationResult & { applied: boolean }>(
        `/api/events/${currentEvent.value.id}/optimize`,
        {
          method: 'POST',
          body: { apply, suggestions }
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

  async function loadMyEvents(scope?: string): Promise<void> {
    myEventsLoading.value = true
    try {
      const url = scope ? `/api/events?scope=${encodeURIComponent(scope)}` : '/api/events'
      const res = await $fetch<{ events: (EventItem & { stats?: any; creatorName?: string; creatorEmail?: string })[] }>(url)
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
    arrivalTime?: string | null
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
    createParticipantAsOrganizer,
    updateParticipantAsOrganizer,
    deleteParticipantAsOrganizer,
    assignPassengerAsOrganizer,
    assignDriver,
    unassignDriver,
    becomeDriver,
    stepDownDriver,
    updateEventDetails,
    calculateConvoyRoute,
    reconnectParticipant,
    getLocalParticipantToken,
    setLocalParticipantToken,
    leaveEvent,
    deleteCar,
    selectCar,
    optimizeSeats,
    loadMyEvents,
    createEvent,
    deleteEvent
  }
}
