<script setup lang="ts">
import type { CarWithSeats, Participant } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  car: CarWithSeats
  myParticipant?: Participant | null
  loading?: boolean
  isOrganizer?: boolean
  isDragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-car', riderId: string): void
  (e: 'leave-car'): void
  (e: 'prompt-join', riderId?: string): void
  (e: 'claim-participant', participantId: string): void
  (e: 'edit-car', rider: Participant): void
  (e: 'delete-car', riderId: string): void
  (e: 'remove-passenger', passengerId: string): void
  (e: 'show-passenger', passenger: Participant, car: CarWithSeats): void
  (e: 'become-driver', riderId: string): void
  (e: 'step-down-driver', riderId: string): void
  (e: 'assign-driver', riderId: string): void
  (e: 'remove-driver', riderId: string): void
  (e: 'drag-start', event: DragEvent, payload: { passengerId: string; passengerName: string; fromRiderId?: string | null; isDriver?: boolean }): void
  (e: 'drop-on-car', targetRiderId: string, event: DragEvent): void
  (e: 'drop-on-driver', targetRiderId: string, event: DragEvent): void
}>()

const { t } = useI18n()

const isDragOverCar = ref(false)
const isDragOverDriver = ref(false)

const isMyCar = computed(() => {
  if (!props.myParticipant && !props.car.rider.token) return false
  return (
    props.myParticipant?.id === props.car.rider.id ||
    (Boolean(props.car.rider.ownerParticipantId) && props.car.rider.ownerParticipantId === props.myParticipant?.id) ||
    Boolean(props.car.rider.token && props.myParticipant?.token && props.car.rider.token === props.myParticipant.token)
  )
})

const isDriverOfThisCar = computed(() => {
  if (!props.myParticipant) return false
  if (props.car.driver && props.car.driver.id === props.myParticipant.id) return true
  return Boolean(props.car.hasDriver !== false && props.car.rider.id === props.myParticipant.id)
})

const hasDriver = computed(() => {
  return Boolean(props.car.hasDriver !== false && props.car.driver)
})

const isSeatedInThisCar = computed(() => {
  if (!props.myParticipant) return false
  return props.car.passengers.some((p: Participant) => p.id === props.myParticipant?.id)
})

const totalCarPrice = computed<number | null>(() => {
  if (props.car.totalPrice !== undefined && props.car.totalPrice !== null && props.car.totalPrice > 0) {
    return props.car.totalPrice
  }
  if (props.car.rider.price !== undefined && props.car.rider.price !== null && props.car.rider.price > 0) {
    return Number(props.car.rider.price)
  }
  return null
})

// Total people currently in the car = (1 if driver else 0) + occupied passenger seats
const peopleInCar = computed<number>(() => {
  return props.car.peopleCount || ((hasDriver.value ? 1 : 0) + props.car.occupiedSeats)
})

// Automatically calculated price per person based on how many people are currently in the car
const currentPricePerPerson = computed<number | null>(() => {
  if (totalCarPrice.value === null) return null
  return Math.round((totalCarPrice.value / Math.max(1, peopleInCar.value)) * 100) / 100
})

// Price per person if 1 more passenger joins
const nextJoinPricePerPerson = computed<number | null>(() => {
  if (totalCarPrice.value === null || props.car.isFull) return null
  return Math.round((totalCarPrice.value / (peopleInCar.value + 1)) * 100) / 100
})

function formatEuro(val: number | null | undefined): string {
  if (val === null || val === undefined) return '0'
  return Number.isInteger(val) ? `${val}` : val.toFixed(2)
}

const effectiveDriverPhone = computed(() => {
  return props.car.driver?.phone || props.car.rider.phone || ''
})

const cleanDriverPhone = computed(() => {
  if (!effectiveDriverPhone.value) return ''
  return effectiveDriverPhone.value.replace(/[\s()-]/g, '')
})

const driverWaLink = computed(() => {
  if (!cleanDriverPhone.value) return ''
  const digits = cleanDriverPhone.value.replace(/\+/g, '')
  return `https://wa.me/${digits}`
})

const canJoinCar = computed(() => {
  if (isMyCar.value || isDriverOfThisCar.value || isSeatedInThisCar.value || props.car.isFull) return false
  if (props.myParticipant && props.myParticipant.role === 'rider') return false
  return true
})

function handleSeatAction() {
  if (!props.myParticipant) {
    emit('prompt-join', props.car.rider.id)
    return
  }

  if (isSeatedInThisCar.value) {
    emit('leave-car')
  } else if (props.myParticipant.role === 'passenger') {
    emit('select-car', props.car.rider.id)
  }
}

