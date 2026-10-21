<script setup lang="ts">
import { usePwa } from '~/composables/usePwa'
import { useI18n } from '~/composables/useI18n'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { canInstall, isInstalled, install } = usePwa()
const { t } = useI18n()

async function handleNativeInstall() {
  await install()
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="t('pwa.modalTitle')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- App Preview Header -->
        <div class="flex items-center gap-3.5 rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/80 to-cyan-50/50 p-3.5 dark:border-sky-900/60 dark:from-sky-950/40 dark:to-slate-900">
          <img
            src="/icons/icon-192.png"
            alt="Meet & Ride Icon"
            class="h-14 w-14 shrink-0 rounded-2xl shadow-md"
          />
          <div class="min-w-0">
            <h4 class="font-bold text-slate-900 dark:text-white text-sm">
              Meet & Ride
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {{ t('pwa.modalSubtitle') }}
            </p>
          </div>
        </div>

        <!-- Direct One-Click Install Button (if supported & ready) -->
        <div v-if="canInstall && !isInstalled">
          <UButton
            color="primary"
            size="lg"
            block
            class="font-bold shadow-md shadow-sky-500/20"
            @click="handleNativeInstall"
          >
            <UIcon name="i-lucide-download" class="h-5 w-5 mr-1.5" />
            {{ t('pwa.directInstallBtn') }}
          </UButton>
        </div>

        <div v-else-if="isInstalled" class="rounded-xl bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <UIcon name="i-lucide-check-circle" class="h-4 w-4 inline-block mr-1 -mt-0.5" />
          {{ t('pwa.alreadyInstalled') }}
        </div>

        <!-- Step-by-Step Platform Instructions -->
        <div class="space-y-2.5">
          <div class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <UIcon name="i-lucide-smartphone" class="h-4 w-4 text-sky-500 shrink-0" />
              <span>{{ t('pwa.androidTitle') }}</span>
            </div>
            <p class="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {{ t('pwa.androidDesc') }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <UIcon name="i-lucide-share" class="h-4 w-4 text-indigo-500 shrink-0" />
              <span>{{ t('pwa.iosTitle') }}</span>
            </div>
            <p class="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {{ t('pwa.iosDesc') }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <UIcon name="i-lucide-monitor" class="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{{ t('pwa.desktopTitle') }}</span>
            </div>
            <p class="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {{ t('pwa.desktopDesc') }}
            </p>
          </div>
        </div>

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
