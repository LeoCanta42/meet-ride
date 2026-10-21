<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'
import { useEvent } from '~/composables/useEvent'

const { t, locale } = useI18n()
const { user } = useOrganizerAuth()
const { myEvents, myEventsLoading, loadMyEvents, deleteEvent } = useEvent()
const toast = useToast()

const joinCodeOrUrl = ref('')

onMounted(async () => {
  if (user.value) {
    await loadMyEvents()
  }
})

watch(user, async (currentUser) => {
  if (currentUser) {
    await loadMyEvents()
  }
})

function handleJoinDirect() {
  const input = joinCodeOrUrl.value.trim()
  if (!input) return

  // If full URL was pasted, extract last path segment
  let code = input
  if (input.includes('/events/')) {
    const parts = input.split('/events/')
    if (parts[1]) {
      code = parts[1].split(/[?#]/)[0] || ''
    }
  } else if (input.includes('/e/')) {
    const parts = input.split('/e/')
    if (parts[1]) {
      code = parts[1].split(/[?#]/)[0] || ''
    }
  }

  if (code) {
    navigateTo(`/events/${code}`)
  }
}

async function handleDeleteEvent(id: string) {
  if (confirm(t('events.deleteConfirm'))) {
    const success = await deleteEvent(id)
    if (success) {
      toast.add({
        title: t('common.success'),
        color: 'neutral'
      })
    }
  }
}

function copyEventLink(slugOrId: string, password?: string) {
  if (!import.meta.client) return
  const url = window.location.origin + `/events/${slugOrId}`
  const text = password ? `${url} (Password: ${password})` : url
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  }
  toast.add({
    title: t('common.copied'),
    color: 'success'
  })
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString(locale.value === 'it' ? 'it-IT' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 sm:py-12 sm:px-6 space-y-12 sm:space-y-16">
    <!-- Hero Section -->
    <section class="text-center space-y-6 pt-4 sm:pt-8">
      <div class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 px-3.5 py-1 text-xs font-semibold text-sky-800 backdrop-blur-sm dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
        <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        <span>{{ t('hero.badge') }}</span>
      </div>

      <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto leading-tight">
        {{ t('hero.title') }}
      </h1>

      <p class="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
        {{ t('hero.subtitle') }}
      </p>

      <!-- Quick Action Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <NuxtLink :to="user ? '/events/new' : '/login'">
          <UButton
            color="primary"
            size="lg"
            class="font-bold shadow-lg shadow-sky-500/25 px-6 rounded-xl"
          >
            <UIcon name="i-lucide-calendar-plus" class="h-5 w-5 mr-1" />
            {{ t('hero.createEventBtn') }}
          </UButton>
        </NuxtLink>

        <NuxtLink to="/events/courmayeur-weekend">
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            class="font-semibold rounded-xl"
          >
            <UIcon name="i-lucide-sparkles" class="h-4 w-4 mr-1 text-sky-500" />
            <span>Guarda Evento Demo</span>
          </UButton>
        </NuxtLink>
      </div>

      <!-- Quick Event Join Card -->
      <div class="mx-auto max-w-md pt-4">
        <div class="surface-card rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 text-left mb-2">
            {{ t('hero.joinBoxTitle') }}
          </label>
          <form @submit.prevent="handleJoinDirect" class="flex items-center gap-2">
            <UInput
              v-model="joinCodeOrUrl"
              :placeholder="t('hero.joinBoxPlaceholder')"
              class="flex-1"
              icon="i-lucide-link"
            />
            <UButton
              type="submit"
              color="primary"
              class="font-semibold text-xs shrink-0"
            >
              {{ t('hero.joinBoxBtn') }}
            </UButton>
          </form>
        </div>
      </div>
    </section>

    <!-- Organizer Dashboard: My Events Section -->
    <section v-if="user" id="my-events" class="space-y-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">
            {{ t('dashboard.title') }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ t('dashboard.subtitle') }}
          </p>
        </div>

        <NuxtLink to="/events/new">
          <UButton color="primary" size="sm" class="font-semibold text-xs shadow-sm">
            <UIcon name="i-lucide-plus" class="h-4 w-4 mr-1" />
            {{ t('dashboard.createNew') }}
          </UButton>
        </NuxtLink>
      </div>

      <!-- Loading events -->
      <div v-if="myEventsLoading" class="py-12 text-center text-xs text-slate-500">
        <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin mx-auto text-sky-500 mb-2" />
        {{ t('common.loading') }}
      </div>

      <!-- Empty state -->
      <div
        v-else-if="myEvents.length === 0"
        class="surface-card rounded-3xl p-8 text-center"
      >
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950">
          <UIcon name="i-lucide-calendar" class="h-6 w-6" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-sm">
          {{ t('dashboard.emptyTitle') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {{ t('dashboard.emptyDesc') }}
        </p>
        <NuxtLink to="/events/new" class="inline-block mt-4">
          <UButton color="primary" size="sm" class="font-semibold text-xs">
            {{ t('dashboard.createNew') }}
          </UButton>
        </NuxtLink>
      </div>

      <!-- Events list -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="ev in myEvents"
          :key="ev.id"
          class="surface-card rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span class="font-semibold text-sky-600 dark:text-sky-400">
                {{ formatDate(ev.eventDate) }}
              </span>
              <span class="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-full truncate">
                🔑 {{ ev.sharedPassword }}
              </span>
            </div>

            <h3 class="font-bold text-slate-900 dark:text-white text-base break-words">
              {{ ev.title }}
            </h3>

            <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span class="truncate">{{ ev.destination }}</span>
            </div>

            <!-- Stats badges -->
            <div v-if="ev.stats" class="flex flex-wrap gap-2 pt-2 text-[11px]">
              <span class="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300">
                🚗 {{ ev.stats.ridersCount }} auto
              </span>
              <span class="rounded-lg bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-300">
                {{ ev.stats.availableSeats }} posti liberi
              </span>
              <span class="rounded-lg bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 font-medium text-sky-800 dark:text-sky-300">
                👥 {{ ev.stats.passengersCount }} passeggeri
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
            <NuxtLink :to="`/events/${ev.id}`">
              <UButton color="primary" variant="subtle" size="sm" class="text-xs font-semibold">
                {{ t('events.openPublicLink') }}
                <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 ml-1" />
              </UButton>
            </NuxtLink>

            <div class="flex items-center gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                @click="copyEventLink(ev.slug || ev.id, ev.sharedPassword)"
                title="Copia link evento"
              >
                <UIcon name="i-lucide-copy" class="h-4 w-4" />
              </UButton>

              <UButton
                color="error"
                variant="ghost"
                size="sm"
                @click="handleDeleteEvent(ev.id)"
                title="Elimina evento"
              >
                <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Overview -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
      <div class="surface-card rounded-2xl p-6 space-y-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
          <UIcon name="i-lucide-key-round" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-base">
          {{ t('hero.feature1Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature1Desc') }}
        </p>
      </div>

      <div class="surface-card rounded-2xl p-6 space-y-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <UIcon name="i-lucide-car" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-base">
          {{ t('hero.feature2Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature2Desc') }}
        </p>
      </div>

      <div class="surface-card rounded-2xl p-6 space-y-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
          <UIcon name="i-lucide-route" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-base">
          {{ t('hero.feature3Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature3Desc') }}
        </p>
      </div>
    </section>

    <!-- Demo Event Banner -->
    <section class="rounded-3xl border border-sky-200/80 bg-gradient-to-tr from-sky-50 via-cyan-50/50 to-white p-6 sm:p-8 dark:border-sky-900/60 dark:from-slate-900 dark:via-sky-950/20 dark:to-slate-900">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div class="space-y-1">
          <span class="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Demo Pronta all'Uso
          </span>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white pt-1">
            Weekend Sci e Relax a Courmayeur
          </h3>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Prova subito la visualizzazione auto, la scelta del posto e l'ottimizzatore. Password: <span class="font-mono font-bold text-sky-600 dark:text-sky-400">neve</span>
          </p>
        </div>

        <NuxtLink to="/events/courmayeur-weekend">
          <UButton
            color="primary"
            class="font-semibold text-xs shadow-md shadow-sky-500/20"
          >
            Apri Evento Demo
            <UIcon name="i-lucide-arrow-right" class="h-4 w-4 ml-1" />
          </UButton>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
