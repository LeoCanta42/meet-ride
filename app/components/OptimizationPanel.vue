<script setup lang="ts">
import type { OptimizationResult, OptimizationSuggestion, CarWithSeats } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  eventId: string
  isOrganizer?: boolean
  cars?: CarWithSeats[]
  unassignedCount?: number
  totalPassengers?: number
}>()

const emit = defineEmits<{
  (e: 'optimized'): void
}>()

const { t } = useI18n()
const { optimizeSeats } = useEvent()
const toast = useToast()

const isOpen = ref(false)
const calculating = ref(false)
const applying = ref(false)
const result = ref<OptimizationResult | null>(null)
const errorMessage = ref('')

// Group suggestions by car for a clear per-vehicle preview
const groupedByCar = computed(() => {
  if (!result.value || !result.value.suggestions.length) return []
  const map = new Map<
    string,
    {
      riderId: string
      driverName: string
      carModel: string
      departureLocation: string
      passengers: OptimizationSuggestion[]
    }
  >()

  for (const sug of result.value.suggestions) {
    const existing = map.get(sug.suggestedRiderId)
    if (existing) {
      existing.passengers.push(sug)
    } else {
      map.set(sug.suggestedRiderId, {
        riderId: sug.suggestedRiderId,
        driverName: sug.suggestedRiderName,
        carModel: sug.carModel || 'Auto',
        departureLocation: sug.carDepartureLocation || 'Non specificato',
        passengers: [sug]
      })
    }
  }
  return Array.from(map.values())
})

async function handleCalculate() {
  if (!props.isOrganizer) return
  calculating.value = true
  errorMessage.value = ''
  try {
    const res = await optimizeSeats(false)
    if (res.error) {
      errorMessage.value = res.error
      result.value = null
    } else {
      result.value = res.result || null
    }
  } finally {
    calculating.value = false
  }
}

function openAndCalculate() {
  isOpen.value = true
  handleCalculate()
}

defineExpose({
  openAndCalculate
})

