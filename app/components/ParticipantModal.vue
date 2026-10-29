<script setup lang="ts">
import type { Participant, ParticipantRole } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  open: boolean
  initialData?: Participant | null
  isOrganizerAction?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', data: Partial<Participant>): void
}>()

const { t } = useI18n()

const role = ref<ParticipantRole>('passenger')
const name = ref('')
const phone = ref('')
const pin = ref('')
const showPin = ref(false)
const notes = ref('')

// Rider fields
const carModel = ref('')
const totalSeats = ref<number>(4)
const price = ref<string>('')
const departureLocation = ref('')
const departureTime = ref('')
const hasDriver = ref<boolean>(true)

// Passenger fields
const pickupLocation = ref('')

const isEdit = computed(() => Boolean(props.initialData?.id))

const numericPrice = computed(() => {
  const val = Number(price.value)
  return !Number.isNaN(val) && val > 0 ? val : 0
})

const fullCarPeopleCount = computed(() => {
  const seats = Math.max(1, Math.min(12, Number(totalSeats.value) || 4))
  return (hasDriver.value ? 1 : 0) + seats
})

function formatEuro(val: number): string {
  return Number.isInteger(val) ? `${val}` : val.toFixed(2)
}

function generateRandomPin() {
  const code = Math.floor(1000 + Math.random() * 9000).toString()
  pin.value = code
  showPin.value = true
}

function handlePinInput(e: Event) {
  const target = e.target as HTMLInputElement
  if (target) {
    pin.value = target.value.replace(/\s+/g, '')
  }
}

watch([() => props.open, () => props.initialData], ([val]) => {
  if (val) {
    if (props.initialData) {
      role.value = props.initialData.role || 'passenger'
      name.value = props.initialData.name || ''
      phone.value = props.initialData.phone || ''
      pin.value = props.initialData.pin || ''
      notes.value = props.initialData.notes || ''
      carModel.value = props.initialData.carModel || ''
      totalSeats.value = Number(props.initialData.totalSeats) || 4
      price.value = props.initialData.price !== undefined && props.initialData.price !== null && props.initialData.price > 0
        ? String(props.initialData.price)
        : ''
      departureLocation.value = props.initialData.departureLocation || ''
      departureTime.value = props.initialData.departureTime || ''
      hasDriver.value = props.initialData.hasDriver !== false
      pickupLocation.value = props.initialData.pickupLocation || ''
    } else {
      role.value = 'passenger'
      name.value = ''
      phone.value = ''
      pin.value = ''
      notes.value = ''
      carModel.value = ''
      totalSeats.value = 4
      price.value = ''
      departureLocation.value = ''
      departureTime.value = ''
      hasDriver.value = true
      pickupLocation.value = ''
    }
  }
})

