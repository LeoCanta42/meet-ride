<script setup lang="ts">
import { useI18n, type Locale } from '~/composables/useI18n'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'
import { useAppearance } from '~/composables/useAppearance'

const { t, locale, setLocale } = useI18n()
const { user, logout } = useOrganizerAuth()
const { isDark, toggleTheme } = useAppearance()

function toggleLanguage() {
  const next: Locale = locale.value === 'it' ? 'en' : 'it'
  setLocale(next)
}

async function handleLogout() {
  await logout()
  navigateTo('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85 pt-safe">
    <div class="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
      <!-- Brand Logo -->
      <NuxtLink to="/" class="group flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90">
        <img
          src="/icons/icon-192.png"
          alt="Meet & Ride"
          class="h-8 w-8 sm:h-10 sm:w-10 rounded-xl shadow-sm group-hover:scale-105 transition-transform"
        />
        <div class="flex items-center">
          <span class="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Meet<span class="text-sky-600 dark:text-sky-400">&</span>Ride
          </span>
          <span class="hidden lg:inline-block ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
            Carpooling
          </span>
        </div>
      </NuxtLink>

      <!-- Navigation links (desktop) -->
      <nav class="hidden md:flex items-center gap-5 text-sm font-medium">
        <NuxtLink
          to="/"
          class="text-slate-600 hover:text-sky-600 transition-colors dark:text-slate-300 dark:hover:text-sky-400"
          active-class="text-sky-600 dark:text-sky-400 font-semibold"
        >
          {{ t('nav.home') }}
        </NuxtLink>

        <NuxtLink
          v-if="user"
          to="/#my-events"
          class="text-slate-600 hover:text-sky-600 transition-colors dark:text-slate-300 dark:hover:text-sky-400"
        >
          {{ t('nav.myEvents') }}
        </NuxtLink>

        <NuxtLink
          v-if="user && (user.isAdmin || user.isApproved)"
          to="/events/new"
          class="text-slate-600 hover:text-sky-600 transition-colors dark:text-slate-300 dark:hover:text-sky-400"
        >
          {{ t('nav.newEvent') }}
        </NuxtLink>
      </nav>

      <!-- Actions & Controls -->
      <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <!-- Language Switcher -->
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="rounded-lg font-mono text-xs font-bold uppercase tracking-wider px-2 py-1.5"
          @click="toggleLanguage"
          :title="locale === 'it' ? 'Switch to English' : 'Passa all\'italiano'"
        >
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-languages" class="h-4 w-4 text-sky-500 shrink-0" />
            <span>{{ locale }}</span>
          </span>
        </UButton>

        <!-- Theme Toggle -->
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="rounded-lg px-2 py-1.5"
          @click="toggleTheme"
          :title="t('nav.theme')"
        >
          <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4 w-4" />
        </UButton>

        <!-- User Authentication State -->
        <template v-if="user">
          <NuxtLink to="/#my-events" class="md:hidden">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              class="rounded-lg px-2 py-1.5"
              :title="t('nav.myEvents')"
            >
              <UIcon name="i-lucide-calendar" class="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </UButton>
          </NuxtLink>

          <NuxtLink v-if="user.isAdmin || user.isApproved" to="/events/new" class="md:hidden">
            <UButton
              color="primary"
              variant="subtle"
              size="xs"
              class="rounded-lg px-2 py-1.5"
              :title="t('nav.newEvent')"
            >
              <UIcon name="i-lucide-plus" class="h-4 w-4" />
            </UButton>
          </NuxtLink>

          <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              {{ user.name.slice(0, 2).toUpperCase() }}
            </div>
            <span class="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[110px] truncate">
              {{ user.name }}
            </span>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            @click="handleLogout"
            class="rounded-lg text-xs px-2 py-1.5"
            :title="t('nav.logout')"
          >
            <UIcon name="i-lucide-log-out" class="h-4 w-4" />
            <span class="hidden lg:inline ml-1">{{ t('nav.logout') }}</span>
          </UButton>
        </template>

        <template v-else>
          <NuxtLink to="/login">
            <UButton
              color="primary"
              variant="solid"
              size="xs"
              class="rounded-lg shadow-sm text-xs font-semibold px-2.5 py-1.5"
            >
              <UIcon name="i-lucide-user" class="h-3.5 w-3.5 shrink-0" />
              <span class="ml-1">{{ t('nav.login') }}</span>
            </UButton>
          </NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
