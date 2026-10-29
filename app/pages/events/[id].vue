<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'
import type { Participant, CarWithSeats, ManualMeetingPoint } from '~/types'

const route = useRoute()
const eventIdOrSlug = computed(() => (route.params.id as string) || '')

const { t, locale } = useI18n()
const {
  currentEvent,
  cars,
  unassignedPassengers,
  isUnlocked,
  isOrganizer,
  myParticipant,
  loading,
  loadEvent,
  unlockEvent,
  registerParticipant,
  createParticipantAsOrganizer,
  updateParticipantAsOrganizer,
  deleteParticipantAsOrganizer,
  assignPassengerAsOrganizer,
  updateEventDetails,
  calculateConvoyRoute,
  deleteCar,
  leaveEvent,
  selectCar
} = useEvent()

const toast = useToast()
const unlockError = ref('')
const unlocking = ref(false)
const isModalOpen = ref(false)
const showReconnectModal = ref(false)
const preselectedParticipantId = ref('')
const showDeviceSyncModal = ref(false)
const isNewJoin = ref(false)
const showJoinChoiceModal = ref(false)
const targetRiderId = ref('')
const modalInitialData = ref<Participant | null>(null)
const actionLoading = ref(false)
const carActionLoadingId = ref<string | null>(null)

// Organizer Control state (Feature 2)
const isOrganizerAction = ref(false)
const showAssignModal = ref(false)
const passengerToAssign = ref<Participant | null>(null)
const showEditEventModal = ref(false)

// Passenger info detail modal state
const showPassengerModal = ref(false)
const selectedPassenger = ref<Participant | null>(null)
const selectedPassengerCar = ref<CarWithSeats | null>(null)

function handleShowPassengerDetail(passenger: Participant, car?: CarWithSeats | null) {
  selectedPassenger.value = passenger
  if (car) {
    selectedPassengerCar.value = car
  } else {
    selectedPassengerCar.value = cars.value.find(c => c.passengers.some(p => p.id === passenger.id)) || null
  }
  showPassengerModal.value = true
}

function handleShowPassengerDetailById(passengerId: string) {
  const p = allParticipants.value.find(part => part.id === passengerId)
  if (p) {
    handleShowPassengerDetail(p)
  }
}

// Convoy & AI calculation state (Feature 4)
const convoyCalculating = ref(false)
const meetingPointsSaving = ref(false)
const optimizationPanelRef = ref<{ openAndCalculate?: () => void } | null>(null)

function handleOpenOptimizer() {
  optimizationPanelRef.value?.openAndCalculate?.()
}

const allParticipants = computed<Participant[]>(() => {
  const list: Participant[] = []
  for (const c of cars.value) {
    list.push(c.rider)
    for (const p of c.passengers) {
      list.push(p)
    }
  }
  for (const u of unassignedPassengers.value) {
    list.push(u)
  }
  return list
})

function openDeviceSync() {
  isNewJoin.value = false
  showDeviceSyncModal.value = true
}

function handleClaimParticipant(participantId: string) {
  preselectedParticipantId.value = participantId
  showReconnectModal.value = true
}

function handlePromptJoin(riderId?: string) {
  targetRiderId.value = riderId || ''
  showJoinChoiceModal.value = true
}

function handleChoiceNew() {
  showJoinChoiceModal.value = false
  openJoinModal('passenger')
}

function handleChoiceReconnect() {
  showJoinChoiceModal.value = false
  preselectedParticipantId.value = ''
  showReconnectModal.value = true
}

onMounted(async () => {
  await loadEvent(eventIdOrSlug.value)
})

watch(() => route.params.id, async (newId) => {
  if (newId) {
    await loadEvent(newId as string)
  }
})

async function handleUnlock(password: string) {
  unlockError.value = ''
  unlocking.value = true
  try {
    const res = await unlockEvent(eventIdOrSlug.value, password)
    if (res.success) {
      toast.add({
        title: t('common.success'),
        color: 'success'
      })
    } else {
      unlockError.value = res.error || t('eventView.wrongPassword')
    }
  } finally {
    unlocking.value = false
  }
}

