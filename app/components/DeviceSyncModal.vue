<script setup lang="ts">
import QRCode from 'qrcode'
import type { EventItem, Participant } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = withDefaults(
  defineProps<{
    open: boolean
    event: EventItem | null
    participant: Participant | null
    isNewJoin?: boolean
  }>(),
  {
    isNewJoin: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { t } = useI18n()
const toast = useToast()

const activeTab = ref<'qr' | 'link' | 'pin'>('qr')
const qrDataUrl = ref<string>('')
const copied = ref(false)

const magicUrl = computed(() => {
  if (!import.meta.client || !props.event || !props.participant?.token) return ''
  const origin = window.location.origin
  const path = `/events/${props.event.slug || props.event.id}`
  return `${origin}${path}?p=${props.participant.token}`
})

async function generateQr() {
  if (!magicUrl.value) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(magicUrl.value, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#0284c7', // Sky-600
        light: '#ffffff'
      }
    })
  } catch (err) {
    console.error('Failed generating QR code:', err)
  }
}

watch(
  () => [props.open, magicUrl.value],
  ([isOpen]) => {
    if (isOpen) {
      copied.value = false
      generateQr()
    }
  },
  { immediate: true }
)

function copyLink() {
  if (!magicUrl.value) return
  if (navigator.clipboard) {
    navigator.clipboard.writeText(magicUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2500)
  }
  toast.add({
    title: t('common.copied'),
    description: 'Aprilo su un altro dispositivo per accedere istantaneamente.',
    color: 'success'
  })
}

function shareViaWhatsApp() {
  if (!magicUrl.value || !props.event) return
  const text = `Ecco il mio link personale per ${props.event.title} su Meet & Ride:\n${magicUrl.value}`
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
  window.open(waUrl, '_blank')
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="isNewJoin ? t('syncModal.titleNew') : t('syncModal.titleExisting')"
    :description="isNewJoin ? t('syncModal.subtitleNew') : t('syncModal.subtitleExisting')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Participant Summary Banner -->
        <div
          v-if="participant"
          class="flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50/60 p-3.5 border border-sky-100 dark:from-sky-950/40 dark:to-indigo-950/20 dark:border-sky-900/40"
        >
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-base shadow-sm"
              :class="participant.role === 'rider' ? 'bg-emerald-600' : 'bg-sky-600'"
            >
              <UIcon :name="participant.role === 'rider' ? 'i-lucide-car' : 'i-lucide-user'" class="h-5 w-5" />
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-slate-900 dark:text-white">{{ participant.name }}</span>
                <span
                  class="rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider"
                  :class="participant.role === 'rider' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'"
                >
                  {{ participant.role === 'rider' ? 'Guidatore' : 'Passeggero' }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                {{ participant.role === 'rider' ? participant.carModel : (participant.pickupLocation || 'Passeggero in lista') }}
              </p>
            </div>
          </div>

          <div v-if="participant.pin" class="text-right">
            <span class="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">PIN</span>
            <span class="font-mono text-xs font-black text-sky-700 dark:text-sky-300 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-sky-200/60 dark:border-sky-800">
              {{ participant.pin }}
            </span>
          </div>
        </div>

        <!-- Sync Method Tabs -->
        <div class="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-semibold">
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all inline-flex items-center justify-center gap-1"
            :class="activeTab === 'qr'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="activeTab = 'qr'"
          >
            <UIcon name="i-lucide-qr-code" class="h-3.5 w-3.5" />
            <span>QR Code</span>
          </button>

          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all inline-flex items-center justify-center gap-1"
            :class="activeTab === 'link'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="activeTab = 'link'"
          >
            <UIcon name="i-lucide-link-2" class="h-3.5 w-3.5" />
            <span>Link Personale</span>
          </button>

          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-center transition-all inline-flex items-center justify-center gap-1"
            :class="activeTab === 'pin'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="activeTab = 'pin'"
          >
            <UIcon name="i-lucide-key-round" class="h-3.5 w-3.5" />
            <span>Codice PIN</span>
          </button>
        </div>

        <!-- Tab 1: QR Code -->
        <div v-if="activeTab === 'qr'" class="text-center space-y-3 py-1">
          <div class="relative mx-auto inline-block p-3 rounded-2xl bg-white shadow-md border border-slate-200/80 dark:border-slate-700">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="QR Code di accesso rapido"
              class="h-44 w-44 rounded-xl mx-auto"
            />
            <div v-else class="h-44 w-44 flex items-center justify-center">
              <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-sky-500" />
            </div>
          </div>

          <div class="max-w-xs mx-auto">
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">
              {{ t('syncModal.qrTitle') }}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              {{ t('syncModal.qrHelp') }}
            </p>
          </div>
        </div>

        <!-- Tab 2: Link Personale -->
        <div v-else-if="activeTab === 'link'" class="space-y-3 py-1">
          <div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white mb-1">
              {{ t('syncModal.linkTitle') }}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              {{ t('syncModal.linkHelp') }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700 break-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {{ magicUrl }}
          </div>

          <div class="flex flex-col sm:flex-row gap-2 pt-1">
            <UButton
              color="primary"
              variant="solid"
              block
              size="sm"
              @click="copyLink"
              class="font-semibold text-xs flex-1"
            >
              <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="h-4 w-4 mr-1.5" />
              <span>{{ copied ? t('common.copied') : t('syncModal.copyLinkBtn') }}</span>
            </UButton>

            <UButton
              color="neutral"
              variant="outline"
              block
              size="sm"
              @click="shareViaWhatsApp"
              class="font-semibold text-xs flex-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
            >
              <UIcon name="i-lucide-message-circle" class="h-4 w-4 mr-1.5 text-emerald-500" />
              <span>WhatsApp</span>
            </UButton>
          </div>
        </div>

        <!-- Tab 3: PIN -->
        <div v-else class="space-y-3 py-1">
          <div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white mb-1">
              {{ t('syncModal.pinTitle') }}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {{ t('syncModal.pinHelp') }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
            <div class="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span class="text-slate-500 dark:text-slate-400">Nome:</span>
              <span class="font-bold text-slate-900 dark:text-white">{{ participant?.name }}</span>
            </div>

            <div v-if="participant?.pin" class="flex items-center justify-between text-xs py-1">
              <span class="text-slate-500 dark:text-slate-400">{{ t('syncModal.yourPinLabel') }}</span>
              <span class="font-mono font-black text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded text-sm tracking-wider">
                {{ participant.pin }}
              </span>
            </div>

            <div v-else class="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
              {{ t('syncModal.noPinNotice') }}
            </div>
          </div>
        </div>

        <!-- Action close button -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <UButton
            color="primary"
            variant="solid"
            size="md"
            class="font-semibold text-xs px-5 shadow-sm"
            @click="emit('update:open', false)"
          >
            {{ isNewJoin ? t('syncModal.closeBtn') : t('syncModal.closeBtnSimple') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
