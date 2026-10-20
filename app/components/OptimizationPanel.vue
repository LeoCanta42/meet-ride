<script setup lang="ts">
import type { OptimizationResult } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  eventId: string
  isOrganizer?: boolean
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

async function handleCalculate() {
  calculating.value = true
  try {
    const res = await optimizeSeats(false)
    result.value = res
  } finally {
    calculating.value = false
  }
}

async function handleApply() {
  if (!result.value || result.value.suggestions.length === 0) return
  applying.value = true
  try {
    await optimizeSeats(true)
    toast.add({
      title: t('optimizer.appliedSuccess'),
      color: 'success'
    })
    emit('optimized')
    isOpen.value = false
    result.value = null
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/70 to-cyan-50/50 p-4 sm:p-5 dark:border-sky-900/60 dark:from-sky-950/30 dark:to-cyan-950/20">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/30">
          <UIcon name="i-lucide-sparkles" class="h-5 w-5" />
        </div>
        <div>
          <h4 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {{ t('optimizer.title') }}
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ t('optimizer.subtitle') }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          :loading="calculating"
          @click="() => { isOpen = true; handleCalculate(); }"
          class="font-semibold text-xs shadow-sm w-full sm:w-auto"
        >
          <UIcon name="i-lucide-route" class="h-4 w-4 mr-1.5" />
          {{ t('optimizer.runBtn') }}
        </UButton>
      </div>
    </div>

    <!-- Optimization results modal -->
    <UModal
      :open="isOpen"
      @update:open="isOpen = $event"
      :title="t('optimizer.title')"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {{ t('optimizer.explanation') }}
          </p>

          <div v-if="calculating" class="py-8 text-center text-xs text-slate-500">
            <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin mx-auto text-sky-500 mb-2" />
            {{ t('common.loading') }}
          </div>

          <div v-else-if="result">
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

            <!-- Suggestions list -->
            <div v-else class="space-y-3">
              <div class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span class="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[11px] text-sky-700 font-bold dark:bg-sky-950 dark:text-sky-300">
                  {{ result.suggestions.length }}
                </span>
                <span>{{ t('optimizer.suggestionsFound') }}</span>
              </div>

              <div class="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800 overflow-hidden max-h-72 overflow-y-auto">
                <div
                  v-for="sug in result.suggestions"
                  :key="sug.passengerId"
                  class="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-slate-900 dark:text-white">{{ sug.passengerName }}</span>
                      <UIcon name="i-lucide-arrow-right" class="h-3 w-3 text-slate-400" />
                      <span class="font-semibold text-sky-600 dark:text-sky-400">
                        {{ sug.suggestedRiderName }}
                      </span>
                    </div>

                    <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>{{ sug.reason }}</span>
                      <span v-if="sug.distanceKm" class="font-mono text-[10px] rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                        ~{{ sug.distanceKm }} km
                      </span>
                    </div>
                  </div>

                  <UIcon name="i-lucide-car" class="h-4 w-4 text-emerald-500 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          <!-- Modal footer actions -->
          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <UButton
              color="neutral"
              variant="ghost"
              @click="isOpen = false"
            >
              {{ t('common.close') }}
            </UButton>

            <UButton
              v-if="result && result.suggestions.length > 0"
              color="primary"
              :loading="applying"
              @click="handleApply"
              class="font-semibold shadow-sm"
            >
              <UIcon name="i-lucide-check" class="h-4 w-4 mr-1" />
              {{ t('optimizer.applyBtn') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
