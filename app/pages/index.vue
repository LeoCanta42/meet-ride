<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'
import { useEvent } from '~/composables/useEvent'

const { t, locale } = useI18n()
const { user } = useOrganizerAuth()
const { myEvents, myEventsLoading, loadMyEvents, deleteEvent } = useEvent()
const toast = useToast()

const joinCodeOrUrl = ref('')
const activeDashboardTab = ref<'events' | 'users'>('events')
const eventsScope = ref<'all' | 'mine'>('all')
const adminUsers = ref<any[]>([])
const adminUsersLoading = ref(false)
const userFilter = ref<'all' | 'pending' | 'approved'>('all')
const userSearch = ref('')

const pendingUsersCount = computed(() => {
  return adminUsers.value.filter(u => !u.isAdmin && !u.isApproved).length
})

const filteredUsers = computed(() => {
  let list = adminUsers.value
  if (userFilter.value === 'pending') {
    list = list.filter(u => !u.isAdmin && !u.isApproved)
  } else if (userFilter.value === 'approved') {
    list = list.filter(u => u.isAdmin || u.isApproved)
  }
  const q = userSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }
  return list
})

async function loadAdminUsers() {
  if (!user.value?.isAdmin && user.value?.role !== 'admin') return
  adminUsersLoading.value = true
  try {
    const res = await $fetch<{ users: any[] }>('/api/admin/users')
    adminUsers.value = res.users || []
  } catch (err) {
    console.error('Failed loading admin users:', err)
  } finally {
    adminUsersLoading.value = false
  }
}

async function setUserApproval(userId: string, isApproved: boolean) {
  try {
    await $fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: { isApproved }
    })
    toast.add({
      title: isApproved ? 'Utente abilitato con successo' : 'Abilitazione revocata',
      color: isApproved ? 'success' : 'neutral'
    })
    await loadAdminUsers()
  } catch (err: any) {
    toast.add({
      title: err.data?.statusMessage || 'Errore durante l\'aggiornamento',
      color: 'error'
    })
  }
}

async function handleDeleteUser(userId: string, userName: string) {
  if (confirm(`Sei sicuro di voler eliminare l'utente "${userName}" e tutti i suoi eventi associati?`)) {
    try {
      await $fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Utente eliminato con successo',
        color: 'success'
      })
      await loadAdminUsers()
      await loadMyEvents(eventsScope.value)
    } catch (err: any) {
      toast.add({
        title: err.data?.statusMessage || 'Errore durante l\'eliminazione',
        color: 'error'
      })
    }
  }
}

onMounted(async () => {
  if (user.value) {
    await loadMyEvents(eventsScope.value)
    if (user.value.isAdmin || user.value.role === 'admin') {
      await loadAdminUsers()
    }
  }
})

watch(user, async (currentUser) => {
  if (currentUser) {
    await loadMyEvents(eventsScope.value)
    if (currentUser.isAdmin || currentUser.role === 'admin') {
      await loadAdminUsers()
    }
  }
})

