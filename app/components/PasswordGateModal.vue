<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import type { EventItem } from '~/types'

const props = defineProps<{
  event: EventItem | null
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'unlock', password: string): void
}>()

const { t } = useI18n()
const password = ref('')

function handleUnlock() {
  if (!password.value.trim()) return
  emit('unlock', password.value.trim())
}
</script>

<template>
  <div class="mx-auto my-12 max-w-md px-4">
    <div class="surface-card relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl text-center">
      <!-- Glow effect -->
      <div class="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <!-- Lock Icon -->
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400 shadow-inner">
        <UIcon name="i-lucide-lock" class="h-7 w-7" />
      </div>

      <h2 class="text-xl font-bold text-slate-900 dark:text-white">
        {{ t('eventView.sharedPasswordRequired') }}
      </h2>

      <p v-if="event" class="mt-1 font-semibold text-sm text-sky-600 dark:text-sky-400">
        {{ event.title }}
      </p>

      <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {{ t('eventView.passwordPrompt') }}
      </p>

      <form @submit.prevent="handleUnlock" class="mt-6 space-y-4">
        <div>
          <UInput
            v-model="password"
            type="password"
            :placeholder="t('events.sharedPasswordPlaceholder')"
            icon="i-lucide-key"
            size="lg"
            class="w-full text-center font-mono"
            autofocus
            required
          />
        </div>

        <div v-if="error" class="text-xs font-semibold text-red-500">
          {{ error }}
        </div>

        <UButton
          type="submit"
          color="primary"
          size="lg"
          block
          :loading="loading"
          class="font-semibold shadow-md shadow-sky-500/20"
        >
          <UIcon name="i-lucide-key" class="h-4 w-4 mr-2" />
          {{ t('eventView.unlockBtn') }}
        </UButton>
      </form>
    </div>
  </div>
</template>