function openJoinModal(role: 'rider' | 'passenger') {
  isOrganizerAction.value = false
  modalInitialData.value = {
    role,
    name: myParticipant.value?.name || '',
    phone: myParticipant.value?.phone || '',
    hasDriver: role === 'rider' ? (myParticipant.value?.role === 'rider' ? false : true) : true,
    id: '',
    eventId: currentEvent.value?.id || '',
    createdAt: ''
  } as Participant
  isModalOpen.value = true
}

function handleEditCar(rider: Participant) {
  if (isOrganizer.value) {
    handleOrganizerEditParticipant(rider)
  } else {
    isOrganizerAction.value = false
    modalInitialData.value = { ...rider }
    isModalOpen.value = true
  }
}

async function handleDeleteCar(riderId: string) {
  if (isOrganizer.value) {
    await handleOrganizerDeleteCar(riderId)
    return
  }
  if (confirm('Vuoi davvero rimuovere questa vettura? I passeggeri a bordo torneranno in lista di attesa.')) {
    actionLoading.value = true
    try {
      const res = await deleteCar(riderId)
      if (res.success) {
        toast.add({ title: 'Vettura rimossa con successo', color: 'success' })
      } else {
        toast.add({ title: 'Errore', description: res.error, color: 'error' })
      }
    } finally {
      actionLoading.value = false
    }
  }
}

function openEditModal() {
  if (!myParticipant.value) return
  isOrganizerAction.value = false
  modalInitialData.value = { ...myParticipant.value }
  isModalOpen.value = true
}

// Organizer actions (Feature 2)
function openOrganizerAddModal(role: 'rider' | 'passenger') {
  isOrganizerAction.value = true
  modalInitialData.value = {
    role,
    name: '',
    id: '',
    eventId: currentEvent.value?.id || '',
    createdAt: ''
  } as Participant
  isModalOpen.value = true
}

function handleOrganizerEditParticipant(participant: Participant) {
  isOrganizerAction.value = true
  modalInitialData.value = { ...participant }
  isModalOpen.value = true
}

async function handleOrganizerDeleteCar(riderId: string) {
  if (confirm('Vuoi davvero eliminare questa vettura? I passeggeri a bordo torneranno in lista di attesa.')) {
    actionLoading.value = true
    try {
      const res = await deleteParticipantAsOrganizer(riderId)
      if (res.success) {
        toast.add({ title: 'Vettura rimossa con successo', color: 'success' })
      } else {
        toast.add({ title: 'Errore', description: res.error, color: 'error' })
      }
    } finally {
      actionLoading.value = false
    }
  }
}

async function handleOrganizerDeletePassenger(passengerId: string) {
  if (confirm('Vuoi rimuovere questo partecipante dall\'evento?')) {
    actionLoading.value = true
    try {
      const res = await deleteParticipantAsOrganizer(passengerId)
      if (res.success) {
        toast.add({ title: 'Partecipante rimosso', color: 'success' })
      } else {
        toast.add({ title: 'Errore', description: res.error, color: 'error' })
      }
    } finally {
      actionLoading.value = false
    }
  }
}

async function handleOrganizerRemovePassengerFromCar(passengerId: string) {
  actionLoading.value = true
  try {
    const res = await assignPassengerAsOrganizer(passengerId, null)
    if (res.success) {
      toast.add({ title: 'Passeggero rimosso dall\'auto', color: 'neutral' })
    } else {
      toast.add({ title: 'Errore', description: res.error, color: 'error' })
    }
  } finally {
    actionLoading.value = false
  }
}

function openAssignModal(passenger: Participant) {
  passengerToAssign.value = passenger
  showAssignModal.value = true
}

