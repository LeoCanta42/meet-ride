<script setup lang="ts">
import { usePwa } from '~/composables/usePwa'
import { useI18n } from '~/composables/useI18n'

const { canInstall, isInstalled, install, dismissInstall } = usePwa()
const { t } = useI18n()

const dismissed = ref(false)

function handleDismiss() {
  dismissed.value = true
  dismissInstall()
}

async function handleInstall() {
  await install()
}
</script>

<template>
  <div
    v-if="canInstall && !isInstalled && !dismissed"
    class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-sky-900/80 dark:bg-slate-900/95"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow">
        <UIcon name="i-lucide-download" class="h-5 w-5" />
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">
          {{ t('pwa.installTitle') }}
        </h4>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {{ t('pwa.installDesc') }}
        </p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          @click="handleDismiss"
        >
          {{ t('pwa.dismissBtn') }}
        </UButton>

        <UButton
          size="xs"
          color="primary"
          @click="handleInstall"
          class="font-semibold"
        >
          {{ t('pwa.installBtn') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
