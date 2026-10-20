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
    class="surface-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 transition-all hover:shadow-md"
    :class="[
      isSeatedInThisCar ? 'ring-2 ring-sky-500 bg-sky-50/20 dark:bg-sky-950/20' : '',
      isMyCar ? 'ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' : ''
    ]"
  >
    <!-- Top banner / tags -->
    <div class="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold">
          <UIcon name="i-lucide-car-front" class="h-6 w-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-slate-900 dark:text-white leading-tight">
              {{ car.rider.name }}
            </h4>
            <span
              v-if="isMyCar"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              {{ t('car.youAreTheDriver') }}
            </span>
            <span
              v-else-if="isSeatedInThisCar"
              class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300"
            >
              {{ t('car.youAreInThisCar') }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            {{ car.rider.carModel || 'Auto' }}
          </p>
        </div>
      </div>

      <!-- Capacity pill -->
      <div
        class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="car.isFull ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'"
      >
        <span v-if="car.isFull">{{ t('car.seatsFull') }}</span>
        <span v-else>{{ car.availableSeats }} / {{ car.totalSeats }} {{ t('car.seats') }}</span>
      </div>
    </div>

    <!-- Departure Details -->
    <div class="my-4 space-y-2 text-xs">
      <div class="flex items-start gap-2 text-slate-600 dark:text-slate-300">
        <UIcon name="i-lucide-map-pin" class="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
        <div>
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
        <a :href="'tel:' + car.rider.phone" class="hover:underline font-mono text-[11px] text-slate-700 dark:text-slate-300">
          {{ car.rider.phone }}
        </a>
      </div>
    </div>

    <!-- Visual Seats Grid -->
    <div class="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <div class="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>{{ t('car.passengersList') }}</span>
        <span>{{ car.occupiedSeats }}/{{ car.totalSeats }}</span>
      </div>

      <!-- Passengers chips -->
      <div class="flex flex-wrap gap-1.5">
        <!-- Driver seat badge -->
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/90 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200" title="Guidatore">
          <UIcon name="i-lucide-steering-wheel" class="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          {{ car.rider.name }}
        </span>

        <!-- Seated passengers -->
        <span
          v-for="passenger in car.passengers"
          :key="passenger.id"
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
          :class="passenger.id === myParticipant?.id ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
        >
          <UIcon name="i-lucide-user" class="h-3.5 w-3.5" :class="passenger.id === myParticipant?.id ? 'text-white' : 'text-slate-400'" />
          {{ passenger.name }}
        </span>

        <!-- Empty seats -->
        <span
          v-for="n in car.availableSeats"
          :key="'empty-' + n"
          class="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3" />
          {{ t('car.seats').split(' ')[0] }}
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