function handleSubmit() {
  if (!name.value.trim()) return

  if (role.value === 'rider') {
    if (!departureLocation.value.trim()) return
  } else {
    if (!pickupLocation.value.trim()) return
  }

  const payload: Partial<Participant> = {
    name: name.value.trim(),
    role: role.value,
    phone: phone.value.trim() || undefined,
    pin: pin.value.trim() || undefined,
    notes: notes.value.trim() || undefined
  }

  if (role.value === 'rider') {
    payload.carModel = carModel.value.trim() || 'Auto'
    payload.totalSeats = Math.max(1, Math.min(12, Number(totalSeats.value) || 4))
    payload.price = numericPrice.value > 0 ? Math.round(numericPrice.value * 100) / 100 : null
    payload.departureLocation = departureLocation.value.trim()
    payload.departureTime = departureTime.value.trim() || undefined
    payload.hasDriver = hasDriver.value
  } else {
    payload.pickupLocation = pickupLocation.value.trim()
    payload.price = null
  }

  emit('submit', payload)
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="isEdit ? t('participantModal.titleEdit') : (isOrganizerAction ? (role === 'rider' ? t('eventView.orgAddCar') : t('eventView.orgAddPerson')) : (role === 'rider' ? t('eventView.imDriving') : t('participantModal.titleJoin')))"
    :ui="{ content: 'sm:max-w-lg max-h-[90dvh] overflow-y-auto' }"
  >
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Role Selector (Driver vs Passenger) -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {{ t('participantModal.roleQuestion') }}
          </label>
          <div class="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              class="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer"
              :class="role === 'passenger'
                ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'"
              @click="role = 'passenger'"
            >
              <UIcon name="i-lucide-user" class="h-5 w-5 sm:h-6 sm:w-6 text-sky-600 dark:text-sky-400 mb-1 shrink-0" />
              <span class="text-[11px] sm:text-xs font-bold leading-snug">{{ t('participantModal.rolePassenger') }}</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight line-clamp-2">
                {{ t('participantModal.rolePassengerDesc') }}
              </span>
            </button>

            <button
              type="button"
              class="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer"
              :class="role === 'rider'
                ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'"
              @click="role = 'rider'"
            >
              <UIcon name="i-lucide-car" class="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400 mb-1 shrink-0" />
              <span class="text-[11px] sm:text-xs font-bold leading-snug">{{ t('participantModal.roleRider') }}</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight line-clamp-2">
                {{ t('participantModal.roleRiderDesc') }}
              </span>
            </button>
          </div>
        </div>

        <!-- Common: Name & Phone -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('participantModal.nameLabel') }} *
              <span class="text-[10px] text-slate-400 font-normal ml-1">{{ t('participantModal.nameHelp') }}</span>
            </label>
            <UInput
              v-model="name"
              :placeholder="t('participantModal.namePlaceholder')"
              required
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('participantModal.phoneLabel') }}
              <span class="text-[10px] text-slate-400 font-normal ml-1">({{ t('common.optional') }})</span>
            </label>
            <UInput
              v-model="phone"
              :placeholder="t('participantModal.phonePlaceholder')"
              type="tel"
              class="w-full"
            />
          </div>
        </div>

        <!-- Cross-Device Quick Access / PIN Box -->
        <div class="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3 sm:p-3.5 dark:border-sky-900/60 dark:bg-sky-950/20 space-y-2.5">
          <div class="flex items-start gap-2.5">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-300">
              <UIcon name="i-lucide-smartphone" class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">
                  {{ t('participantModal.deviceSyncCardTitle') }}
                </h4>
                <span class="rounded bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                  {{ t('participantModal.deviceSyncCardBadge') }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                {{ t('participantModal.deviceSyncCardDesc') }}
              </p>
            </div>
          </div>

          <div class="space-y-1.5 pt-0.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {{ t('participantModal.pinLabel') }}
              </label>
              <button
                type="button"
                @click="generateRandomPin"
                class="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 transition-colors"
              >
                <UIcon name="i-lucide-sparkles" class="h-3 w-3" />
                <span>{{ t('participantModal.pinGenerateBtn') }}</span>
              </button>
            </div>

            <UInput
              v-model="pin"
              :type="showPin ? 'text' : 'password'"
              :placeholder="isEdit && initialData?.hasPin ? '•••• (lascia vuoto per mantenere il PIN)' : t('participantModal.pinPlaceholder')"
              maxlength="8"
              inputmode="numeric"
              icon="i-lucide-key-round"
              :ui="{ trailing: 'pe-1' }"
              class="w-full font-mono"
              :class="pin ? 'font-bold tracking-widest text-center' : 'font-normal tracking-normal'"
              @input="handlePinInput"
            >
              <template #trailing>
                <UButton
                  type="button"
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPin ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPin ? t('common.hidePassword') : t('common.showPassword')"
                  tabindex="-1"
                  @pointerdown.prevent
                  @click="showPin = !showPin"
                />
              </template>
            </UInput>

            <p class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
              <UIcon name="i-lucide-info" class="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <span>{{ t('participantModal.pinHelp') }}</span>
            </p>
          </div>
        </div>

        <!-- Rider Fields -->
        <template v-if="role === 'rider'">
          <!-- Who is driving Vehicle -->
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('participantModal.hasDriverLabel') }}
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                class="p-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 font-medium cursor-pointer"
                :class="hasDriver ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'"
                @click="hasDriver = true"
              >
                <UIcon name="i-lucide-steering-wheel" class="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{{ t('participantModal.hasDriverYes') }}</span>
              </button>
              <button
                type="button"
                class="p-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 font-medium cursor-pointer"
                :class="!hasDriver ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'"
                @click="hasDriver = false"
              >
                <UIcon name="i-lucide-car" class="h-4 w-4 text-amber-600 shrink-0" />
                <span>{{ t('participantModal.hasDriverNo') }}</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.carModelLabel') }}
              </label>
              <UInput
                v-model="carModel"
                :placeholder="t('participantModal.carModelPlaceholder')"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.totalSeatsLabel') }}
                <span class="text-[10px] text-slate-400 font-normal ml-1">(1-12)</span>
              </label>
              <UInput
                v-model.number="totalSeats"
                type="number"
                min="1"
                max="12"
                class="w-full"
              />
            </div>
          </div>

          <!-- Total Car Price + Automatic Per-Person Split Preview -->
          <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-2">
            <div>
              <label class="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <UIcon name="i-lucide-euro" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{{ t('participantModal.priceLabel') }}</span>
                <span class="text-[10px] text-slate-400 font-normal">({{ t('common.optional') }})</span>
              </label>
              <UInput
                v-model="price"
                type="number"
                min="0"
                max="10000"
                step="0.5"
                :placeholder="t('participantModal.pricePlaceholder')"
                icon="i-lucide-coins"
                class="w-full"
              />
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {{ t('participantModal.priceHelp') }}
              </p>
            </div>

            <!-- Live per-person split preview -->
            <div
              v-if="numericPrice > 0"
              class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-[11px] border border-emerald-200/60 dark:bg-slate-900/80 dark:border-emerald-900/50"
            >
              <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <UIcon name="i-lucide-calculator" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Con 1 passeggero ({{ (hasDriver ? 1 : 0) + 1 }} persone): <strong>€{{ formatEuro(numericPrice / ((hasDriver ? 1 : 0) + 1)) }}</strong>/testa</span>
              </div>
              <div class="font-semibold text-emerald-700 dark:text-emerald-300">
                {{ t('car.whenFull') }} ({{ fullCarPeopleCount }} persone): €{{ formatEuro(numericPrice / fullCarPeopleCount) }}/testa
              </div>
            </div>
          </div>

          <!-- Departure Location & Departure Time -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.departureLocationLabel') }} *
              </label>
              <UInput
                v-model="departureLocation"
                :placeholder="t('participantModal.departureLocationPlaceholder')"
                icon="i-lucide-map-pin"
                required
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.departureTimeLabel') }}
              </label>
              <UInput
                v-model="departureTime"
                type="time"
                :placeholder="t('participantModal.departureTimePlaceholder')"
                icon="i-lucide-clock"
                class="w-full font-mono"
              />
            </div>
          </div>
        </template>

        <!-- Passenger Fields -->
        <template v-else>
          <!-- Pickup Location (Mandatory for Passenger) -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('participantModal.pickupLocationLabel') }} *
            </label>
            <UInput
              v-model="pickupLocation"
              :placeholder="t('participantModal.pickupLocationPlaceholder')"
              required
              class="w-full"
            />
          </div>
        </template>

        <!-- Additional Notes -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('participantModal.notesLabel') }}
          </label>
          <UTextarea
            v-model="notes"
            :placeholder="t('participantModal.notesPlaceholder')"
            :rows="2"
            class="w-full"
          />
        </div>

        <!-- Buttons -->
        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('update:open', false)"
          >
            {{ t('common.cancel') }}
          </UButton>

          <UButton
            type="submit"
            color="primary"
            class="font-semibold"
          >
            {{ role === 'rider' ? t('participantModal.submitRider') : t('participantModal.submitPassenger') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
