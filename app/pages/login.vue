<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'

const { t } = useI18n()
const { login, loading, user } = useOrganizerAuth()
const toast = useToast()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')

// If already logged in, redirect
watch(user, (val) => {
  if (val) navigateTo('/')
}, { immediate: true })

async function handleSubmit() {
  errorMessage.value = ''
  const res = await login(email.value, password.value)
  if (res.success) {
    toast.add({
      title: t('auth.loginSuccess'),
      color: 'success'
    })
    navigateTo('/')
  } else {
    errorMessage.value = res.error || t('common.error')
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12 sm:py-16">
    <div class="surface-card rounded-3xl p-6 sm:p-8 shadow-xl">
      <div class="text-center mb-6">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
          <UIcon name="i-lucide-log-in" class="h-6 w-6" />
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">
          {{ t('auth.loginTitle') }}
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {{ t('auth.loginSubtitle') }}
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('auth.email') }}
          </label>
          <UInput
            v-model="email"
            type="email"
            placeholder="organizzatore@esempio.com"
            required
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('auth.password') }}
          </label>
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :ui="{ trailing: 'pe-1' }"
            required
            class="w-full"
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
        </div>

        <div v-if="errorMessage" class="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {{ errorMessage }}
        </div>

        <UButton
          type="submit"
          color="primary"
          size="lg"
          block
          :loading="loading"
          class="font-semibold shadow-md shadow-sky-500/20"
        >
          {{ t('auth.loginSubmit') }}
        </UButton>
      </form>

      <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <NuxtLink to="/register" class="text-xs text-sky-600 hover:underline dark:text-sky-400 font-medium">
          {{ t('auth.noAccount') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
