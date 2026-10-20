<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'
import type { Participant } from '~/types'

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
  leaveEvent,
  selectCar
} = useEvent()

const toast = useToast()
const unlockError = ref('')
const unlocking = ref(false)
const isModalOpen = ref(false)
const showReconnectModal = ref(false)
const modalInitialData = ref<Participant | null>(null)
const actionLoading = ref(false)

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

function copyPersonalLink() {
  if (!currentEvent.value || !myParticipant.value?.token) return
  const origin = window.location.origin
  const path = `/events/${currentEvent.value.slug || currentEvent.value.id}`
  const url = `${origin}${path}?p=${myParticipant.value.token}`
  navigator.clipboard.writeText(url)
  toast.add({
    title: 'Link personale copiato!',
    description: 'Aprilo su un altro dispositivo per gestire subito la tua auto o il tuo posto.',
    color: 'success'
  })
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
  modalInitialData.value = {
    role,
    name: '',
    id: '',
    eventId: currentEvent.value?.id || '',
    createdAt: ''
  } as Participant
  isModalOpen.value = true
}

function openEditModal() {
  if (!myParticipant.value) return
  modalInitialData.value = { ...myParticipant.value }
  isModalOpen.value = true
}

async function handleParticipantSubmit(data: Partial<Participant>) {
  const res = await registerParticipant(data)
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
  actionLoading.value = true
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
    actionLoading.value = false
  }
}

