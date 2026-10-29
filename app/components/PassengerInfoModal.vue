<script setup lang="ts">
import type { Participant, CarWithSeats } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  open: boolean
  passenger: Participant | null
  car?: CarWithSeats | null
  isOrganizer?: boolean
  myParticipant?: Participant | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'claim', passengerId: string): void
  (e: 'edit', passenger: Participant): void
  (e: 'remove-from-car', passengerId: string): void
  (e: 'reassign', passenger: Participant): void
  (e: 'delete', passengerId: string): void
}>()

const { t } = useI18n()

const cleanPhone = computed(() => {
  if (!props.passenger?.phone) return ''
  return props.passenger.phone.replace(/[\s()-]/g, '')
})

const waLink = computed(() => {
  if (!cleanPhone.value) return ''
  const digits = cleanPhone.value.replace(/\+/g, '')
  return `https://wa.me/${digits}`
})

function handleClaim() {
  if (props.passenger) {
    emit('claim', props.passenger.id)
    emit('update:open', false)
  }
}

function handleEdit() {
  if (props.passenger) {
    emit('edit', props.passenger)
    emit('update:open', false)
  }
}

function handleRemoveFromCar() {
  if (props.passenger) {
    emit('remove-from-car', props.passenger.id)
    emit('update:open', false)
  }
}

function handleReassign() {
  if (props.passenger) {
    emit('reassign', props.passenger)
    emit('update:open', false)
  }
}

function handleDelete() {
  if (props.passenger) {
    emit('delete', props.passenger.id)
    emit('update:open', false)
  }
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="passenger?.name ? `Dettagli Passeggero: ${passenger.name}` : 'Dettagli Passeggero'"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div v-if="passenger" class="space-y-4">
        <!-- Passenger Header Card -->
        <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold text-base shadow-xs">
            <UIcon name="i-lucide-user" class="h-6 w-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                {{ passenger.name }}
              </h4>
              <span
                v-if="passenger.id === myParticipant?.id"
                class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              >
                Tu
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full" :class="car ? 'bg-emerald-500' : 'bg-amber-500'" />
              <span>{{ car ? `A bordo di: ${car.rider.carModel || 'Auto'} (${car.rider.name})` : 'In attesa di assegnazione' }}</span>
            </p>
          </div>
        </div>

        <!-- Location Information -->
        <div class="rounded-2xl border border-sky-100 bg-sky-50/50 p-3.5 dark:border-sky-900/40 dark:bg-sky-950/20 space-y-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
            <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Punto di Ritrovo / Partenza</span>
          </span>
          <p class="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {{ passenger.pickupLocation || 'Non specificato' }}
          </p>
        </div>

        <!-- Notes / Baggage -->
        <div v-if="passenger.notes" class="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 space-y-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <UIcon name="i-lucide-message-square" class="h-3.5 w-3.5" />
            <span>Note & Esigenze</span>
          </span>
          <p class="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
            "{{ passenger.notes }}"
          </p>
        </div>

        <!-- Phone & Direct Contacts -->
        <div v-if="passenger.phone" class="space-y-2 pt-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <UIcon name="i-lucide-phone" class="h-3.5 w-3.5 text-emerald-500" />
            <span>Contatto Telefonico</span>
          </span>

          <div class="flex items-center gap-2 flex-wrap">
            <a
              :href="'tel:' + cleanPhone"
              class="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <UIcon name="i-lucide-phone-call" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{{ passenger.phone }}</span>
            </a>

            <a
              v-if="waLink"
              :href="waLink"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors"
            >
              <UIcon name="i-lucide-message-circle" class="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        <!-- Not logged in: Claim button -->
        <div v-if="!myParticipant" class="pt-2 border-t border-slate-100 dark:border-slate-800">
          <UButton
            color="primary"
            variant="subtle"
            block
            size="sm"
            @click="handleClaim"
            class="font-semibold text-xs"
          >
            <UIcon name="i-lucide-user-check" class="h-4 w-4 mr-1.5" />
            <span>{{ t('eventView.isThisYou') }}</span>
          </UButton>
        </div>

        <!-- Organizer actions -->
        <div v-if="isOrganizer" class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span class="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
            Gestione Organizzatore
          </span>

          <div class="flex items-center gap-2 flex-wrap">
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              @click="handleEdit"
              class="text-xs font-semibold"
            >
              <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 mr-1 text-sky-600" />
              {{ t('common.edit') }}
            </UButton>

            <UButton
              v-if="car"
              color="neutral"
              variant="outline"
              size="xs"
              @click="handleRemoveFromCar"
              class="text-xs font-semibold"
            >
              <UIcon name="i-lucide-log-out" class="h-3.5 w-3.5 mr-1 text-amber-600" />
              Rimuovi dall'auto
            </UButton>

            <UButton
              color="primary"
              variant="outline"
              size="xs"
              @click="handleReassign"
              class="text-xs font-semibold"
            >
              <UIcon name="i-lucide-arrow-left-right" class="h-3.5 w-3.5 mr-1" />
              {{ car ? 'Sposta in altra auto' : 'Assegna a un\'auto' }}
            </UButton>

            <UButton
              color="error"
              variant="ghost"
              size="xs"
              @click="handleDelete"
              class="text-xs font-semibold sm:ml-auto"
            >
              <UIcon name="i-lucide-trash-2" class="h-3.5 w-3.5 mr-1" />
              Rimuovi dall'evento
            </UButton>
          </div>
        </div>

        <!-- Close button -->
        <div class="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('update:open', false)"
          >
            {{ t('common.close') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