// Drag and drop handlers
function onDragOverCar(e: DragEvent) {
  isDragOverCar.value = true
}

function onDragLeaveCar(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (rect) {
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      isDragOverCar.value = false
    }
  } else {
    isDragOverCar.value = false
  }
}

function onDropCar(e: DragEvent) {
  isDragOverCar.value = false
  isDragOverDriver.value = false
  emit('drop-on-car', props.car.rider.id, e)
}

function onDragOverDriver(e: DragEvent) {
  isDragOverDriver.value = true
}

function onDragLeaveDriver(e: DragEvent) {
  isDragOverDriver.value = false
}

function onDropDriver(e: DragEvent) {
  isDragOverDriver.value = false
  isDragOverCar.value = false
  emit('drop-on-driver', props.car.rider.id, e)
}

function handlePassengerDragStart(e: DragEvent, p: Participant) {
  emit('drag-start', e, {
    passengerId: p.id,
    passengerName: p.name,
    fromRiderId: props.car.rider.id,
    isDriver: false
  })
}

function handleDriverDragStart(e: DragEvent, d: Participant) {
  emit('drag-start', e, {
    passengerId: d.id,
    passengerName: d.name,
    fromRiderId: props.car.rider.id,
    isDriver: true
  })
}

function canDragPassenger(p: Participant): boolean {
  if (props.isOrganizer) return true
  return props.myParticipant?.id === p.id
}

const canDragDriver = computed(() => {
  if (!props.car.driver) return false
  if (props.isOrganizer) return true
  return isDriverOfThisCar.value
})
</script>

