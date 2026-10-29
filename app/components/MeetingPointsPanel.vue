<script setup lang="ts">
import type { EventItem, CarWithSeats, ManualMeetingPoint } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  event: EventItem
  cars: CarWithSeats[]
  isOrganizer: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', meetingPoints: ManualMeetingPoint[]): void
}>()

const { t } = useI18n()

const isModalOpen = ref(false)
const editingId = ref<string | null>(null)
const mpName = ref('')
const mpTime = ref('')
const mpNotes = ref('')
const selectedRiderIds = ref<string[]>([])
const selectedMeetingPointIds = ref<string[]>([])
const formError = ref('')

const meetingPoints = computed<ManualMeetingPoint[]>(() => {
  return Array.isArray(props.event.meetingPoints) ? props.event.meetingPoints : []
})

function getCarByRiderId(riderId: string): CarWithSeats | undefined {
  return props.cars.find(c => c.rider.id === riderId)
}

function getCarLabel(riderId: string): string {
  const car = getCarByRiderId(riderId)
  if (!car) return 'Auto'
  return `${car.rider.carModel || 'Auto'} di ${car.rider.name}`
}

function getAllRiderIdsForMp(mpId: string, visited = new Set<string>()): string[] {
  if (visited.has(mpId)) return []
  visited.add(mpId)
  const mp = meetingPoints.value.find(m => m.id === mpId)
  if (!mp) return []
  const result = new Set<string>(mp.riderIds || [])
  for (const childId of mp.meetingPointIds || []) {
    for (const rId of getAllRiderIdsForMp(childId, visited)) {
      result.add(rId)
    }
  }
  return Array.from(result)
}

function getMpCarsLabelSummary(mpId: string): string {
  const rIds = getAllRiderIdsForMp(mpId)
  if (rIds.length === 0) return 'Nessuna auto'
  return rIds.map(getCarLabel).join(', ')
}

function getDownstreamMeetingPoint(mpId: string): ManualMeetingPoint | undefined {
  return meetingPoints.value.find(
    mp => mp.id !== mpId && (mp.meetingPointIds || []).includes(mpId)
  )
}

function wouldCreateCycle(candidateChildId: string, targetParentId: string | null): boolean {
  if (!targetParentId) return false
  if (candidateChildId === targetParentId) return true
  const visited = new Set<string>()
  function check(currentId: string): boolean {
    if (visited.has(currentId)) return false
    visited.add(currentId)
    const mp = meetingPoints.value.find(m => m.id === currentId)
    if (!mp) return false
    if ((mp.meetingPointIds || []).includes(targetParentId!)) return true
    return (mp.meetingPointIds || []).some(mId => check(mId))
  }
  return check(candidateChildId)
}

const availableMeetingPointsForMerging = computed(() => {
  return meetingPoints.value.filter(mp => {
    if (mp.id === editingId.value) return false
    if (wouldCreateCycle(mp.id, editingId.value)) return false
    return true
  })
})

function getOtherMeetingPointForCar(riderId: string): ManualMeetingPoint | undefined {
  return meetingPoints.value.find(
    mp => mp.id !== editingId.value && (mp.riderIds || []).includes(riderId)
  )
}