watch(eventsScope, async (newScope) => {
  if (user.value) {
    await loadMyEvents(newScope)
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

    <!-- Organizer Dashboard: My Events & Admin Management Section -->
    <section v-if="user" id="my-events" class="space-y-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
      <!-- Non-Approved User Notice Banner -->
      <div
        v-if="!user.isAdmin && !user.isApproved"
        class="rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 p-4 sm:p-5 dark:border-amber-900/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div class="flex items-start gap-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300 shadow-sm">
            <UIcon name="i-lucide-clock" class="h-5 w-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-amber-950 dark:text-amber-200">
                Profilo in attesa di abilitazione
              </h3>
              <span class="rounded-full bg-amber-200/80 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 dark:text-amber-200">
                In Verifica
              </span>
            </div>
            <p class="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-2xl leading-relaxed">
              Il tuo account è stato registrato ma deve essere approvato dall'amministratore prima di poter creare nuovi eventi. Non è necessaria alcuna verifica email: riceverai l'abilitazione non appena l'amministratore approverà il tuo account.
            </p>
          </div>
        </div>

        <span class="text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">
          ⏳ In attesa dell'admin
        </span>
      </div>

      <!-- Admin Top Tabs Navigation -->
      <div v-if="user.isAdmin || user.role === 'admin'" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 self-start">
          <button
            type="button"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeDashboardTab === 'events' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            @click="activeDashboardTab = 'events'"
          >
            <UIcon name="i-lucide-calendar" class="h-4 w-4" />
            <span>Gestione Eventi</span>
            <span class="text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2">
              {{ myEvents.length }}
            </span>
          </button>

          <button
            type="button"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeDashboardTab === 'users' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            @click="activeDashboardTab = 'users'"
          >
            <UIcon name="i-lucide-users" class="h-4 w-4" />
            <span>Gestione Utenti</span>
            <span
              v-if="pendingUsersCount > 0"
              class="rounded-full bg-amber-500 text-white font-extrabold text-[10px] px-1.5 py-0.2 animate-pulse"
              title="Utenti in attesa di approvazione"
            >
              {{ pendingUsersCount }} in attesa
            </span>
            <span v-else class="text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2">
              {{ adminUsers.length }}
            </span>
          </button>
        </div>

        <!-- Admin events scope filter -->
        <div v-if="activeDashboardTab === 'events'" class="flex items-center gap-2">
          <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Mostra:</span>
          <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              :class="eventsScope === 'all' ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400'"
              @click="eventsScope = 'all'"
            >
              Tutti gli eventi
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              :class="eventsScope === 'mine' ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400'"
              @click="eventsScope = 'mine'"
            >
              I miei eventi
            </button>
          </div>
        </div>
      </div>

      <!-- TAB 1: EVENTS SECTION -->
      <div v-if="activeDashboardTab === 'events'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">
              {{ user.isAdmin || user.role === 'admin' ? (eventsScope === 'all' ? 'Tutti gli Eventi della Piattaforma' : 'I Miei Eventi') : t('dashboard.title') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ user.isAdmin || user.role === 'admin' ? 'Come amministratore hai pieno controllo per gestire, modificare ed eliminare qualsiasi evento.' : t('dashboard.subtitle') }}
            </p>
          </div>

          <NuxtLink v-if="user.isAdmin || user.isApproved" to="/events/new">
            <UButton color="primary" size="sm" class="font-semibold text-xs shadow-sm cursor-pointer">
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
          <NuxtLink v-if="user.isAdmin || user.isApproved" to="/events/new" class="inline-block mt-4">
            <UButton color="primary" size="sm" class="font-semibold text-xs cursor-pointer">
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

              <div class="flex items-start justify-between gap-2">
                <h3 class="font-bold text-slate-900 dark:text-white text-base break-words">
                  {{ ev.title }}
                </h3>
              </div>

              <!-- Creator attribution badge for Admin view -->
              <div v-if="(user.isAdmin || user.role === 'admin') && (ev as any).creatorName" class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <UIcon name="i-lucide-user" class="h-3 w-3 text-sky-500" />
                <span>Creato da: <strong>{{ (ev as any).creatorName }}</strong> ({{ (ev as any).creatorEmail }})</span>
              </div>

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
                <UButton color="primary" variant="subtle" size="sm" class="text-xs font-semibold cursor-pointer">
                  {{ t('events.openPublicLink') }}
                  <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 ml-1" />
                </UButton>
              </NuxtLink>

              <div class="flex items-center gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                  @click="copyEventLink(ev.slug || ev.id, ev.sharedPassword)"
                  title="Copia link evento"
                >
                  <UIcon name="i-lucide-copy" class="h-4 w-4" />
                </UButton>

                <UButton
                  color="error"
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                  @click="handleDeleteEvent(ev.id)"
                  title="Elimina evento"
                >
                  <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: USERS & APPROVALS MANAGEMENT (Admin only) -->
      <div v-else-if="activeDashboardTab === 'users' && (user.isAdmin || user.role === 'admin')" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Gestione Utenti Registrati & Abilitazioni</span>
              <span class="rounded-full bg-indigo-100 dark:bg-indigo-950 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                Pannello Admin
              </span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualizza gli utenti registrati, abilita o revoca il permesso di creare eventi ed elimina profili.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            :loading="adminUsersLoading"
            class="self-start sm:self-auto font-semibold text-xs cursor-pointer"
            @click="loadAdminUsers"
          >
            <UIcon name="i-lucide-refresh-cw" class="h-3.5 w-3.5 mr-1" />
            Aggiorna lista
          </UButton>
        </div>

        <!-- Filters & Search Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              class="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer"
              :class="userFilter === 'all' ? 'bg-sky-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'"
              @click="userFilter = 'all'"
            >
              Tutti ({{ adminUsers.length }})
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              :class="userFilter === 'pending' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100'"
              @click="userFilter = 'pending'"
            >
              <span class="h-2 w-2 rounded-full bg-amber-500" />
              In attesa ({{ pendingUsersCount }})
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              :class="userFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'"
              @click="userFilter = 'approved'"
            >
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              Abilitati ({{ adminUsers.filter(u => u.isAdmin || u.isApproved).length }})
            </button>
          </div>

          <div class="w-full sm:w-64">
            <UInput
              v-model="userSearch"
              placeholder="Cerca nome o email..."
              icon="i-lucide-search"
              size="sm"
              class="w-full text-xs"
            />
          </div>
        </div>

        <!-- Users Loading State -->
        <div v-if="adminUsersLoading" class="py-12 text-center text-xs text-slate-500">
          <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin mx-auto text-sky-500 mb-2" />
          Caricamento utenti in corso...
        </div>

        <!-- Empty Users List -->
        <div
          v-else-if="filteredUsers.length === 0"
          class="surface-card rounded-2xl p-8 text-center text-xs text-slate-500"
        >
          <UIcon name="i-lucide-users" class="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <span class="font-bold block text-slate-700 dark:text-slate-300">Nessun utente trovato</span>
          <span class="text-slate-400 mt-1 block">Nessun utente corrisponde ai filtri selezionati.</span>
        </div>

        <!-- Users Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="u in filteredUsers"
            :key="u.id"
            class="surface-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div class="space-y-2.5">
              <div class="flex items-start justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-700 dark:text-slate-300 font-extrabold text-sm shadow-2xs">
                    {{ (u.name || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {{ u.name }}
                    </h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {{ u.email }}
                    </p>
                  </div>
                </div>

                <!-- Badges -->
                <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <span
                    v-if="u.isAdmin"
                    class="rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-shield-check" class="h-3 w-3" />
                    Admin
                  </span>
                  <span
                    v-else-if="u.isApproved"
                    class="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-check-circle-2" class="h-3 w-3" />
                    Abilitato
                  </span>
                  <span
                    v-else
                    class="rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 animate-pulse"
                  >
                    <UIcon name="i-lucide-clock" class="h-3 w-3" />
                    In Attesa
                  </span>
                </div>
              </div>

              <!-- Meta info -->
              <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Registrato il: <strong>{{ formatDate(u.createdAt) }}</strong></span>
                <span>Eventi creati: <strong>{{ u.eventsCount }}</strong></span>
              </div>
            </div>

            <!-- Actions Bar -->
            <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div class="flex items-center gap-2">
                <!-- Approve Button -->
                <UButton
                  v-if="!u.isAdmin && !u.isApproved"
                  color="primary"
                  size="xs"
                  class="font-bold cursor-pointer"
                  @click="setUserApproval(u.id, true)"
                >
                  <UIcon name="i-lucide-check" class="h-3.5 w-3.5 mr-1" />
                  Abilita Profilo
                </UButton>

                <!-- Revoke Button -->
                <UButton
                  v-else-if="!u.isAdmin && u.isApproved"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  class="font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                  @click="setUserApproval(u.id, false)"
                >
                  <UIcon name="i-lucide-x" class="h-3.5 w-3.5 mr-1" />
                  Revoca Abilitazione
                </UButton>

                <span v-else-if="u.isAdmin" class="text-[11px] text-slate-400 font-medium italic">
                  Account Super Admin
                </span>
              </div>

              <!-- Delete Button -->
              <UButton
                v-if="!u.isAdmin"
                color="error"
                variant="ghost"
                size="xs"
                class="cursor-pointer"
                title="Elimina account utente"
                @click="handleDeleteUser(u.id, u.name)"
              >
                <UIcon name="i-lucide-trash-2" class="h-3.5 w-3.5 text-rose-500" />
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Overview -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
      <div class="surface-card rounded-2xl p-5 space-y-2.5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
          <UIcon name="i-lucide-key-round" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-sm">
          {{ t('hero.feature1Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature1Desc') }}
        </p>
      </div>

      <div class="surface-card rounded-2xl p-5 space-y-2.5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <UIcon name="i-lucide-car" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-sm">
          {{ t('hero.feature2Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature2Desc') }}
        </p>
      </div>

      <div class="surface-card rounded-2xl p-5 space-y-2.5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <UIcon name="i-lucide-smartphone" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-sm">
          {{ t('hero.feature4Title') }}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {{ t('hero.feature4Desc') }}
        </p>
      </div>

      <div class="surface-card rounded-2xl p-5 space-y-2.5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
          <UIcon name="i-lucide-route" class="h-5 w-5" />
        </div>
        <h3 class="font-bold text-slate-900 dark:text-white text-sm">
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
