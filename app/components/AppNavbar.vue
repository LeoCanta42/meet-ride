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
  <header class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <!-- Brand Logo -->
      <NuxtLink to="/" class="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
          <UIcon name="i-lucide-car" class="h-5 w-5" />
        </div>
        <div>
          <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Meet<span class="text-sky-600 dark:text-sky-400">&</span>Ride
          </span>
          <span class="hidden sm:inline-block ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
            Carpooling
          </span>
        </div>
      </NuxtLink>

      <!-- Navigation links (desktop) -->
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium">
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
          v-if="user"
          to="/events/new"
          class="text-slate-600 hover:text-sky-600 transition-colors dark:text-slate-300 dark:hover:text-sky-400"
        >
          {{ t('nav.newEvent') }}
        </NuxtLink>
      </nav>

      <!-- Actions & Controls -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Language Switcher -->
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-lg font-mono text-xs font-bold uppercase tracking-wider"
          @click="toggleLanguage"
          :title="locale === 'it' ? 'Switch to English' : 'Passa all\'italiano'"
        >
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-languages" class="h-4 w-4 text-sky-500" />
            <span>{{ locale }}</span>
          </span>
        </UButton>

        <!-- Theme Toggle -->
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-lg"
          @click="toggleTheme"
          :title="t('nav.theme')"
        >
          <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="h-4 w-4" />
        </UButton>

        <!-- User Authentication State -->
        <template v-if="user">
          <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              {{ user.name.slice(0, 2).toUpperCase() }}
            </div>
            <span class="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
              {{ user.name }}
            </span>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleLogout"
            class="rounded-lg text-xs"
            :title="t('nav.logout')"
          >
            <UIcon name="i-lucide-log-out" class="h-4 w-4" />
            <span class="hidden md:inline">{{ t('nav.logout') }}</span>
          </UButton>
        </template>

        <template v-else>
          <NuxtLink to="/login">
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              class="rounded-lg shadow-sm text-xs font-semibold"
            >
              <UIcon name="i-lucide-user" class="h-4 w-4" />
              <span>{{ t('nav.login') }}</span>
            </UButton>
          </NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