function openCreateModal() {
  editingId.value = null
  mpName.value = ''
  mpTime.value = ''
  mpNotes.value = ''
  selectedRiderIds.value = []
  selectedMeetingPointIds.value = []
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(mp: ManualMeetingPoint) {
  editingId.value = mp.id
  mpName.value = mp.name || ''
  mpTime.value = mp.time || ''
  mpNotes.value = mp.notes || ''
  selectedRiderIds.value = [...(mp.riderIds || [])]
  selectedMeetingPointIds.value = [...(mp.meetingPointIds || [])]
  formError.value = ''
  isModalOpen.value = true
}

function toggleCarSelection(riderId: string) {
  const idx = selectedRiderIds.value.indexOf(riderId)
  if (idx !== -1) {
    selectedRiderIds.value.splice(idx, 1)
  } else {
    selectedRiderIds.value.push(riderId)
  }
  formError.value = ''
}

function toggleMeetingPointSelection(mpId: string) {
  const idx = selectedMeetingPointIds.value.indexOf(mpId)
  if (idx !== -1) {
    selectedMeetingPointIds.value.splice(idx, 1)
  } else {
    selectedMeetingPointIds.value.push(mpId)
  }
  formError.value = ''
}

function handleSaveModal() {
  const cleanName = mpName.value.trim()
  if (!cleanName) {
    formError.value = 'Inserisci il nome o luogo del punto di ritrovo.'
    return
  }

  const totalSelected = selectedRiderIds.value.length + selectedMeetingPointIds.value.length
  if (totalSelected < 2) {
    formError.value = 'Seleziona almeno 2 elementi (auto o altri punti di ritrovo) da far incontrare.'
    return
  }

  const chosenRiderSet = new Set(selectedRiderIds.value)
  const chosenMpSet = new Set(selectedMeetingPointIds.value)
  const currentId = editingId.value || `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Update other meeting points:
  // - remove selected cars from their riderIds
  // - remove selected meeting points from their meetingPointIds
  // - remove currentId from their meetingPointIds if previously assigned
  let otherUpdated = meetingPoints.value
    .filter(mp => mp.id !== editingId.value)
    .map(mp => ({
      ...mp,
      riderIds: (mp.riderIds || []).filter(rid => !chosenRiderSet.has(rid)),
      meetingPointIds: (mp.meetingPointIds || []).filter(mid => !chosenMpSet.has(mid) && mid !== currentId)
    }))
    .filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)

  // Ensure meetingPointIds in otherUpdated only reference existing meeting points
  const survivingIds = new Set([...otherUpdated.map(m => m.id), currentId])
  otherUpdated = otherUpdated.map(mp => ({
    ...mp,
    meetingPointIds: (mp.meetingPointIds || []).filter(mid => survivingIds.has(mid))
  })).filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)

  const prev = meetingPoints.value.find(mp => mp.id === editingId.value)
  const nameChanged = !prev || prev.name.trim().toLowerCase() !== cleanName.toLowerCase()

  const newMp: ManualMeetingPoint = {
    id: currentId,
    name: cleanName,
    time: mpTime.value.trim() || undefined,
    notes: mpNotes.value.trim() || undefined,
    riderIds: [...selectedRiderIds.value],
    meetingPointIds: [...selectedMeetingPointIds.value],
    coords: nameChanged ? null : (prev?.coords || null)
  }

  emit('save', [...otherUpdated, newMp])
  isModalOpen.value = false
}

function handleDeleteMeetingPoint(mpId: string) {
  let updated = meetingPoints.value
    .filter(mp => mp.id !== mpId)
    .map(mp => ({
      ...mp,
      meetingPointIds: (mp.meetingPointIds || []).filter(id => id !== mpId)
    }))
    .filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)

  const survivingIds = new Set(updated.map(m => m.id))
  updated = updated.map(mp => ({
    ...mp,
    meetingPointIds: (mp.meetingPointIds || []).filter(id => survivingIds.has(id))
  })).filter(mp => (mp.riderIds.length + (mp.meetingPointIds?.length || 0)) >= 2)

  emit('save', updated)
}
</script>

<template>
  <div
    v-if="isOrganizer || meetingPoints.length > 0"
    class="surface-card rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-200/80 bg-gradient-to-r from-amber-50/50 via-white to-orange-50/30 dark:border-amber-900/50 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/15 space-y-4"
  >
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-start sm:items-center gap-3 min-w-0">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20">
          <UIcon name="i-lucide-handshake" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
              {{ isOrganizer ? '2. Punti di Ritrovo tra Auto & Convogli (Manuali)' : 'Punti di Ritrovo tra Auto & Convogli' }}
            </h4>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {{ meetingPoints.length === 0 ? 'Nessun ritrovo (auto dritte a destinazione)' : `${meetingPoints.length} ritrov${meetingPoints.length === 1 ? 'o' : 'i'} configurat${meetingPoints.length === 1 ? 'o' : 'i'}` }}
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
            <template v-if="isOrganizer">
              Crea punti di incontro intermedi per specifiche auto o convogli già formati. Ogni punto di ritrovo unito si muoverà come un unico convoglio fino al ritrovo successivo o a destinazione.
            </template>
            <template v-else>
              Punti di incontro stabiliti dall'organizzatore per riunire auto e convogli lungo il tragitto verso la destinazione.
            </template>
          </p>
        </div>
      </div>

      <div v-if="isOrganizer" class="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <UButton
          color="primary"
          variant="outline"
          size="sm"
          :loading="saving"
          :disabled="cars.length + meetingPoints.length < 2"
          @click="openCreateModal"
          class="font-bold text-xs w-full sm:w-auto justify-center border-amber-400/80 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer"
          :title="cars.length + meetingPoints.length < 2 ? 'Servono almeno 2 auto o punti di ritrovo registrati' : 'Crea un punto di ritrovo per specifiche auto o per unire altri convogli'"
        >
          <UIcon name="i-lucide-plus" class="h-4 w-4 mr-1 shrink-0" />
          <span>Organizza Punto di Ritrovo</span>
        </UButton>
      </div>
    </div>

    <!-- Configured Meeting Points List -->
    <div v-if="meetingPoints.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
      <div
        v-for="mp in meetingPoints"
        :key="mp.id"
        class="rounded-2xl border border-amber-200/80 bg-white/90 p-3.5 shadow-2xs dark:border-amber-900/40 dark:bg-slate-900/80 flex flex-col justify-between gap-3"
      >
        <div class="space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>{{ mp.name }}</span>
                </span>
                <span
                  v-if="mp.time"
                  class="rounded-md bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300"
                >
                  Ore {{ mp.time }}
                </span>
                <span
                  v-else
                  class="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
                >
                  Orario calcolato da AI
                </span>
              </div>
              <p v-if="mp.notes" class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                "{{ mp.notes }}"
              </p>
            </div>

            <!-- Organizer Edit / Delete controls -->
            <div v-if="isOrganizer" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Modifica punto di ritrovo"
                @click="openEditModal(mp)"
              >
                <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Rimuovi punto di ritrovo"
                @click="handleDeleteMeetingPoint(mp.id)"
              >
                <UIcon name="i-lucide-trash-2" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Flow / Next step indicator -->
          <div class="text-[11px] font-semibold flex items-center gap-1.5">
            <template v-if="getDownstreamMeetingPoint(mp.id)">
              <span class="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
                <UIcon name="i-lucide-arrow-right" class="h-3 w-3" />
                <span>Confluisce nel ritrovo: <strong>{{ getDownstreamMeetingPoint(mp.id)?.name }}</strong></span>
              </span>
            </template>
            <template v-else>
              <span class="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
                <UIcon name="i-lucide-flag" class="h-3 w-3" />
                <span>Verso la destinazione: <strong>{{ event.destination }}</strong></span>
              </span>
            </template>
          </div>

          <!-- Incoming Convoys from other Meeting Points (if any) -->
          <div v-if="mp.meetingPointIds && mp.meetingPointIds.length > 0" class="space-y-1">
            <div class="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <UIcon name="i-lucide-git-merge" class="h-3 w-3" />
              <span>Convogli già uniti in arrivo qui:</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="mid in mp.meetingPointIds"
                :key="mid"
                class="inline-flex items-center gap-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-300/80 dark:border-purple-800/60 px-2 py-0.5 text-[11px] font-semibold text-purple-900 dark:text-purple-200"
              >
                <UIcon name="i-lucide-handshake" class="h-3 w-3 text-purple-600 shrink-0" />
                <span class="font-bold">Da "{{ meetingPoints.find(m => m.id === mid)?.name || 'Ritrovo' }}"</span>
                <span class="text-[10px] opacity-75 font-normal">({{ getMpCarsLabelSummary(mid) }})</span>
              </span>
            </div>
          </div>

          <!-- Direct Participating Cars -->
          <div v-if="mp.riderIds && mp.riderIds.length > 0" class="space-y-1">
            <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <UIcon name="i-lucide-car" class="h-3 w-3" />
              <span>Auto che arrivano direttamente qui:</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="rid in mp.riderIds"
                :key="rid"
                class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
              >
                <UIcon name="i-lucide-car" class="h-3 w-3 shrink-0" />
                <span class="truncate max-w-[200px]">{{ getCarLabel(rid) }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Footer Total -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span>Totale nel convoglio:</span>
          <span class="font-bold text-amber-700 dark:text-amber-300">
            {{ getAllRiderIdsForMp(mp.id).length }} {{ getAllRiderIdsForMp(mp.id).length === 1 ? 'auto' : 'auto' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Create / Edit Meeting Point Modal -->
    <UModal
      :open="isModalOpen"
      @update:open="isModalOpen = $event"
      :title="editingId ? 'Modifica Punto di Ritrovo' : 'Nuovo Punto di Ritrovo tra Auto & Convogli'"
      description="Scegli quali auto o convogli già formati devono incontrarsi in questo punto intermedio."
      :ui="{ content: 'sm:max-w-lg max-h-[90dvh] overflow-y-auto' }"
    >
      <template #body>
        <form @submit.prevent="handleSaveModal" class="space-y-4">
          <div
            v-if="formError"
            class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {{ formError }}
          </div>

          <!-- Location & Optional Time -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Luogo / Località del Ritrovo *
              </label>
              <UInput
                v-model="mpName"
                placeholder="es. Casello Palazzolo / Autogrill Dalmine"
                icon="i-lucide-map-pin"
                required
                class="w-full"
                autofocus
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Orario (opz.)
              </label>
              <UInput
                v-model="mpTime"
                type="time"
                placeholder="19:45"
                icon="i-lucide-clock"
                class="w-full font-mono"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Note o punto esatto (opzionale)
            </label>
            <UInput
              v-model="mpNotes"
              placeholder="es. Parcheggio all'uscita del casello"
              icon="i-lucide-message-square"
              class="w-full"
            />
          </div>

          <!-- Total Selection Counter Badge -->
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              Seleziona cosa riunire in questo ritrovo (minimo 2 elementi):
            </span>
            <span
              class="text-xs font-bold px-2 py-0.5 rounded-full"
              :class="selectedRiderIds.length + selectedMeetingPointIds.length >= 2
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'"
            >
              {{ selectedRiderIds.length + selectedMeetingPointIds.length }} selezionat{{ selectedRiderIds.length + selectedMeetingPointIds.length === 1 ? 'o' : 'i' }}
            </span>
          </div>

          <!-- Section 1: Merge Existing Meeting Points (Convoys) -->
          <div v-if="availableMeetingPointsForMerging.length > 0" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <UIcon name="i-lucide-git-merge" class="h-3.5 w-3.5" />
                <span>Unisci Punti di Ritrovo Esistenti (Convogli Già Formati)</span>
              </label>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 leading-tight">
              Unendo un altro punto di ritrovo, il suo convoglio proseguirà insieme fino a questo nuovo punto per unirsi alle altre auto.
            </p>

            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <button
                v-for="otherMp in availableMeetingPointsForMerging"
                :key="otherMp.id"
                type="button"
                @click="toggleMeetingPointSelection(otherMp.id)"
                class="w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2.5 cursor-pointer"
                :class="selectedMeetingPointIds.includes(otherMp.id)
                  ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'"
              >
                <div class="flex items-start gap-2.5 min-w-0">
                  <div
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs transition-colors"
                    :class="selectedMeetingPointIds.includes(otherMp.id)
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'"
                  >
                    <UIcon v-if="selectedMeetingPointIds.includes(otherMp.id)" name="i-lucide-check" class="h-3.5 w-3.5" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <UIcon name="i-lucide-handshake" class="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span>Convoglio da "{{ otherMp.name }}"</span>
                      <span v-if="otherMp.time" class="text-[10px] text-slate-500">({{ otherMp.time }})</span>
                    </div>
                    <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                      🚗 Auto: {{ getMpCarsLabelSummary(otherMp.id) }}
                    </div>
                    <div
                      v-if="getDownstreamMeetingPoint(otherMp.id) && getDownstreamMeetingPoint(otherMp.id)?.id !== editingId"
                      class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5"
                    >
                      Attualmente confluisce in "{{ getDownstreamMeetingPoint(otherMp.id)?.name }}" (verrà spostato qui)
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Section 2: Direct Single Cars Selection -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UIcon name="i-lucide-car" class="h-3.5 w-3.5 text-amber-500" />
                <span>Auto Singole (che arrivano direttamente a questo ritrovo)</span>
              </label>
            </div>

            <div class="space-y-2 max-h-52 overflow-y-auto pr-1">
              <button
                v-for="car in cars"
                :key="car.rider.id"
                type="button"
                @click="toggleCarSelection(car.rider.id)"
                class="w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2.5 cursor-pointer"
                :class="selectedRiderIds.includes(car.rider.id)
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'"
              >
                <div class="flex items-start gap-2.5 min-w-0">
                  <div
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs transition-colors"
                    :class="selectedRiderIds.includes(car.rider.id)
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'"
                  >
                    <UIcon v-if="selectedRiderIds.includes(car.rider.id)" name="i-lucide-check" class="h-3.5 w-3.5" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {{ car.rider.carModel || 'Auto' }} di {{ car.rider.name }}
                    </div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      📍 Partenza: {{ car.rider.departureLocation || 'Non specificata' }}
                    </div>
                    <div v-if="car.passengers.length > 0" class="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5 truncate">
                      👥 A bordo: {{ car.passengers.map(p => p.name).join(', ') }}
                    </div>
                    <div
                      v-if="getOtherMeetingPointForCar(car.rider.id)"
                      class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5"
                    >
                      Attualmente in "{{ getOtherMeetingPointForCar(car.rider.id)?.name }}" (verrà spostata qui)
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="isModalOpen = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              size="sm"
              class="font-bold text-xs"
            >
              <UIcon name="i-lucide-check" class="h-4 w-4 mr-1" />
              {{ editingId ? 'Salva Modifiche' : 'Crea Punto di Ritrovo' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
