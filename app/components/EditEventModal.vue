<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'
import type { EventItem } from '~/types'

const props = defineProps<{
  open: boolean
  event: EventItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const { updateEventDetails } = useEvent()
const toast = useToast()

const title = ref('')
const destination = ref('')
const eventDate = ref('')
const arrivalTime = ref('')
const sharedPassword = ref('')
const showPassword = ref(true)
const description = ref('')
const loading = ref(false)
const errorMessage = ref('')

function formatForDateTimeLocal(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

function syncFromEvent() {
  if (!props.event) return
  title.value = props.event.title || ''
  destination.value = props.event.destination || ''
  eventDate.value = formatForDateTimeLocal(props.event.eventDate)
  arrivalTime.value = props.event.arrivalTime || ''
  sharedPassword.value = props.event.sharedPassword && props.event.sharedPassword !== '***' ? props.event.sharedPassword : ''
  description.value = props.event.description || ''
  errorMessage.value = ''
}

watch(
  () => [props.open, props.event],
  ([isOpen]) => {
    if (isOpen) {
      syncFromEvent()
    }
  },
  { immediate: true }
)

function generatePassword() {
  const words = ['passaggio', 'viaggio', 'raduno', 'carpool', 'festa', 'gita', 'amici', 'corsa']
  const randomWord = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(100 + Math.random() * 900)
  sharedPassword.value = `${randomWord}${num}`
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!title.value.trim() || !destination.value.trim() || !eventDate.value || !sharedPassword.value.trim()) {
    errorMessage.value = t('common.required')
    return
  }

  loading.value = true
  try {
    const payload = {
      title: title.value.trim(),
      destination: destination.value.trim(),
      eventDate: new Date(eventDate.value).toISOString(),
      arrivalTime: arrivalTime.value.trim() || null,
      sharedPassword: sharedPassword.value.trim(),
      description: description.value.trim()
    }

    const res = await updateEventDetails(payload)
    if (res.success) {
      toast.add({
        title: t('common.success'),
        description: 'Dettagli evento aggiornati con successo',
        color: 'success'
      })
      emit('saved')
      emit('update:open', false)
    } else {
      errorMessage.value = res.error || t('common.error')
    }
  } catch (err: any) {
    errorMessage.value = err?.message || t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="t('events.editTitle')"
    :description="t('events.editSubtitle')"
    :ui="{ content: 'sm:max-w-xl max-h-[90dvh] overflow-y-auto' }"
  >
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Error alert -->
        <div
          v-if="errorMessage"
          class="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {{ errorMessage }}
        </div>

        <!-- Title -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('events.title') }} *
          </label>
          <UInput
            v-model="title"
            :placeholder="t('events.titlePlaceholder')"
            required
            size="md"
            class="w-full font-semibold"
          />
        </div>

        <!-- Destination, Date & Arrival Time -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('events.destination') }} *
            </label>
            <UInput
              v-model="destination"
              :placeholder="t('events.destinationPlaceholder')"
              icon="i-lucide-map-pin"
              required
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('events.date') }} *
            </label>
            <UInput
              v-model="eventDate"
              type="datetime-local"
              icon="i-lucide-calendar"
              required
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Orario di arrivo
            </label>
            <UInput
              v-model="arrivalTime"
              placeholder="es. 20:30"
              icon="i-lucide-clock"
              class="w-full font-mono font-medium"
            />
            <span class="text-[10px] text-slate-400 mt-1 block">
              Per convoglio & ritrovo AI
            </span>
          </div>
        </div>

        <!-- Shared Password -->
        <div class="rounded-2xl border border-sky-100 bg-sky-50/50 p-3.5 dark:border-sky-950 dark:bg-sky-950/20">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <UIcon name="i-lucide-key" class="h-4 w-4 text-sky-500" />
              <span>{{ t('events.sharedPassword') }} *</span>
            </label>

            <button
              type="button"
              @click="generatePassword"
              class="text-[11px] font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
              <span>Genera automatica</span>
            </button>
          </div>

          <UInput
            v-model="sharedPassword"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="t('events.sharedPasswordPlaceholder')"
            :ui="{ trailing: 'pe-1' }"
            required
            class="w-full font-mono font-semibold"
          >
            <template #trailing>
              <UButton
                type="button"
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? t('common.hidePassword') : t('common.showPassword')"
                :title="showPassword ? t('common.hidePassword') : t('common.showPassword')"
                :aria-pressed="showPassword"
                tabindex="-1"
                @pointerdown.prevent
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>

          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {{ t('events.sharedPasswordHelp') }}
          </p>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('events.description') }}
          </label>
          <UTextarea
            v-model="description"
            :placeholder="t('events.descriptionPlaceholder')"
            :rows="3"
            class="w-full text-xs"
          />
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('update:open', false)"
          >
            {{ t('common.cancel') }}
          </UButton>

          <UButton
            type="submit"
            color="primary"
            size="sm"
            :loading="loading"
            class="font-bold shadow-sm"
          >
            <UIcon name="i-lucide-check" class="h-4 w-4 mr-1" />
            {{ t('events.editSubmit') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