async function handleConfirmAssign(riderId: string) {
  if (!passengerToAssign.value) return
  actionLoading.value = true
  try {
    const res = await assignPassengerAsOrganizer(passengerToAssign.value.id, riderId)
    if (res.success) {
      toast.add({ title: 'Passeggero assegnato con successo!', color: 'success' })
      showAssignModal.value = false
      passengerToAssign.value = null
    } else {
      toast.add({ title: 'Errore assegnazione', description: res.error, color: 'error' })
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleParticipantSubmit(data: Partial<Participant>) {
  const isEdit = !!modalInitialData.value?.id

  // If performed by Organizer directly for managing participants
  if (isOrganizerAction.value) {
    actionLoading.value = true
    try {
      let res
      if (isEdit && modalInitialData.value?.id) {
        res = await updateParticipantAsOrganizer(modalInitialData.value.id, data)
      } else {
        res = await createParticipantAsOrganizer(data)
      }

      if (res.success) {
        toast.add({
          title: t('common.success'),
          description: isEdit ? 'Partecipante aggiornato dall\'organizzatore' : 'Partecipante aggiunto all\'evento',
          color: 'success'
        })
      } else {
        toast.add({
          title: t('common.error'),
          description: res.error,
          color: 'error'
        })
      }
    } finally {
      actionLoading.value = false
      isOrganizerAction.value = false
    }
    return
  }

  // Normal user flow
  const isAdditionalCar = Boolean(myParticipant.value && !modalInitialData.value?.id && data.role === 'rider')
  const payloadToSubmit = {
    ...data,
    id: modalInitialData.value?.id || undefined,
    ownerParticipantId: isAdditionalCar ? myParticipant.value?.id : undefined,
    isAdditionalCar
  }

  const res = await registerParticipant(payloadToSubmit)
  if (res.success) {
    toast.add({
      title: t('common.success'),
      description: isAdditionalCar ? 'Nuova auto aggiunta con successo!' : undefined,
      color: 'success'
    })

    if (targetRiderId.value && !isEdit && data.role === 'passenger') {
      await selectCar(targetRiderId.value)
      targetRiderId.value = ''
    }

    // Show onboarding sync modal if first time registration
    if (!isEdit && !isAdditionalCar) {
      isNewJoin.value = true
      showDeviceSyncModal.value = true
    }
  } else {
    toast.add({
      title: t('common.error'),
      description: res.error,
      color: 'error'
    })
  }
}

// Convoy & AI calculation handlers (Feature 4)
async function handleCalculateConvoy() {
  convoyCalculating.value = true
  try {
    const res = await calculateConvoyRoute()
    if (res.success) {
      toast.add({
        title: 'Tracciato calcolato con successo!',
        description: 'Il percorso di ciascuna auto sulla mappa è stato aggiornato.',
        color: 'success'
      })
      if (currentEvent.value?.id) {
        await loadEvent(currentEvent.value.id)
      }
    } else {
      toast.add({
        title: 'Errore',
        description: res.error,
        color: 'error'
      })
    }
  } finally {
    convoyCalculating.value = false
  }
}

async function handleSaveMeetingPoints(meetingPoints: ManualMeetingPoint[]) {
  meetingPointsSaving.value = true
  try {
    const res = await updateEventDetails({ meetingPoints, routePlan: null })
    if (res.success) {
      if (unassignedPassengers.value.length === 0 && cars.value.length > 0) {
        await handleCalculateConvoy()
      } else {
        toast.add({
          title: 'Punti di ritrovo aggiornati!',
          description: meetingPoints.length > 0
            ? `${meetingPoints.length} punto/i di ritrovo salvati. Ricalcola la mappa per vedere il nuovo tracciato.`
            : 'Punti di ritrovo rimossi: le auto andranno dritte a destinazione.',
          color: 'success'
        })
      }
    } else {
      toast.add({
        title: 'Errore',
        description: res.error,
        color: 'error'
      })
    }
  } finally {
    meetingPointsSaving.value = false
  }
}

async function handleUpdateArrivalTime(time: string) {
  const res = await updateEventDetails({ arrivalTime: time })
  if (res.success) {
    toast.add({
      title: 'Orario di arrivo aggiornato!',
      description: `Nuovo orario fissato alle ${time}`,
      color: 'success'
    })
  } else {
    toast.add({
      title: 'Errore',
      description: res.error,
      color: 'error'
    })
  }
}

async function handleLeaveEvent() {
  if (confirm(t('eventView.leaveConfirm'))) {
    actionLoading.value = true
    try {
      await leaveEvent()
      toast.add({
        title: t('common.success'),
        color: 'neutral'
      })
    } finally {
      actionLoading.value = false
    }
  }
}

async function handleSelectCar(riderId: string) {
  carActionLoadingId.value = riderId
  try {
    const res = await selectCar(riderId)
    if (res.success) {
      toast.add({
        title: t('common.success'),
        color: 'success'
      })
    } else {
      toast.add({
        title: t('common.error'),
        description: res.error,
        color: 'error'
      })
    }
  } finally {
    carActionLoadingId.value = null
  }
}

async function handleLeaveCar() {
  const currentRiderId = myParticipant.value?.assignedRiderId
  carActionLoadingId.value = currentRiderId || null
  try {
    const res = await selectCar(null)
    if (res.success) {
      toast.add({
        title: t('common.success'),
        color: 'neutral'
      })
    } else {
      toast.add({
        title: t('common.error'),
        description: res.error,
        color: 'error'
      })
    }
  } finally {
    carActionLoadingId.value = null
  }
}

function copyShareLink() {
  if (!import.meta.client || !currentEvent.value) return
  const url = window.location.origin + `/events/${currentEvent.value.slug || currentEvent.value.id}`
  const pass = currentEvent.value.sharedPassword && currentEvent.value.sharedPassword !== '***'
    ? `\nPassword: ${currentEvent.value.sharedPassword}`
    : ''
  const shareText = `${currentEvent.value.title}\nLink: ${url}${pass}`

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText)
  }
  toast.add({
    title: t('common.copied'),
    color: 'success'
  })
}

const formattedDate = computed(() => {
  if (!currentEvent.value?.eventDate) return ''
  try {
    const d = new Date(currentEvent.value.eventDate)
    return d.toLocaleString(locale.value === 'it' ? 'it-IT' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return currentEvent.value.eventDate
  }
})

const totalAvailableSeats = computed(() => {
  return cars.value.reduce((acc, c) => acc + c.availableSeats, 0)
})

const totalSeats = computed(() => {
  return cars.value.reduce((acc, c) => acc + c.totalSeats, 0)
})

const totalOccupiedSeats = computed(() => {
  return cars.value.reduce((acc, c) => acc + c.occupiedSeats, 0)
})

const totalPassengersCount = computed(() => {
  return totalOccupiedSeats.value + unassignedPassengers.value.length
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:py-8 sm:px-6">
    <!-- Loading state -->
    <div v-if="loading && !currentEvent" class="py-20 text-center">
      <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin mx-auto text-sky-500 mb-2" />
      <p class="text-xs text-slate-500">{{ t('common.loading') }}</p>
    </div>

    <!-- Protected / Locked event -->
    <PasswordGateModal
      v-else-if="!isUnlocked"
      :event="currentEvent"
      :loading="unlocking"
      :error="unlockError"
      @unlock="handleUnlock"
    />

    <!-- Unlocked Event Dashboard -->
    <div v-else-if="currentEvent" class="space-y-5 sm:space-y-8">
      <!-- Event Hero / Header -->
      <div class="surface-card relative overflow-hidden rounded-3xl p-4 sm:p-8 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div class="space-y-2 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                {{ formattedDate }}
              </span>
              <span
                v-if="isOrganizer"
                class="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300"
              >
                Organizzatore
              </span>
              <span
                v-if="currentEvent.sharedPassword && currentEvent.sharedPassword !== '***'"
                class="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="Password condivisa evento"
              >
                🔑 {{ currentEvent.sharedPassword }}
              </span>
            </div>

            <h1 class="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">
              {{ currentEvent.title }}
            </h1>

            <div class="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              <UIcon name="i-lucide-map-pin" class="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
              <span class="break-words">{{ currentEvent.destination }}</span>
            </div>

            <p v-if="currentEvent.description" class="text-xs text-slate-500 dark:text-slate-400 pt-1 max-w-2xl leading-relaxed break-words">
              {{ currentEvent.description }}
            </p>
          </div>

          <!-- Share Action -->
          <div class="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <UButton
              color="neutral"
              variant="subtle"
              size="md"
              @click="copyShareLink"
              class="font-semibold text-xs w-full md:w-auto justify-center"
            >
              <UIcon name="i-lucide-share-2" class="h-4 w-4 mr-1.5 shrink-0" />
              {{ t('events.shareTitle') }}
            </UButton>
          </div>
        </div>

        <!-- Quick Stats Overview -->
        <div class="mt-5 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
          <div class="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">{{ t('eventView.statCars') }}</span>
            <span class="text-lg font-bold text-slate-900 dark:text-white">{{ cars.length }}</span>
          </div>

          <div class="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">{{ t('eventView.statTotalSeats') }}</span>
            <span class="text-lg font-bold text-slate-900 dark:text-white">{{ totalSeats }}</span>
          </div>

          <div class="rounded-xl bg-emerald-50/60 p-3 dark:bg-emerald-950/30">
            <span class="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block truncate">{{ t('eventView.statAvailable') }}</span>
            <span class="text-lg font-bold text-emerald-800 dark:text-emerald-300">{{ totalAvailableSeats }}</span>
          </div>

          <div class="rounded-xl bg-amber-50/60 p-3 dark:bg-amber-950/30">
            <span class="text-[11px] font-medium text-amber-700 dark:text-amber-400 block truncate">{{ t('eventView.statUnassigned') }}</span>
            <span class="text-lg font-bold text-amber-800 dark:text-amber-300">{{ unassignedPassengers.length }}</span>
          </div>
        </div>
      </div>

      <!-- Current Participant Status & Actions (visible when registered) -->
      <div v-if="myParticipant" class="surface-card rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3 min-w-0 w-full lg:w-auto">
            <div
              class="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold"
              :class="myParticipant.role === 'rider' ? 'bg-emerald-600' : 'bg-sky-600'"
            >
              <UIcon :name="myParticipant.role === 'rider' ? 'i-lucide-car' : 'i-lucide-user'" class="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ t('eventView.myStatus') }}</span>
                <span class="font-bold text-slate-900 dark:text-white text-sm truncate max-w-full">
                  {{ myParticipant.name }}
                </span>
                <span
                  class="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0"
                  :class="myParticipant.role === 'rider' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'"
                >
                  {{ myParticipant.role === 'rider' ? 'Guidatore' : 'Passeggero' }}
                </span>
              </div>

              <!-- Position / car note -->
              <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">
                <span v-if="myParticipant.role === 'rider'">
                  {{ myParticipant.carModel }} ({{ myParticipant.totalSeats }} posti<template v-if="myParticipant.price && myParticipant.price > 0"> • €{{ myParticipant.price }} tot.</template>) — Partenza da: {{ myParticipant.departureLocation || 'Non specificato' }}
                </span>
                <span v-else>
                  Ritiro: {{ myParticipant.pickupLocation || 'Non specificato' }}
                  <span v-if="myParticipant.assignedRiderId" class="text-sky-600 dark:text-sky-400 font-semibold ml-1">
                    • In auto con un guidatore
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400 font-semibold ml-1">
                    • In attesa di posto
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center flex-wrap gap-2 w-full lg:w-auto">
            <UButton
              v-if="myParticipant.role === 'rider'"
              color="neutral"
              variant="outline"
              size="sm"
              @click="openJoinModal('rider')"
              class="text-xs font-semibold flex-1 sm:flex-initial justify-center"
              title="Metti a disposizione un'ulteriore auto"
            >
              <UIcon name="i-lucide-plus" class="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{{ t('eventView.addSecondCar') }}</span>
            </UButton>

            <UButton
              color="primary"
              variant="subtle"
              size="sm"
              @click="openDeviceSync"
              class="text-xs font-semibold flex-1 sm:flex-initial justify-center"
              title="Apri su smartphone o sincronizza altri dispositivi"
            >
              <UIcon name="i-lucide-smartphone" class="h-3.5 w-3.5 mr-1 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{{ t('eventView.openOnSmartphone') }}</span>
            </UButton>

            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="openEditModal"
              class="text-xs font-semibold flex-1 sm:flex-initial justify-center"
            >
              <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 mr-1 shrink-0" />
              {{ t('eventView.editParticipation') }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              :loading="actionLoading"
              @click="handleLeaveEvent"
              class="text-xs font-semibold shrink-0"
              :title="t('eventView.leaveParticipation')"
            >
              <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            </UButton>
          </div>
        </div>
      </div>

      <!-- Join Event Call-To-Action Banner (visible when user has NOT joined yet) -->
      <div
        v-else
        class="surface-card rounded-2xl p-4 sm:p-5 shadow-sm border border-sky-200/80 bg-gradient-to-r from-sky-50/70 via-white to-emerald-50/40 dark:border-sky-900/50 dark:from-sky-950/30 dark:via-slate-900 dark:to-emerald-950/20"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-lucide-hand-metal" class="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{{ t('eventView.joinBannerTitle') }}</span>
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {{ t('eventView.joinBannerSubtitle') }}
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <UButton
              color="primary"
              variant="solid"
              size="md"
              @click="openJoinModal('rider')"
              class="font-bold text-xs justify-center shadow-sm shadow-sky-500/20"
            >
              {{ t('eventView.imDriving') }}
            </UButton>

            <UButton
              color="primary"
              variant="subtle"
              size="md"
              @click="openJoinModal('passenger')"
              class="font-bold text-xs justify-center"
            >
              {{ t('eventView.iNeedRide') }}
            </UButton>

            <UButton
              v-if="allParticipants.length > 0"
              color="neutral"
              variant="outline"
              size="md"
              @click="preselectedParticipantId = ''; showReconnectModal = true"
              class="font-semibold text-xs justify-center"
            >
              <UIcon name="i-lucide-log-in" class="h-4 w-4 mr-1 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{{ t('eventView.reconnectPromptBtn') }}</span>
            </UButton>
          </div>
        </div>
      </div>

      <!-- Organizer Full Control Toolbar (Feature 2) -->
      <div
        v-if="isOrganizer"
        class="surface-card rounded-2xl p-4 border-2 border-purple-200/80 bg-gradient-to-r from-purple-50/70 to-indigo-50/50 dark:border-purple-900/60 dark:from-purple-950/30 dark:to-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-xs">
            <UIcon name="i-lucide-shield-check" class="h-5 w-5" />
          </div>
          <div>
            <span class="block text-xs font-bold text-slate-900 dark:text-white">
              Pannello Gestione Organizzatore
            </span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Hai pieno controllo: aggiungi o modifica guidatori e passeggeri, gestisci i posti e le auto.
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            @click="showEditEventModal = true"
            class="font-bold text-xs border-purple-300 dark:border-purple-800 justify-center"
          >
            <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
            Modifica Evento
          </UButton>

          <UButton
            color="primary"
            size="xs"
            @click="openOrganizerAddModal('rider')"
            class="font-bold text-xs shadow-xs justify-center"
          >
            <UIcon name="i-lucide-car" class="h-3.5 w-3.5 mr-1 shrink-0" />
            Aggiungi Guidatore
          </UButton>

          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            @click="openOrganizerAddModal('passenger')"
            class="font-bold text-xs border-purple-300 dark:border-purple-800 justify-center"
          >
            <UIcon name="i-lucide-user-plus" class="h-3.5 w-3.5 mr-1 shrink-0" />
            Aggiungi Passeggero
          </UButton>
        </div>
      </div>

      <!-- Task 1: Optimize People Arrangement in Cars (AI) -->
      <OptimizationPanel
        ref="optimizationPanelRef"
        :event-id="currentEvent.id"
        :is-organizer="isOrganizer"
        :cars="cars"
        :unassigned-count="unassignedPassengers.length"
        :total-passengers="totalPassengersCount"
        @optimized="loadEvent(eventIdOrSlug)"
      />

      <!-- Task 2: Manual Meeting Points for Specific Cars -->
      <MeetingPointsPanel
        :event="currentEvent"
        :cars="cars"
        :is-organizer="isOrganizer"
        :saving="meetingPointsSaving"
        @save="handleSaveMeetingPoints"
      />

      <!-- Task 3: Map with Cars Track to Reach Destination -->
      <ConvoyMap
        :event="currentEvent"
        :is-organizer="isOrganizer"
        :route-plan="currentEvent.routePlan"
        :cars="cars"
        :unassigned-count="unassignedPassengers.length"
        :loading="convoyCalculating"
        @calculate="handleCalculateConvoy"
        @open-optimizer="handleOpenOptimizer"
        @update-arrival-time="handleUpdateArrivalTime"
        @show-passenger="handleShowPassengerDetailById"
      />

      <!-- Cars Grid Section -->
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-car" class="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {{ t('eventView.carsTitle') }}
            </h2>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {{ cars.length }}
            </span>
          </div>
        </div>

        <!-- Empty Cars -->
        <div
          v-if="cars.length === 0"
          class="surface-card rounded-2xl p-8 text-center"
        >
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950">
            <UIcon name="i-lucide-car" class="h-6 w-6" />
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {{ t('eventView.noCarsYet') }}
          </p>
        </div>

        <!-- Cars Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CarCard
            v-for="car in cars"
            :key="car.rider.id"
            :car="car"
            :my-participant="myParticipant"
            :is-organizer="isOrganizer"
            :loading="carActionLoadingId === car.rider.id"
            @select-car="handleSelectCar"
            @leave-car="handleLeaveCar"
            @prompt-join="handlePromptJoin"
            @claim-participant="handleClaimParticipant"
            @edit-car="handleEditCar"
            @delete-car="handleDeleteCar"
            @remove-passenger="handleOrganizerRemovePassengerFromCar"
            @show-passenger="handleShowPassengerDetail"
          />
        </div>
      </div>

      <!-- Unassigned Passengers Section -->
      <div class="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="h-5 w-5 text-amber-500 shrink-0" />
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {{ t('eventView.unassignedTitle') }}
            </h2>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {{ unassignedPassengers.length }}
            </span>
          </div>
        </div>

        <!-- Empty Unassigned -->
        <div
          v-if="unassignedPassengers.length === 0"
          class="surface-card rounded-2xl p-6 text-center text-xs text-slate-500 dark:text-slate-400"
        >
          <UIcon name="i-lucide-check-check" class="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
          {{ t('eventView.noUnassigned') }}
        </div>

        <!-- Unassigned List -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="passenger in unassignedPassengers"
            :key="passenger.id"
            class="surface-card rounded-xl p-3.5 space-y-1.5 border border-slate-200/80 dark:border-slate-800 transition-all"
            :class="[
              passenger.id === myParticipant?.id ? 'ring-2 ring-amber-500 bg-amber-50/20 dark:bg-amber-950/20' : '',
              !myParticipant ? 'hover:border-sky-300 dark:hover:border-sky-800' : ''
            ]"
          >
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="handleShowPassengerDetail(passenger, null)"
                class="font-bold text-slate-900 dark:text-white text-xs hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer text-left flex items-center gap-1.5 transition-colors"
                :title="'Visualizza dettagli di ' + passenger.name"
              >
                <UIcon name="i-lucide-user" class="h-3.5 w-3.5 text-slate-400" />
                <span>{{ passenger.name }}</span>
              </button>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="!myParticipant"
                  type="button"
                  @click="handleClaimParticipant(passenger.id)"
                  class="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5"
                  :title="t('eventView.isThisYou')"
                >
                  <UIcon name="i-lucide-user-check" class="h-3 w-3" />
                  <span>{{ t('eventView.isThisYou') }}</span>
                </button>
                <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  In cerca
                </span>
              </div>
            </div>

            <div v-if="passenger.pickupLocation" class="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
              <span class="truncate">{{ passenger.pickupLocation }}</span>
            </div>

            <div v-if="passenger.notes" class="text-[11px] text-slate-500 dark:text-slate-400 italic truncate">
              "{{ passenger.notes }}"
            </div>

            <!-- Organizer controls on unassigned passenger (Feature 2) -->
            <div v-if="isOrganizer" class="pt-2 flex items-center justify-end gap-1.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                class="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                title="Assegna a un'auto"
                @click="openAssignModal(passenger)"
              >
                <UIcon name="i-lucide-car" class="h-3 w-3" />
                <span>Assegna</span>
              </button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Modifica passeggero"
                @click="handleOrganizerEditParticipant(passenger)"
              >
                <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Elimina passeggero"
                @click="handleOrganizerDeletePassenger(passenger.id)"
              >
                <UIcon name="i-lucide-trash-2" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Join Choice Modal (New vs Reconnect) when unauthenticated clicks Join Car -->
    <UModal
      :open="showJoinChoiceModal"
      @update:open="showJoinChoiceModal = $event"
      :title="t('joinPromptModal.title')"
      :description="t('joinPromptModal.subtitle')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="space-y-3">
          <button
            type="button"
            class="w-full flex items-start gap-3 p-3.5 rounded-2xl border border-sky-200 bg-sky-50/50 hover:bg-sky-50 text-left transition-all dark:border-sky-900/60 dark:bg-sky-950/20 dark:hover:bg-sky-950/40"
            @click="handleChoiceNew"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white font-bold">
              <UIcon name="i-lucide-user-plus" class="h-5 w-5" />
            </div>
            <div>
              <span class="block font-bold text-xs text-slate-900 dark:text-white">
                {{ t('joinPromptModal.newParticipant') }}
              </span>
              <span class="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {{ t('joinPromptModal.newParticipantDesc') }}
              </span>
            </div>
          </button>

          <button
            type="button"
            class="w-full flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800"
            @click="handleChoiceReconnect"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold">
              <UIcon name="i-lucide-smartphone" class="h-5 w-5" />
            </div>
            <div>
              <span class="block font-bold text-xs text-slate-900 dark:text-white">
                {{ t('joinPromptModal.alreadyRegistered') }}
              </span>
              <span class="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {{ t('joinPromptModal.alreadyRegisteredDesc') }}
              </span>
            </div>
          </button>
        </div>
      </template>
    </UModal>

    <!-- Assign Passenger Modal (Feature 2 - Organizer only) -->
    <UModal
      :open="showAssignModal"
      @update:open="showAssignModal = $event"
      title="Assegna Passeggero a un'Auto"
      :description="`Seleziona l'auto per ${passengerToAssign?.name || 'il passeggero'}`"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <div class="space-y-2">
          <div v-if="cars.length === 0" class="text-xs text-slate-400 text-center py-4">
            Nessuna vettura presente per questo evento.
          </div>
          <button
            v-for="car in cars"
            :key="car.rider.id"
            type="button"
            class="w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all"
            :class="car.isFull
              ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              : 'hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer border-slate-200 dark:border-slate-800'"
            :disabled="car.isFull"
            @click="handleConfirmAssign(car.rider.id)"
          >
            <div class="min-w-0 pr-2">
              <div class="font-bold text-xs text-slate-900 dark:text-white truncate">
                {{ car.rider.name }}
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {{ car.rider.carModel || 'Auto' }} • Partenza: {{ car.rider.departureLocation || 'Non specificato' }}
              </div>
            </div>
            <span
              class="shrink-0 text-xs font-bold rounded-full px-2 py-0.5"
              :class="car.isFull ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'"
            >
              {{ car.isFull ? 'Al completo' : `${car.availableSeats} liberi` }}
            </span>
          </button>
        </div>
      </template>
    </UModal>

    <!-- Participant Modal -->
    <ParticipantModal
      v-model:open="isModalOpen"
      :initial-data="modalInitialData"
      :is-organizer-action="isOrganizerAction"
      @submit="handleParticipantSubmit"
    />

    <!-- Device Sync / QR Code / Personal Link Modal -->
    <DeviceSyncModal
      v-model:open="showDeviceSyncModal"
      :event="currentEvent"
      :participant="myParticipant"
      :is-new-join="isNewJoin"
    />

    <!-- Reconnect Profile Modal (Cross-device access) -->
    <ReconnectModal
      v-model:open="showReconnectModal"
      :participants="allParticipants"
      :preselected-participant-id="preselectedParticipantId"
      @reconnected="loadEvent(eventIdOrSlug)"
    />

    <!-- Edit Event Modal (Organizer only) -->
    <EditEventModal
      v-model:open="showEditEventModal"
      :event="currentEvent"
      @saved="loadEvent(eventIdOrSlug)"
    />

    <!-- Passenger Info Detail Modal -->
    <PassengerInfoModal
      v-model:open="showPassengerModal"
      :passenger="selectedPassenger"
      :car="selectedPassengerCar"
      :is-organizer="isOrganizer"
      :my-participant="myParticipant"
      @claim="handleClaimParticipant"
      @edit="handleEditCar"
      @remove-from-car="handleOrganizerRemovePassengerFromCar"
      @reassign="openAssignModal"
      @delete="handleOrganizerDeletePassenger"
    />
  </div>
</template>