async function handleApply() {
  if (!props.isOrganizer || !result.value || result.value.suggestions.length === 0) return
  applying.value = true
  errorMessage.value = ''
  try {
    const res = await optimizeSeats(true, result.value.suggestions)
    if (res.error) {
      errorMessage.value = res.error
    } else {
      toast.add({
        title: t('optimizer.appliedSuccess'),
        description: `${result.value.suggestions.length} passeggeri distribuiti nelle auto.`,
        color: 'success'
      })
      emit('optimized')
      isOpen.value = false
      result.value = null
    }
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div
    v-if="isOrganizer"
    class="rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/70 to-indigo-50/50 p-4 sm:p-5 dark:border-sky-900/60 dark:from-sky-950/30 dark:to-indigo-950/20 shadow-xs"
  >
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3 min-w-0">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/25">
          <UIcon name="i-lucide-users-round" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
              1. Ottimizza Distribuzione Persone nelle Auto
            </h4>
            <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Gemini AI
            </span>
            <span
              v-if="(unassignedCount || 0) > 0"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              {{ unassignedCount }} in attesa di posto
            </span>
            <span
              v-else-if="(totalPassengers || 0) > 0"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              Tutti assegnati ({{ totalPassengers }})
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
            Distribuisce i passeggeri nelle auto in base a dove partono e dove devono arrivare, accorpando i gruppi lungo la stessa strada senza usare auto superflue.
          </p>
        </div>
      </div>

      <div v-if="(unassignedCount || 0) > 0" class="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          :loading="calculating"
          :disabled="(cars?.length || 0) === 0 || (totalPassengers || 0) === 0"
          @click="openAndCalculate"
          class="font-bold text-xs shadow-sm w-full sm:w-auto justify-center cursor-pointer"
        >
          <UIcon name="i-lucide-sparkles" class="h-4 w-4 mr-1.5 shrink-0" />
          <span>Distribuisci Persone con AI</span>
        </UButton>
      </div>
    </div>

    <!-- Optimization results modal -->
    <UModal
      :open="isOpen"
      @update:open="isOpen = $event"
      title="Ottimizzazione Posti Auto (Gemini AI)"
      description="Proposta di distribuzione dei passeggeri nelle auto basata sui tragitti verso la destinazione."
      :ui="{ content: 'sm:max-w-xl max-h-[90dvh] overflow-y-auto' }"
    >
      <template #body>
        <div class="space-y-4">
          <!-- Loading state -->
          <div v-if="calculating" class="py-10 text-center text-xs text-slate-500">
            <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin mx-auto text-sky-500 mb-2.5" />
            <p class="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Analisi posizioni e distribuzione passeggeri con Gemini AI...
            </p>
            <p class="text-[11px] text-slate-400 mt-1">
              Calcolo delle direttrici di partenza, accorpamento gruppi e ottimizzazione vetture
            </p>
          </div>

          <!-- Error Message -->
          <div
            v-else-if="errorMessage"
            class="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 space-y-2"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-alert-triangle" class="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p class="font-bold">Impossibile completare l'ottimizzazione AI</p>
                <p class="mt-1 text-[11px] leading-relaxed">{{ errorMessage }}</p>
              </div>
            </div>
          </div>

          <!-- Result view -->
          <div v-else-if="result" class="space-y-4">
            <!-- AI Summary Banner -->
            <div
              v-if="result.summary"
              class="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-start gap-2.5"
            >
              <UIcon name="i-lucide-bot" class="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                    Strategia Gemini AI
                  </span>
                  <span
                    v-if="result.usedCarsCount !== undefined && result.totalCarsCount !== undefined"
                    class="rounded-full bg-indigo-100 dark:bg-indigo-900/70 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-200"
                  >
                    {{ result.usedCarsCount }} / {{ result.totalCarsCount }} auto impiegate per passeggeri
                  </span>
                </div>
                <p class="mt-1 leading-relaxed">{{ result.summary }}</p>
              </div>
            </div>

            <!-- No suggestions needed -->
            <div
              v-if="result.suggestions.length === 0"
              class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30"
            >
              <UIcon name="i-lucide-check-circle" class="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {{ t('optimizer.noSuggestions') }}
              </p>
            </div>

            <!-- Grouped by Car Preview -->
            <div v-else class="space-y-3">
              <div class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Distribuzione proposta per vettura:</span>
                <span class="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  {{ result.suggestions.length }} passeggeri assegnati
                </span>
              </div>

              <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
                <div
                  v-for="carGroup in groupedByCar"
                  :key="carGroup.riderId"
                  class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
                >
                  <!-- Car Header -->
                  <div class="bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <UIcon name="i-lucide-car" class="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div class="min-w-0">
                        <span class="font-bold text-xs text-slate-900 dark:text-white block truncate">
                          {{ carGroup.carModel }} di {{ carGroup.driverName }}
                        </span>
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                          Partenza: {{ carGroup.departureLocation }}
                        </span>
                      </div>
                    </div>
                    <span class="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      {{ carGroup.passengers.length }} a bordo
                    </span>
                  </div>

                  <!-- Passengers in this Car -->
                  <div class="divide-y divide-slate-100 dark:divide-slate-800/60">
                    <div
                      v-for="sug in carGroup.passengers"
                      :key="sug.passengerId"
                      class="p-3 text-xs space-y-1"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UIcon name="i-lucide-user" class="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          <span>{{ sug.passengerName }}</span>
                        </span>
                        <span
                          v-if="sug.passengerPickupLocation"
                          class="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px]"
                        >
                          📍 {{ sug.passengerPickupLocation }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                        {{ sug.reason }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Unused Cars Notice (when not all cars are needed for passengers) -->
            <div
              v-if="result.unusedCars && result.unusedCars.length > 0"
              class="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-1.5"
            >
              <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <UIcon name="i-lucide-info" class="h-3.5 w-3.5 text-sky-500 shrink-0" />
                <span>Auto lasciate senza passeggeri ({{ result.unusedCars.length }}):</span>
              </div>
              <div class="space-y-1">
                <div
                  v-for="uc in result.unusedCars"
                  :key="uc.riderId"
                  class="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5"
                >
                  <span class="font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                    • {{ uc.carModel }} di {{ uc.driverName }}:
                  </span>
                  <span>{{ uc.reason }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal footer actions -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <UButton
              v-if="result && !calculating"
              color="neutral"
              variant="outline"
              size="sm"
              @click="handleCalculate"
              class="text-xs font-semibold"
            >
              <UIcon name="i-lucide-refresh-cw" class="h-3.5 w-3.5 mr-1" />
              Ricalcola
            </UButton>
            <div v-else />

            <div class="flex items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                @click="isOpen = false"
              >
                {{ t('common.close') }}
              </UButton>

              <UButton
                v-if="result && result.suggestions.length > 0"
                color="primary"
                size="sm"
                :loading="applying"
                @click="handleApply"
                class="font-bold text-xs shadow-sm cursor-pointer"
              >
                <UIcon name="i-lucide-check" class="h-4 w-4 mr-1" />
                Applica Distribuzione Posti
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