<template>
  <div
    class="surface-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 transition-all"
    :class="[
      isSeatedInThisCar ? 'ring-2 ring-sky-500 bg-sky-50/20 dark:bg-sky-950/20' : '',
      isDriverOfThisCar ? 'ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' : '',
      isDragOverCar ? 'ring-2 ring-sky-500 border-sky-400 bg-sky-50/50 dark:bg-sky-950/40 shadow-lg scale-[1.01]' : 'hover:shadow-md'
    ]"
    @dragover.prevent="onDragOverCar"
    @dragleave="onDragLeaveCar"
    @drop.prevent="onDropCar"
  >
    <!-- Drag over overlay banner -->
    <div
      v-if="isDragOverCar && !isDragOverDriver"
      class="absolute top-2 right-2 rounded-full bg-sky-600 text-white text-[11px] font-bold px-3 py-1 shadow-md z-10 flex items-center gap-1.5 animate-pulse"
    >
      <UIcon name="i-lucide-arrow-down-circle" class="h-3.5 w-3.5" />
      <span>Rilascia per far salire a bordo</span>
    </div>

    <!-- Top banner / tags (responsive, no overlap on narrow screens) -->
    <div class="flex flex-wrap items-start justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div class="flex items-start gap-3 min-w-0 flex-1">
        <div
          class="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl font-bold"
          :class="!hasDriver
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            : 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'"
        >
          <UIcon :name="!hasDriver ? 'i-lucide-car' : 'i-lucide-car-front'" class="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white leading-tight truncate max-w-full">
              {{ car.rider.name }}
            </h4>
            <span
              v-if="!hasDriver"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 inline-flex items-center gap-1"
            >
              <UIcon name="i-lucide-alert-circle" class="h-3 w-3" />
              {{ isMyCar ? 'Messa a disposizione da te' : 'Senza autista' }}
            </span>
            <span
              v-else-if="isDriverOfThisCar"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 inline-flex items-center gap-1"
            >
              <UIcon name="i-tabler-steering-wheel" class="h-3 w-3" />
              {{ t('car.youAreTheDriver') }}
            </span>
            <span
              v-else-if="isSeatedInThisCar"
              class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300 shrink-0"
            >
              {{ t('car.youAreInThisCar') }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
            {{ car.rider.carModel || 'Auto' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Organizer or Owner Edit / Delete Controls -->
        <template v-if="isOrganizer || isMyCar">
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="isOrganizer ? 'Modifica vettura / guidatore' : 'Modifica questa vettura'"
            @click="emit('edit-car', car.rider)"
          >
            <UIcon name="i-lucide-pencil" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="isOrganizer ? 'Rimuovi vettura dall\'evento' : 'Rimuovi questa vettura'"
            @click="emit('delete-car', car.rider.id)"
          >
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
          </button>
        </template>

        <!-- Capacity pill -->
        <div
          class="rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-semibold"
          :class="car.isFull ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'"
        >
          <span v-if="car.isFull">{{ t('car.seatsFull') }}</span>
          <span v-else>{{ car.availableSeats }} / {{ car.totalSeats }} {{ t('car.seats') }}</span>
        </div>
      </div>
    </div>

    <!-- Price & Automatic Per-Person Split Banner -->
    <div
      v-if="totalCarPrice !== null"
      class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30"
    >
      <div class="flex items-center gap-2 min-w-0">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
          €
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-1.5">
            <span class="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
              €{{ formatEuro(currentPricePerPerson) }}
            </span>
            <span class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {{ t('car.pricePerPerson') }}
            </span>
          </div>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            {{ t('car.totalPrice') }}: €{{ formatEuro(totalCarPrice) }} ÷ {{ peopleInCar }} {{ peopleInCar === 1 ? t('car.personInCar') : t('car.peopleInCar') }}
          </p>
        </div>
      </div>

      <span
        v-if="!isSeatedInThisCar && !isDriverOfThisCar && !car.isFull && nextJoinPricePerPerson !== null"
        class="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-emerald-800 shadow-2xs dark:bg-slate-900/80 dark:text-emerald-300 shrink-0"
      >
        {{ t('car.splitWithNext') }}: €{{ formatEuro(nextJoinPricePerPerson) }}
      </span>
    </div>

    <!-- Departure Details -->
    <div class="my-3.5 space-y-2 text-xs">
      <div class="flex items-start gap-2 text-slate-600 dark:text-slate-300">
        <UIcon name="i-lucide-map-pin" class="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
        <div class="min-w-0 flex-1 break-words">
          <span class="font-semibold text-slate-500 dark:text-slate-400">{{ t('car.departure') }}:</span>
          <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">
            {{ car.rider.departureLocation || 'Non specificato' }}
          </span>
        </div>
      </div>

      <div v-if="effectiveDriverPhone" class="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
        <UIcon name="i-lucide-phone" class="h-4 w-4 shrink-0 text-emerald-500" />
        <a :href="'tel:' + cleanDriverPhone" class="hover:underline font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
          {{ effectiveDriverPhone }}
        </a>
        <a
          v-if="driverWaLink"
          :href="driverWaLink"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 transition-colors"
        >
          <UIcon name="i-lucide-message-circle" class="h-3 w-3 text-emerald-600" />
          <span>WhatsApp</span>
        </a>
      </div>

      <div v-if="car.rider.notes" class="flex items-start gap-2 text-slate-500 dark:text-slate-400 pt-0.5">
        <UIcon name="i-lucide-message-square" class="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
        <p class="text-[11px] italic break-words leading-snug">
          "{{ car.rider.notes }}"
        </p>
      </div>
    </div>

    <!-- Visual Seats Grid -->
    <div class="rounded-xl bg-slate-50 p-3 sm:p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <div class="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>{{ t('car.passengersList') }}</span>
        <span>{{ car.occupiedSeats }}/{{ car.totalSeats }}</span>
      </div>

      <!-- Passengers chips -->
      <div class="flex flex-wrap gap-1.5">
        <!-- Driver seat badge / Driverless alert (Drop target for driver) -->
        <div
          class="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold max-w-full transition-all text-left"
          :class="[
            !hasDriver
              ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-900/60'
              : (isDriverOfThisCar
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'bg-slate-200/90 text-slate-800 dark:bg-slate-700 dark:text-slate-200'),
            isDragOverDriver ? 'ring-2 ring-emerald-500 bg-emerald-200 dark:bg-emerald-900 scale-105 z-10' : '',
            canDragDriver ? 'cursor-grab active:cursor-grabbing hover:shadow-xs' : ''
          ]"
          :draggable="canDragDriver"
          @dragstart="canDragDriver && car.driver ? handleDriverDragStart($event, car.driver) : null"
          @dragover.prevent.stop="onDragOverDriver"
          @dragleave.stop="onDragLeaveDriver"
          @drop.prevent.stop="onDropDriver"
          :title="!hasDriver ? 'Vettura senza autista' : (canDragDriver ? 'Trascina per spostare autista' : t('car.driver'))"
        >
          <!-- Drag over highlight banner on driver badge -->
          <div
            v-if="isDragOverDriver"
            class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-md flex items-center gap-1 z-30 pointer-events-none"
          >
            <UIcon name="i-tabler-steering-wheel" class="h-3 w-3" />
            <span>Rilascia qui come autista</span>
          </div>

          <UIcon
            v-if="canDragDriver"
            name="i-lucide-grip-vertical"
            class="h-3 w-3 shrink-0 opacity-60 -ml-1 mr-0.5"
          />

          <UIcon
            :name="!hasDriver ? 'i-lucide-alert-circle' : 'i-tabler-steering-wheel'"
            class="h-3.5 w-3.5 shrink-0"
            :class="!hasDriver ? 'text-amber-600' : (isDriverOfThisCar ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400')"
          />

          <!-- Driver name or alert text -->
          <span class="truncate">
            <template v-if="!hasDriver">
              {{ car.rider.name ? (car.rider.name + ' • Cerca autista') : 'Cerca autista' }}
            </template>
            <template v-else-if="isDriverOfThisCar">
              {{ car.driver?.name }} (Tu • Autista)
            </template>
            <template v-else-if="car.driver">
              {{ car.driver.name }} (Autista)
            </template>
            <template v-else>
              {{ car.rider.name }}
            </template>
          </span>

          <!-- If driverless: "Diventa autista" button for passenger -->
          <button
            v-if="!hasDriver && myParticipant?.role === 'passenger'"
            type="button"
            class="ml-1 inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
            title="Offriti come guidatore di questa vettura"
            @click.stop="emit('become-driver', car.rider.id)"
          >
            <UIcon name="i-tabler-steering-wheel" class="h-3 w-3" />
            <span>Diventa autista</span>
          </button>

          <!-- If driverless: Organizer assign button -->
          <button
            v-else-if="!hasDriver && isOrganizer"
            type="button"
            class="ml-1 inline-flex items-center gap-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white px-1.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
            title="Assegna un autista"
            @click.stop="emit('assign-driver', car.rider.id)"
          >
            <span>+ Assegna</span>
          </button>

          <!-- If driverless & visitor: claim or join as driver -->
          <button
            v-else-if="!hasDriver && !myParticipant"
            type="button"
            class="ml-1 text-[10px] underline hover:text-amber-800 cursor-pointer"
            @click.stop="emit('claim-participant', car.rider.id)"
          >
            Vuoi guidare tu?
          </button>

          <!-- If current user is the assigned driver: step down button -->
          <button
            v-else-if="isDriverOfThisCar && car.rider.driverParticipantId"
            type="button"
            class="ml-1 text-[10px] text-red-600 hover:underline cursor-pointer font-bold"
            title="Rinuncia al ruolo di guidatore"
            @click.stop="emit('step-down-driver', car.rider.id)"
          >
            (Lascia)
          </button>

          <!-- If organizer and car has an assigned driver: remove driver button -->
          <button
            v-else-if="isOrganizer && car.rider.driverParticipantId"
            type="button"
            class="ml-1 text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
            title="Rimuovi autista da questa vettura"
            @click.stop="emit('remove-driver', car.rider.id)"
          >
            <UIcon name="i-lucide-x" class="h-3 w-3" />
          </button>
        </div>

        <!-- Seated passengers -->
        <div
          v-for="passenger in car.passengers"
          :key="passenger.id"
          class="inline-flex items-center rounded-lg max-w-full transition-all text-left"
          :class="[
            passenger.id === myParticipant?.id
              ? 'bg-sky-600 text-white font-semibold shadow-sm'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            canDragPassenger(passenger) ? 'cursor-grab active:cursor-grabbing hover:shadow-xs' : ''
          ]"
          :draggable="canDragPassenger(passenger)"
          @dragstart="canDragPassenger(passenger) ? handlePassengerDragStart($event, passenger) : null"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium max-w-full truncate hover:opacity-85 cursor-pointer rounded-l-lg transition-all"
            :title="'Visualizza dettagli di ' + passenger.name + (canDragPassenger(passenger) ? ' (Trascina per spostare)' : '')"
            @click="emit('show-passenger', passenger, car)"
          >
            <UIcon
              v-if="canDragPassenger(passenger)"
              name="i-lucide-grip-vertical"
              class="h-3 w-3 shrink-0 opacity-60 -ml-1 mr-0.5"
            />
            <UIcon
              name="i-lucide-user"
              class="h-3.5 w-3.5 shrink-0"
              :class="passenger.id === myParticipant?.id ? 'text-white' : 'text-slate-400'"
            />
            <span class="truncate">{{ passenger.name }}</span>
          </button>

          <!-- Organizer button to remove passenger from this car -->
          <button
            v-if="isOrganizer"
            type="button"
            class="px-1.5 py-1 text-slate-400 hover:text-red-500 rounded-r-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Rimuovi da quest'auto"
            @click.stop="emit('remove-passenger', passenger.id)"
          >
            <UIcon name="i-lucide-x" class="h-3 w-3" />
          </button>
        </div>

        <!-- Empty seats -->
        <component
          :is="canJoinCar ? 'button' : 'span'"
          v-for="n in car.availableSeats"
          :key="'empty-' + n"
          type="button"
          class="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500 transition-colors"
          :class="canJoinCar ? 'hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/50 dark:hover:border-sky-700 dark:hover:text-sky-400 dark:hover:bg-sky-950/30 cursor-pointer' : ''"
          :title="canJoinCar ? t('car.joinCarBtn') : undefined"
          @click="canJoinCar ? handleSeatAction() : null"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3 shrink-0" />
          <span>{{ t('car.freeSeat') }}</span>
        </component>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      <!-- If current user is the driver -->
      <div v-if="isDriverOfThisCar" class="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs">
        <span class="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 truncate">
          <UIcon name="i-tabler-steering-wheel" class="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{{ t('car.youAreTheDriver') }}</span>
        </span>
        <button
          v-if="car.rider.driverParticipantId"
          type="button"
          class="text-[11px] font-bold text-red-600 hover:underline shrink-0 cursor-pointer"
          @click="emit('step-down-driver', car.rider.id)"
        >
          Lascia ruolo
        </button>
      </div>

      <!-- If current user is the car host/owner but not driving -->
      <div v-else-if="isMyCar" class="text-center text-xs text-slate-500 py-1 font-medium">
        {{ car.rider.hasDriver === false ? 'Hai messo a disposizione questa vettura' : t('car.youAreTheDriver') }}
      </div>

      <!-- If current user is already in this car as passenger -->
      <div v-else-if="isSeatedInThisCar" class="space-y-2">
        <UButton
          color="error"
          variant="subtle"
          block
          size="sm"
          :loading="loading"
          @click="handleSeatAction"
          class="font-semibold text-xs"
        >
          <UIcon name="i-lucide-log-out" class="h-4 w-4 mr-1" />
          {{ t('car.leaveCarBtn') }}
        </UButton>
        <UButton
          v-if="!hasDriver"
          color="primary"
          variant="outline"
          block
          size="sm"
          @click="emit('become-driver', car.rider.id)"
          class="font-semibold text-xs"
        >
          <UIcon name="i-tabler-steering-wheel" class="h-4 w-4 mr-1" />
          Guida tu quest'auto
        </UButton>
      </div>

      <!-- If current user is already driving another car -->
      <div
        v-else-if="myParticipant && myParticipant.role === 'rider'"
        class="text-center text-xs text-slate-400 dark:text-slate-500 py-1 font-medium"
      >
        {{ t('car.youAreDrivingAnother') }}
      </div>

      <!-- If car is full and user is not in this car -->
      <div v-else-if="car.isFull" class="space-y-2">
        <UButton
          color="neutral"
          variant="ghost"
          disabled
          block
          size="sm"
          class="text-xs font-medium"
        >
          {{ t('car.seatsFull') }}
        </UButton>
        <UButton
          v-if="!hasDriver && myParticipant?.role === 'passenger'"
          color="primary"
          variant="outline"
          block
          size="sm"
          @click="emit('become-driver', car.rider.id)"
          class="font-semibold text-xs"
        >
          <UIcon name="i-tabler-steering-wheel" class="h-4 w-4 mr-1" />
          Diventa il guidatore
        </UButton>
      </div>

      <!-- User can join this car -->
      <div v-else class="space-y-1.5">
        <UButton
          color="primary"
          variant="solid"
          block
          size="sm"
          :loading="loading"
          @click="handleSeatAction"
          class="font-semibold text-xs shadow-sm shadow-sky-500/20"
        >
          <UIcon name="i-lucide-car" class="h-4 w-4 mr-1" />
          {{ t('car.joinCarBtn') }}
        </UButton>
        <button
          v-if="!hasDriver && myParticipant?.role === 'passenger'"
          type="button"
          @click="emit('become-driver', car.rider.id)"
          class="w-full text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline py-0.5 inline-flex items-center justify-center gap-1 cursor-pointer"
        >
          <UIcon name="i-tabler-steering-wheel" class="h-3.5 w-3.5" />
          <span>Oppure: diventa l'autista di quest'auto</span>
        </button>
      </div>
    </div>
  </div>
</template>