async function handleLeaveCar() {
  actionLoading.value = true
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
    actionLoading.value = false
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
    <div v-else-if="currentEvent" class="space-y-6 sm:space-y-8">
      <!-- Event Hero / Header -->
      <div class="surface-card relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2">
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

            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {{ currentEvent.title }}
            </h1>

            <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              <UIcon name="i-lucide-map-pin" class="h-4 w-4 text-sky-500 shrink-0" />
              <span>{{ currentEvent.destination }}</span>
            </div>

            <p v-if="currentEvent.description" class="text-xs text-slate-500 dark:text-slate-400 pt-1 max-w-2xl leading-relaxed">
              {{ currentEvent.description }}
            </p>
          </div>

          <!-- Share & Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              color="neutral"
              variant="subtle"
              size="md"
              @click="copyShareLink"
              class="font-semibold text-xs"
            >
              <UIcon name="i-lucide-share-2" class="h-4 w-4 mr-1.5" />
              {{ t('events.shareTitle') }}
            </UButton>
          </div>
        </div>

        <!-- Quick Stats Overview -->
        <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div class="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">{{ t('eventView.statCars') }}</span>
            <span class="text-lg font-bold text-slate-900 dark:text-white">{{ cars.length }}</span>
          </div>

          <div class="rounded-xl bg-slate-50/80 p-3 dark:bg-slate-800/40">
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">{{ t('eventView.statTotalSeats') }}</span>
            <span class="text-lg font-bold text-slate-900 dark:text-white">{{ totalSeats }}</span>
          </div>

          <div class="rounded-xl bg-emerald-50/60 p-3 dark:bg-emerald-950/30">
            <span class="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block">{{ t('eventView.statAvailable') }}</span>
            <span class="text-lg font-bold text-emerald-800 dark:text-emerald-300">{{ totalAvailableSeats }}</span>
          </div>

          <div class="rounded-xl bg-amber-50/60 p-3 dark:bg-amber-950/30">
            <span class="text-[11px] font-medium text-amber-700 dark:text-amber-400 block">{{ t('eventView.statUnassigned') }}</span>
            <span class="text-lg font-bold text-amber-800 dark:text-amber-300">{{ unassignedPassengers.length }}</span>
          </div>
        </div>
      </div>

      <!-- Current Participant Status & Actions -->
      <div class="surface-card rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <!-- Already registered user -->
        <div v-if="myParticipant" class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold"
              :class="myParticipant.role === 'rider' ? 'bg-emerald-600' : 'bg-sky-600'"
            >
              <UIcon :name="myParticipant.role === 'rider' ? 'i-lucide-car' : 'i-lucide-user'" class="h-6 w-6" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ t('eventView.myStatus') }}</span>
                <span class="font-bold text-slate-900 dark:text-white text-sm">
                  {{ myParticipant.name }}
                </span>
                <span
                  class="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  :class="myParticipant.role === 'rider' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'"
                >
                  {{ myParticipant.role === 'rider' ? 'Guidatore' : 'Passeggero' }}
                </span>
              </div>

              <!-- Position / car note -->
              <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                <span v-if="myParticipant.role === 'rider'">
                  {{ myParticipant.carModel }} ({{ myParticipant.totalSeats }} posti) — Partenza da: {{ myParticipant.departureLocation || 'Non specificato' }}
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

          <div class="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="copyPersonalLink"
              class="text-xs font-semibold"
              title="Copia link personale per gestire la tua auto o posto da altri dispositivi"
            >
              <UIcon name="i-lucide-smartphone" class="h-3.5 w-3.5 mr-1 text-sky-500" />
              <span>Link altri dispositivi</span>
            </UButton>

            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="openEditModal"
              class="text-xs font-semibold flex-1 sm:flex-initial"
            >
              <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 mr-1" />
              {{ t('eventView.editParticipation') }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="sm"
              :loading="actionLoading"
              @click="handleLeaveEvent"
              class="text-xs font-semibold"
              :title="t('eventView.leaveParticipation')"
            >
              <UIcon name="i-lucide-trash-2" class="h-3.5 w-3.5" />
            </UButton>
          </div>
        </div>

        <!-- Not registered yet: Big Join Prompts -->
        <div v-else class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Vuoi partecipare a questo evento?
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Offri la tua auto o cerca un passaggio comodo con gli altri partecipanti.
            </p>
            <div v-if="allParticipants.length > 0" class="mt-2">
              <button
                type="button"
                @click="showReconnectModal = true"
                class="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1.5"
              >
                <UIcon name="i-lucide-smartphone" class="h-3.5 w-3.5 text-sky-500" />
                <span>Sei già in lista da un altro dispositivo? Riconnetti il tuo profilo</span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <UButton
              color="primary"
              variant="solid"
              size="md"
              @click="openJoinModal('passenger')"
              class="font-semibold text-xs shadow-sm flex-1 sm:flex-initial"
            >
              {{ t('eventView.iNeedRide') }}
            </UButton>

            <UButton
              color="neutral"
              variant="outline"
              size="md"
              @click="openJoinModal('rider')"
              class="font-semibold text-xs flex-1 sm:flex-initial"
            >
              {{ t('eventView.imDriving') }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Smart Seat Allocation Optimizer (Organizer only) -->
      <OptimizationPanel
        v-if="isOrganizer"
        :event-id="currentEvent.id"
        :is-organizer="isOrganizer"
        @optimized="loadEvent(currentEvent.id)"
      />

      <!-- Cars Grid Section -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-car" class="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ t('eventView.carsTitle') }}
            </h2>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {{ cars.length }}
            </span>
          </div>

          <UButton
            v-if="!myParticipant || myParticipant.role !== 'rider'"
            color="primary"
            variant="ghost"
            size="xs"
            @click="openJoinModal('rider')"
            class="font-semibold"
          >
            <UIcon name="i-lucide-plus" class="h-3.5 w-3.5 mr-1" />
            {{ t('eventView.imDriving') }}
          </UButton>
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
          <UButton
            color="primary"
            size="sm"
            @click="openJoinModal('rider')"
            class="mt-4 font-semibold text-xs"
          >
            {{ t('eventView.imDriving') }}
          </UButton>
        </div>

        <!-- Cars Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CarCard
            v-for="car in cars"
            :key="car.rider.id"
            :car="car"
            :my-participant="myParticipant"
            :loading="actionLoading"
            @select-car="handleSelectCar"
            @leave-car="handleLeaveCar"
            @prompt-join="openJoinModal('passenger')"
          />
        </div>
      </div>

      <!-- Unassigned Passengers Section -->
      <div class="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="h-5 w-5 text-amber-500" />
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ t('eventView.unassignedTitle') }}
            </h2>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {{ unassignedPassengers.length }}
            </span>
          </div>

          <UButton
            v-if="!myParticipant || myParticipant.role !== 'passenger'"
            color="primary"
            variant="ghost"
            size="xs"
            @click="openJoinModal('passenger')"
            class="font-semibold"
          >
            <UIcon name="i-lucide-plus" class="h-3.5 w-3.5 mr-1" />
            {{ t('eventView.iNeedRide') }}
          </UButton>
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
            class="surface-card rounded-xl p-3.5 space-y-1.5 border border-slate-200/80 dark:border-slate-800"
            :class="passenger.id === myParticipant?.id ? 'ring-2 ring-amber-500 bg-amber-50/20 dark:bg-amber-950/20' : ''"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-900 dark:text-white text-xs">{{ passenger.name }}</span>
              <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                In cerca
              </span>
            </div>

            <div v-if="passenger.pickupLocation" class="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
              <span class="truncate">{{ passenger.pickupLocation }}</span>
            </div>

            <div v-if="passenger.notes" class="text-[11px] text-slate-500 dark:text-slate-400 italic truncate">
              "{{ passenger.notes }}"
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Participant Modal -->
    <ParticipantModal
      v-model:open="isModalOpen"
      :initial-data="modalInitialData"
      @submit="handleParticipantSubmit"
    />

    <!-- Reconnect Profile Modal (Cross-device access) -->
    <ReconnectModal
      v-model:open="showReconnectModal"
      :participants="allParticipants"
      @reconnected="loadEvent(eventIdOrSlug)"
    />
  </div>
</template>
