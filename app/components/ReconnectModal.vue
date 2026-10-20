<script setup lang="ts">
import type { Participant } from '~/types'
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'

const props = defineProps<{
  open: boolean
  participants: Participant[]
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'reconnected'): void
}>()

const { t } = useI18n()
const { reconnectParticipant } = useEvent()
const toast = useToast()

const selectedParticipantId = ref('')
const credential = ref('')
const showCredential = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const mode = ref<'credentials' | 'link'>('credentials')
const directTokenOrLink = ref('')

// Initialize selection when opened
watch(() => props.open, (val) => {
  if (val) {
    errorMessage.value = ''
    credential.value = ''
    directTokenOrLink.value = ''
    if (props.participants.length > 0 && !selectedParticipantId.value) {
      selectedParticipantId.value = props.participants[0]!.id
    }
  }
})

// Participant options for selector
const participantOptions = computed(() => {
  return props.participants.map(p => ({
    value: p.id,
    label: `${p.name} (${p.role === 'rider' ? '🚗 Guidatore' : '🙋 Passeggero'})`
  }))
})

async function handleReconnect() {
  errorMessage.value = ''

  if (mode.value === 'link') {
    if (!directTokenOrLink.value.trim()) {
      errorMessage.value = 'Inserisci il tuo link personale o token'
      return
    }

    let token = directTokenOrLink.value.trim()
    // If user pasted a full URL, extract ?p= or ?token=
    try {
      if (token.includes('?')) {
        const url = new URL(token, 'http://localhost')
        token = url.searchParams.get('p') || url.searchParams.get('token') || token
      }
    } catch {
      // not a full URL, treat as raw token
    }

    // Try finding which participant has this token or try each
    const matching = props.participants.find(p => p.token === token)
    const targetId = matching ? matching.id : (props.participants[0]?.id || '')

    loading.value = true
    try {
      const res = await reconnectParticipant(targetId, token)
      if (res.success) {
        toast.add({
          title: 'Bentornato!',
          description: 'Profilo riconnesso con successo su questo dispositivo.',
          color: 'success'
        })
        emit('reconnected')
        emit('update:open', false)
      } else {
        errorMessage.value = res.error || 'Link o token non valido'
      }
    } finally {
      loading.value = false
    }
    return
  }

  // Credentials mode (Phone or PIN)
  if (!selectedParticipantId.value) {
    errorMessage.value = 'Seleziona il tuo nome dalla lista'
    return
  }

  if (!credential.value.trim()) {
    errorMessage.value = 'Inserisci il tuo numero di telefono o il PIN'
    return
  }

  loading.value = true
  try {
    const res = await reconnectParticipant(selectedParticipantId.value, credential.value.trim())
    if (res.success) {
      toast.add({
        title: 'Bentornato!',
        description: 'Profilo riconnesso con successo su questo dispositivo.',
        color: 'success'
      })
      emit('reconnected')
      emit('update:open', false)
    } else {
      errorMessage.value = res.error || 'Credenziali errate'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    title="Riconnetti il tuo Profilo"
    description="Accedi al tuo posto o alla tua auto da questo dispositivo"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Mode Tabs -->
        <div class="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all"
            :class="mode === 'credentials'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="mode = 'credentials'"
          >
            Telefono o PIN
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all"
            :class="mode === 'link'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="mode = 'link'"
          >
            Link o Token
          </button>
        </div>

        <form @submit.prevent="handleReconnect" class="space-y-4">
          <!-- Credentials Mode -->
          <template v-if="mode === 'credentials'">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Chi sei nell'evento?
              </label>
              <select
                v-model="selectedParticipantId"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option v-for="opt in participantOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Numero di Telefono o PIN
              </label>
              <UInput
                v-model="credential"
                :type="showCredential ? 'text' : 'password'"
                placeholder="es. 3401234567 oppure PIN 1234"
                :ui="{ trailing: 'pe-1' }"
                required
                class="w-full font-mono"
              >
                <template #trailing>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showCredential ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="showCredential ? t('common.hidePassword') : t('common.showPassword')"
                    tabindex="-1"
                    @pointerdown.prevent
                    @click="showCredential = !showCredential"
                  />
                </template>
              </UInput>
              <p class="text-[11px] text-slate-400 mt-1">
                Inserisci il telefono o il PIN a 4 cifre indicato durante l'iscrizione.
              </p>
            </div>
          </template>

          <!-- Link Mode -->
          <template v-else>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Incolla il tuo Link Personale o Token
              </label>
              <UInput
                v-model="directTokenOrLink"
                placeholder="https://... o token segreto"
                class="w-full font-mono text-xs"
                required
              />
              <p class="text-[11px] text-slate-400 mt-1">
                Incolla il link personale copiato dal tuo altro dispositivo per accedere istantaneamente.
              </p>
            </div>
          </template>

          <!-- Error display -->
          <div v-if="errorMessage" class="rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {{ errorMessage }}
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
              class="font-semibold shadow-sm"
            >
              <UIcon name="i-lucide-link-2" class="h-4 w-4 mr-1.5" />
              Riconnetti
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
