<script setup lang="ts">
import type { CarWithSeats, Participant } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  car: CarWithSeats
  myParticipant?: Participant | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-car', riderId: string): void
  (e: 'leave-car'): void
  (e: 'prompt-join'): void
}>()

const { t } = useI18n()

const isMyCar = computed(() => {
  return props.myParticipant?.id === props.car.rider.id
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

// Total people currently in the car = 1 driver + occupied passenger seats
const peopleInCar = computed<number>(() => {
  return props.car.peopleCount || (1 + props.car.occupiedSeats)
})

// Automatically calculated price per person based on how many people are currently in the car
const currentPricePerPerson = computed<number | null>(() => {
  if (totalCarPrice.value === null) return null
  return Math.round((totalCarPrice.value / peopleInCar.value) * 100) / 100
})

// Price per person if 1 more passenger joins (helpful when car is empty or not full)
const nextJoinPricePerPerson = computed<number | null>(() => {
  if (totalCarPrice.value === null || props.car.isFull) return null
  return Math.round((totalCarPrice.value / (peopleInCar.value + 1)) * 100) / 100
})

function formatEuro(val: number | null | undefined): string {
  if (val === null || val === undefined) return '0'
  return Number.isInteger(val) ? `${val}` : val.toFixed(2)
}

function handleSeatAction() {
  if (!props.myParticipant) {
    emit('prompt-join')
    return
  }

  if (isSeatedInThisCar.value) {
    emit('leave-car')
  } else {
    emit('select-car', props.car.rider.id)
  }
}
</script>

<template>
  <div
    class="surface-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 transition-all hover:shadow-md"
    :class="[
      isSeatedInThisCar ? 'ring-2 ring-sky-500 bg-sky-50/20 dark:bg-sky-950/20' : '',
      isMyCar ? 'ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' : ''
    ]"
  >
    <!-- Top banner / tags (responsive, no overlap on narrow screens) -->
    <div class="flex flex-wrap items-start justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div class="flex items-start gap-3 min-w-0 flex-1">
        <div class="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold">
          <UIcon name="i-lucide-car-front" class="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white leading-tight truncate max-w-full">
              {{ car.rider.name }}
            </h4>
            <span
              v-if="isMyCar"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0"
            >
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

      <!-- Capacity pill -->
      <div
        class="shrink-0 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-semibold"
        :class="car.isFull ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'"
      >
        <span v-if="car.isFull">{{ t('car.seatsFull') }}</span>
        <span v-else>{{ car.availableSeats }} / {{ car.totalSeats }} {{ t('car.seats') }}</span>
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
        v-if="!isSeatedInThisCar && !isMyCar && !car.isFull && nextJoinPricePerPerson !== null"
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

      <div v-if="car.rider.departureTime" class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <UIcon name="i-lucide-clock" class="h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <span class="font-semibold text-slate-500 dark:text-slate-400">{{ t('car.departureTime') }}:</span>
          <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">
            {{ car.rider.departureTime }}
          </span>
        </div>
      </div>

      <div v-if="car.rider.phone" class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <UIcon name="i-lucide-phone" class="h-4 w-4 shrink-0 text-emerald-500" />
        <a :href="'tel:' + car.rider.phone" class="hover:underline font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
          {{ car.rider.phone }}
        </a>
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
        <!-- Driver seat badge -->
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/90 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200 max-w-full" title="Guidatore">
          <UIcon name="i-lucide-steering-wheel" class="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span class="truncate">{{ car.rider.name }}</span>
        </span>

        <!-- Seated passengers -->
        <span
          v-for="passenger in car.passengers"
          :key="passenger.id"
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium max-w-full"
          :class="passenger.id === myParticipant?.id ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
        >
          <UIcon name="i-lucide-user" class="h-3.5 w-3.5 shrink-0" :class="passenger.id === myParticipant?.id ? 'text-white' : 'text-slate-400'" />
          <span class="truncate">{{ passenger.name }}</span>
        </span>

        <!-- Empty seats -->
        <span
          v-for="n in car.availableSeats"
          :key="'empty-' + n"
          class="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3 shrink-0" />
          <span>{{ t('car.seats').split(' ')[0] }}</span>
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      <!-- If current user is the driver -->
      <div v-if="isMyCar" class="text-center text-xs text-slate-500 py-1 font-medium">
        {{ t('car.youAreTheDriver') }}
      </div>

      <!-- If current user is already in this car -->
      <UButton
        v-else-if="isSeatedInThisCar"
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

      <!-- If car is full and user is not in this car -->
      <UButton
        v-else-if="car.isFull"
        color="neutral"
        variant="ghost"
        disabled
        block
        size="sm"
        class="text-xs font-medium"
      >
        {{ t('car.seatsFull') }}
      </UButton>

      <!-- User can join this car -->
      <UButton
        v-else
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
    </div>
  </div>
</template>
