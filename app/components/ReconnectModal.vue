<script setup lang="ts">
import type { Participant } from '~/types'
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'

const props = withDefaults(
  defineProps<{
    open: boolean
    participants: Participant[]
    preselectedParticipantId?: string
  }>(),
  {
    preselectedParticipantId: ''
  }
)

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
const searchQuery = ref('')
const showHelp = ref(false)

const mode = ref<'credentials' | 'link'>('credentials')
const directTokenOrLink = ref('')

// Initialize selection when opened
watch(
  () => props.open,
  (val) => {
    if (val) {
      errorMessage.value = ''
      credential.value = ''
      directTokenOrLink.value = ''
      searchQuery.value = ''

      if (props.preselectedParticipantId) {
        selectedParticipantId.value = props.preselectedParticipantId
      } else if (props.participants.length > 0 && !selectedParticipantId.value) {
        selectedParticipantId.value = props.participants[0]!.id
      }
    }
  }
)

watch(
  () => props.preselectedParticipantId,
  (newId) => {
    if (newId) {
      selectedParticipantId.value = newId
    }
  }
)

const filteredParticipants = computed(() => {
  if (!searchQuery.value.trim()) return props.participants
  const q = searchQuery.value.toLowerCase().trim()
  return props.participants.filter(p => p.name.toLowerCase().includes(q))
})

const selectedParticipant = computed(() => {
  return props.participants.find(p => p.id === selectedParticipantId.value) || null
})

