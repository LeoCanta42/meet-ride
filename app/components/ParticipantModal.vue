<script setup lang="ts">
import type { Participant, ParticipantRole } from '~/types'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  open: boolean
  initialData?: Participant | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', data: Partial<Participant>): void
}>()

const { t } = useI18n()

const role = ref<ParticipantRole>('passenger')
const name = ref('')
const phone = ref('')
const notes = ref('')

// Rider fields
const carModel = ref('')
const totalSeats = ref<number>(4)
const departureLocation = ref('')
const departureTime = ref('')

// Passenger fields
const pickupLocation = ref('')

const isEdit = computed(() => !!props.initialData)

watch(() => props.open, (val) => {
  if (val) {
    if (props.initialData) {
      role.value = props.initialData.role
      name.value = props.initialData.name
      phone.value = props.initialData.phone || ''
      notes.value = props.initialData.notes || ''
      carModel.value = props.initialData.carModel || ''
      totalSeats.value = props.initialData.totalSeats || 4
      departureLocation.value = props.initialData.departureLocation || ''
      departureTime.value = props.initialData.departureTime || ''
      pickupLocation.value = props.initialData.pickupLocation || ''
    } else {
      // defaults for new registration
      role.value = 'passenger'
      name.value = ''
      phone.value = ''
      notes.value = ''
      carModel.value = ''
      totalSeats.value = 4
      departureLocation.value = ''
      departureTime.value = ''
      pickupLocation.value = ''
    }
  }
})

function handleSubmit() {
  if (!name.value.trim()) return

  const payload: Partial<Participant> = {
    name: name.value.trim(),
    role: role.value,
    phone: phone.value.trim() || undefined,
    notes: notes.value.trim() || undefined
  }

  if (role.value === 'rider') {
    payload.carModel = carModel.value.trim() || 'Auto'
    payload.totalSeats = Number(totalSeats.value) || 4
    payload.departureLocation = departureLocation.value.trim() || undefined
    payload.departureTime = departureTime.value.trim() || undefined
  } else {
    payload.pickupLocation = pickupLocation.value.trim() || undefined
  }

  emit('submit', payload)
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="isEdit ? t('participantModal.titleEdit') : t('participantModal.titleJoin')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Role Selector (Driver vs Passenger) -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {{ t('participantModal.roleQuestion') }}
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex flex-col items-center justify-center p-3 rounded-xl border text-left transition-all"
              :class="role === 'passenger'
                ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'"
              @click="role = 'passenger'"
            >
              <UIcon name="i-lucide-user" class="h-6 w-6 text-sky-600 dark:text-sky-400 mb-1" />
              <span class="text-xs font-bold text-center">{{ t('participantModal.rolePassenger') }}</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1 leading-tight">
                {{ t('participantModal.rolePassengerDesc') }}
              </span>
            </button>

            <button
              type="button"
              class="flex flex-col items-center justify-center p-3 rounded-xl border text-left transition-all"
              :class="role === 'rider'
                ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'"
              @click="role = 'rider'"
            >
              <UIcon name="i-lucide-car" class="h-6 w-6 text-emerald-600 dark:text-emerald-400 mb-1" />
              <span class="text-xs font-bold text-center">{{ t('participantModal.roleRider') }}</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1 leading-tight">
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
              <span class="text-[10px] text-slate-400 font-normal ml-1">(anche solo nome o nickname)</span>
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
              <span class="text-[10px] text-slate-400 font-normal ml-1">(opzionale)</span>
            </label>
            <UInput
              v-model="phone"
              :placeholder="t('participantModal.phonePlaceholder')"
              type="tel"
              class="w-full"
            />
            <p class="text-[10px] text-slate-400 mt-0.5">Visibile solo ai compagni di viaggio</p>
          </div>
        </div>

        <!-- Rider Fields -->
        <template v-if="role === 'rider'">
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
              </label>
              <UInput
                v-model.number="totalSeats"
                type="number"
                min="1"
                max="8"
                class="w-full"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.departureLocationLabel') }}
              </label>
              <UInput
                v-model="departureLocation"
                :placeholder="t('participantModal.departureLocationPlaceholder')"
                class="w-full"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('participantModal.departureTimeLabel') }}
              </label>
              <UInput
                v-model="departureTime"
                :placeholder="t('participantModal.departureTimePlaceholder')"
                class="w-full"
              />
            </div>
          </div>
        </template>

        <!-- Passenger Fields -->
        <template v-else>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('participantModal.pickupLocationLabel') }}
            </label>
            <UInput
              v-model="pickupLocation"
              :placeholder="t('participantModal.pickupLocationPlaceholder')"
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
        <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
