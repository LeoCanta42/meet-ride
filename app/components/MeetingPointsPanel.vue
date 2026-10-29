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
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(mp: ManualMeetingPoint) {
  editingId.value = mp.id
  mpName.value = mp.name || ''
  mpTime.value = mp.time || ''
  mpNotes.value = mp.notes || ''
  selectedRiderIds.value = [...(mp.riderIds || [])]
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

function handleSaveModal() {
  const cleanName = mpName.value.trim()
  if (!cleanName) {
    formError.value = 'Inserisci il nome o luogo del punto di ritrovo.'
    return
  }
  if (selectedRiderIds.value.length < 2) {
    formError.value = 'Seleziona almeno 2 auto da far incontrare in questo punto di ritrovo.'
    return
  }

  const chosenSet = new Set(selectedRiderIds.value)
  const currentId = editingId.value || `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Remove selected cars from any other meeting point so each car belongs to at most 1 meeting point
  const otherUpdated = meetingPoints.value
    .filter(mp => mp.id !== editingId.value)
    .map(mp => ({
      ...mp,
      riderIds: (mp.riderIds || []).filter(rid => !chosenSet.has(rid))
    }))
    .filter(mp => mp.riderIds.length >= 2)

  const prev = meetingPoints.value.find(mp => mp.id === editingId.value)
  const nameChanged = !prev || prev.name.trim().toLowerCase() !== cleanName.toLowerCase()

  const newMp: ManualMeetingPoint = {
    id: currentId,
    name: cleanName,
    time: mpTime.value.trim() || undefined,
    notes: mpNotes.value.trim() || undefined,
    riderIds: [...selectedRiderIds.value],
    coords: nameChanged ? null : (prev?.coords || null)
  }

  emit('save', [...otherUpdated, newMp])
  isModalOpen.value = false
}

function handleDeleteMeetingPoint(mpId: string) {
  const updated = meetingPoints.value.filter(mp => mp.id !== mpId)
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
              {{ isOrganizer ? '2. Punti di Ritrovo tra Auto (Manuali)' : 'Punti di Ritrovo tra Auto' }}
            </h4>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {{ meetingPoints.length === 0 ? 'Nessun ritrovo (auto dritte a destinazione)' : `${meetingPoints.length} ritrov${meetingPoints.length === 1 ? 'o' : 'i'} configurat${meetingPoints.length === 1 ? 'o' : 'i'}` }}
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
            <template v-if="isOrganizer">
              Seleziona specifiche auto per farle incontrare in un punto intermedio e viaggiare in convoglio. Se non imposti punti di ritrovo, le auto andranno dritte a destinazione.
            </template>
            <template v-else>
              Punti di incontro stabiliti dall'organizzatore per riunire le auto lungo il tragitto verso la destinazione.
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
          :disabled="cars.length < 2"
          @click="openCreateModal"
          class="font-bold text-xs w-full sm:w-auto justify-center border-amber-400/80 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer"
          :title="cars.length < 2 ? 'Servono almeno 2 auto registrate per creare un punto di ritrovo' : 'Crea un punto di ritrovo per specifiche auto'"
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
        class="rounded-2xl border border-amber-200/80 bg-white/90 p-3.5 shadow-2xs dark:border-amber-900/40 dark:bg-slate-900/80 flex flex-col justify-between gap-2.5"
      >
        <div class="space-y-2">
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

          <!-- Participating Cars Chips -->
          <div class="flex flex-wrap gap-1.5 pt-1">
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
    </div>

    <!-- Create / Edit Meeting Point Modal -->
    <UModal
      :open="isModalOpen"
      @update:open="isModalOpen = $event"
      :title="editingId ? 'Modifica Punto di Ritrovo' : 'Nuovo Punto di Ritrovo tra Auto'"
      description="Scegli quali auto devono incontrarsi e in quale località intermedia prima di raggiungere la destinazione."
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
                placeholder="es. Misterbianco / Casello Melegnano"
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
              placeholder="es. Parcheggio davanti al bar, ci aspettiamo lì"
              icon="i-lucide-message-square"
              class="w-full"
            />
          </div>

          <!-- Car Selection Checkboxes -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Seleziona le auto da riunire qui (minimo 2) *
              </label>
              <span class="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {{ selectedRiderIds.length }} selezionat{{ selectedRiderIds.length === 1 ? 'a' : 'e' }}
              </span>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <button
                v-for="car in cars"
                :key="car.rider.id"
                type="button"
                @click="toggleCarSelection(car.rider.id)"
                class="w-full p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2.5 cursor-pointer"
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
