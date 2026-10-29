<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useEvent } from '~/composables/useEvent'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'

const { t } = useI18n()
const { createEvent } = useEvent()
const { user, initialLoaded } = useOrganizerAuth()
const toast = useToast()

const title = ref('')
const destination = ref('')
const eventDate = ref('')
const arrivalTime = ref('20:30')
const sharedPassword = ref('')
const showPassword = ref(true)
const description = ref('')
const loading = ref(false)
const errorMessage = ref('')

// Initialize default date (next Saturday at 20:30 local time)
onMounted(() => {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  d.setHours(20, 30, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  eventDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  arrivalTime.value = '20:30'
  generatePassword()
})

watch(eventDate, (newVal) => {
  if (newVal && newVal.includes('T')) {
    const timePart = newVal.split('T')[1]?.slice(0, 5)
    if (timePart) {
      arrivalTime.value = timePart
    }
  }
})

watch([user, initialLoaded], ([currentUser, loaded]) => {
  if (loaded && !currentUser) {
    navigateTo('/login')
  }
}, { immediate: true })

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
    const res = await createEvent({
      title: title.value.trim(),
      destination: destination.value.trim(),
      eventDate: new Date(eventDate.value).toISOString(),
      arrivalTime: arrivalTime.value.trim() || undefined,
      sharedPassword: sharedPassword.value.trim(),
      description: description.value.trim()
    })

    if (res.success && res.event) {
      toast.add({
        title: t('common.success'),
        description: t('events.createTitle'),
        color: 'success'
      })
      navigateTo(`/events/${res.event.id}`)
    } else {
      errorMessage.value = res.error || t('common.error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 sm:py-12">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <NuxtLink to="/" class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-sky-600 mb-2 transition-colors">
          <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
          {{ t('common.back') }}
        </NuxtLink>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {{ t('events.createTitle') }}
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {{ t('events.createSubtitle') }}
        </p>
      </div>
    </div>

    <!-- Pending Approval Warning Card -->
    <div
      v-if="user && !user.isAdmin && !user.isApproved"
      class="surface-card rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-center space-y-4"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300 shadow-sm">
        <UIcon name="i-lucide-clock" class="h-7 w-7" />
      </div>
      <div class="space-y-1.5 max-w-md mx-auto">
        <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Account in attesa di approvazione
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Il tuo account è stato registrato ma deve essere approvato dall'amministratore prima di poter creare nuovi eventi. L'amministratore verificherà e abiliterà manualmente il tuo profilo.
        </p>
      </div>
      <div class="pt-2">
        <NuxtLink to="/">
          <UButton color="neutral" variant="outline" size="sm" class="font-semibold text-xs">
            <UIcon name="i-lucide-arrow-left" class="h-4 w-4 mr-1" />
            Torna alla Dashboard
          </UButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Event Creation Form -->
    <div v-else class="surface-card rounded-3xl p-6 sm:p-8 shadow-xl">
      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Title -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('events.title') }} *
          </label>
          <UInput
            v-model="title"
            :placeholder="t('events.titlePlaceholder')"
            required
            size="lg"
            class="w-full font-semibold"
          />
        </div>

        <!-- Destination -->
        <div>
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

        <!-- Date & Arrival Time -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              Orario di arrivo *
            </label>
            <UInput
              v-model="arrivalTime"
              type="time"
              placeholder="20:30"
              icon="i-lucide-clock"
              required
              class="w-full font-mono font-medium"
            />
            <span class="text-[10px] text-slate-400 mt-1 block">
              Usato dall'AI per calcolare partenze e ritrovi
            </span>
          </div>
        </div>

        <!-- Shared Password -->
        <div class="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-950 dark:bg-sky-950/20">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <UIcon name="i-lucide-key" class="h-4 w-4 text-sky-500" />
              <span>{{ t('events.sharedPassword') }} *</span>
            </label>

            <button
              type="button"
              @click="generatePassword"
              class="text-[11px] font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
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
            class="w-full"
          />
        </div>

        <!-- Error display -->
        <div v-if="errorMessage" class="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {{ errorMessage }}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <NuxtLink to="/">
            <UButton color="neutral" variant="ghost">
              {{ t('common.cancel') }}
            </UButton>
          </NuxtLink>

          <UButton
            type="submit"
            color="primary"
            size="lg"
            :loading="loading"
            class="font-semibold shadow-md shadow-sky-500/20"
          >
            <UIcon name="i-lucide-plus" class="h-5 w-5 mr-1" />
            {{ t('events.createSubmit') }}
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