async function handleReconnect() {
  errorMessage.value = ''

  if (mode.value === 'link') {
    if (!directTokenOrLink.value.trim()) {
      errorMessage.value = 'Inserisci il tuo link personale o token'
      return
    }

    let token = directTokenOrLink.value.trim()
    try {
      if (token.includes('?')) {
        const url = new URL(token, 'http://localhost')
        token = url.searchParams.get('p') || url.searchParams.get('token') || token
      }
    } catch {
      // not a full URL, treat as raw token
    }

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

  // Credentials mode (PIN only)
  if (!selectedParticipantId.value) {
    errorMessage.value = 'Seleziona il tuo nome dalla lista'
    return
  }

  if (!selectedParticipant.value?.hasPin) {
    errorMessage.value = 'Nessun PIN impostato per questo profilo. Usa il tuo Link Personale o chiedi all\'organizzatore.'
    return
  }

  if (!credential.value.trim()) {
    errorMessage.value = 'Inserisci il tuo codice PIN'
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
      errorMessage.value = res.error || t('reconnectModal.wrongCredentials')
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
    :title="t('reconnectModal.title')"
    :description="t('reconnectModal.subtitle')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Mode Tabs -->
        <div class="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all inline-flex items-center justify-center gap-1.5"
            :class="mode === 'credentials'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="mode = 'credentials'"
          >
            <UIcon name="i-lucide-user-check" class="h-3.5 w-3.5 text-sky-500" />
            <span>{{ t('reconnectModal.tabName') }}</span>
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all inline-flex items-center justify-center gap-1.5"
            :class="mode === 'link'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="mode = 'link'"
          >
            <UIcon name="i-lucide-link-2" class="h-3.5 w-3.5 text-indigo-500" />
            <span>{{ t('reconnectModal.tabLink') }}</span>
          </button>
        </div>

        <form @submit.prevent="handleReconnect" class="space-y-4">
          <!-- Credentials Mode: Step 1 Pick Name, Step 2 Enter PIN/Phone -->
          <template v-if="mode === 'credentials'">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {{ t('reconnectModal.selectNamePrompt') }}
                </label>
                <span class="text-[11px] text-slate-400">
                  {{ participants.length }} in lista
                </span>
              </div>

              <!-- Search filter if more than 3 participants -->
              <div v-if="participants.length > 3">
                <UInput
                  v-model="searchQuery"
                  :placeholder="t('reconnectModal.searchPlaceholder')"
                  icon="i-lucide-search"
                  size="sm"
                  class="w-full text-xs"
                />
              </div>

              <!-- Participants selectable list -->
              <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-1 dark:border-slate-800">
                <button
                  v-for="p in filteredParticipants"
                  :key="p.id"
                  type="button"
                  class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-all border"
                  :class="selectedParticipantId === p.id
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'"
                  @click="selectedParticipantId = p.id; credential = ''"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs"
                      :class="p.role === 'rider' ? 'bg-emerald-600' : 'bg-sky-600'"
                    >
                      <UIcon :name="p.role === 'rider' ? 'i-lucide-car' : 'i-lucide-user'" class="h-3.5 w-3.5" />
                    </div>
                    <div class="truncate">
                      <span class="font-bold text-xs block leading-tight truncate">{{ p.name }}</span>
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 block truncate leading-tight">
                        {{ p.role === 'rider' ? (p.carModel || 'Guidatore') : (p.pickupLocation || 'Passeggero') }}
                      </span>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-1.5 ml-2">
                    <span
                      v-if="p.hasPin"
                      class="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300"
                      title="PIN impostato"
                    >
                      <UIcon name="i-lucide-key-round" class="h-2.5 w-2.5" />
                      PIN
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      title="Nessun PIN impostato"
                    >
                      Senza PIN
                    </span>

                    <UIcon
                      v-if="selectedParticipantId === p.id"
                      name="i-lucide-check-circle-2"
                      class="h-4 w-4 text-sky-600 dark:text-sky-400"
                    />
                  </div>
                </button>

                <div v-if="filteredParticipants.length === 0" class="py-4 text-center text-xs text-slate-400">
                  {{ t('reconnectModal.emptyList') }}
                </div>
              </div>
            </div>

            <!-- Credential Input Tailored to Selected Participant -->
            <div v-if="selectedParticipant" class="pt-2 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <template v-if="selectedParticipant.hasPin">
                <div class="flex items-center justify-between">
                  <label class="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    {{ t('reconnectModal.pinRequiredTitle') }}
                  </label>
                  <span class="text-[10px] font-medium text-slate-400">
                    per {{ selectedParticipant.name }}
                  </span>
                </div>

                <UInput
                  v-model="credential"
                  :type="showCredential ? 'text' : 'password'"
                  placeholder="es. 1234"
                  :ui="{ trailing: 'pe-1' }"
                  required
                  class="w-full font-mono text-sm font-bold"
                  autofocus
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

                <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {{ t('reconnectModal.pinRequiredHelp') }}
                </p>
              </template>

              <!-- If participant has NO PIN -->
              <template v-else>
                <div class="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 space-y-1.5">
                  <div class="flex items-center gap-1.5 font-bold">
                    <UIcon name="i-lucide-shield-alert" class="h-4 w-4 text-amber-600" />
                    <span>Nessun PIN impostato</span>
                  </div>
                  <p class="text-[11px] leading-relaxed">
                    Per ragioni di sicurezza, l'accesso con il solo numero di telefono non è consentito. Per riconnettere questo profilo, utilizza la scheda <strong>"Link o Token"</strong> oppure contatta l'organizzatore dell'evento.
                  </p>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    class="mt-1 font-semibold"
                    @click="mode = 'link'"
                  >
                    <UIcon name="i-lucide-link-2" class="h-3.5 w-3.5 mr-1" />
                    Passa a Link o Token
                  </UButton>
                </div>
              </template>
            </div>
          </template>

          <!-- Link Mode -->
          <template v-else>
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {{ t('reconnectModal.linkPrompt') }}
              </label>
              <UInput
                v-model="directTokenOrLink"
                :placeholder="t('reconnectModal.linkPlaceholder')"
                class="w-full font-mono text-xs"
                required
              />
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {{ t('reconnectModal.linkHelp') }}
              </p>
            </div>
          </template>

          <!-- Error display -->
          <div
            v-if="errorMessage"
            class="flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <UIcon name="i-lucide-alert-circle" class="h-4 w-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Explanatory helper toggle -->
          <div class="pt-1">
            <button
              type="button"
              class="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
              @click="showHelp = !showHelp"
            >
              <UIcon name="i-lucide-help-circle" class="h-3 w-3" />
              <span>{{ t('reconnectModal.howItWorksTitle') }}</span>
              <UIcon :name="showHelp ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-3 w-3" />
            </button>

            <div
              v-if="showHelp"
              class="mt-2 rounded-xl bg-sky-50/60 p-2.5 text-[11px] text-sky-900 leading-relaxed dark:bg-sky-950/30 dark:text-sky-200 border border-sky-100 dark:border-sky-900/40"
            >
              {{ t('reconnectModal.howItWorksDesc') }}
            </div>
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
              class="font-semibold shadow-sm px-4"
            >
              <UIcon name="i-lucide-log-in" class="h-4 w-4 mr-1.5" />
              {{ t('reconnectModal.submitBtn') }}
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
