<script setup lang="ts">
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'
import { useAppearance } from '~/composables/useAppearance'
import { useI18n } from '~/composables/useI18n'
import { usePwa } from '~/composables/usePwa'

const { fetchMe } = useOrganizerAuth()
useAppearance()
const { t } = useI18n()
const { isInstalled, isInstallModalOpen, triggerInstall } = usePwa()

const isPrivacyOpen = ref(false)

onMounted(async () => {
  await fetchMe()
})

useSeoMeta({
  title: 'Meet & Ride — Carpooling & Posti Auto per Eventi',
  description: 'Organizza i passaggi in auto per i tuoi eventi e ottimizza i posti disponibili in base alla posizione.',
  ogTitle: 'Meet & Ride',
  ogDescription: 'Carpooling e allocazione posti auto intelligente per eventi.'
})
</script>

<template>
  <UApp>
    <div class="app-shell min-h-dvh flex flex-col overflow-x-hidden text-slate-900 transition-colors dark:text-slate-100">
      <div class="app-glow" aria-hidden="true" />

      <!-- Navbar -->
      <AppNavbar />

      <!-- Main Content -->
      <main class="flex-1 pb-16">
        <NuxtPage />
      </main>

      <!-- Footer -->
      <footer class="border-t border-slate-200/80 bg-white/60 py-6 text-center text-xs text-slate-500 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400 pb-safe">
        <div class="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex flex-wrap items-center justify-center gap-1.5">
            <span class="font-bold text-slate-700 dark:text-slate-200">Meet & Ride</span>
            <span>—</span>
            <span>Carpooling & Smart Seat Allocation</span>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              v-if="!isInstalled"
              type="button"
              @click="triggerInstall"
              class="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 hover:bg-sky-100 dark:bg-sky-950/70 dark:text-sky-300 dark:hover:bg-sky-900/70 transition-colors cursor-pointer"
            >
              <UIcon name="i-lucide-download" class="h-3.5 w-3.5" />
              <span>{{ t('pwa.downloadBtn') }}</span>
            </button>
            <button
              type="button"
              @click="isPrivacyOpen = true"
              class="hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer"
            >
              Privacy & GDPR
            </button>
            <span class="hidden sm:inline">•</span>
            <span class="hidden sm:inline">Nuxt 4 + Vue 3 + PWA</span>
          </div>
        </div>
      </footer>

      <!-- Privacy & GDPR Modal -->
      <PrivacyModal v-model:open="isPrivacyOpen" />

      <!-- Install / Download App Modal -->
      <InstallAppModal v-model:open="isInstallModalOpen" />

      <!-- PWA Install Banner -->
      <PwaBanner />
    </div>
  </UApp>
</template>
