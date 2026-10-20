<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useOrganizerAuth } from '~/composables/useOrganizerAuth'

const { t } = useI18n()
const { register, loading, user } = useOrganizerAuth()
const toast = useToast()

const name = ref('')
const email = ref('')
const password = ref('')
const errorMessage = ref('')

// If already logged in, redirect
watch(user, (val) => {
  if (val) navigateTo('/')
}, { immediate: true })

async function handleSubmit() {
  errorMessage.value = ''
  const res = await register(email.value, password.value, name.value)
  if (res.success) {
    toast.add({
      title: t('auth.registerSuccess'),
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
          <UIcon name="i-lucide-user-plus" class="h-6 w-6" />
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">
          {{ t('auth.registerTitle') }}
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {{ t('auth.registerSubtitle') }}
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {{ t('auth.name') }}
          </label>
          <UInput
            v-model="name"
            :placeholder="t('auth.namePlaceholder')"
            required
            class="w-full"
          />
        </div>

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
            type="password"
            required
            class="w-full"
          />
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
          {{ t('auth.registerSubmit') }}
        </UButton>
      </form>

      <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <NuxtLink to="/login" class="text-xs text-sky-600 hover:underline dark:text-sky-400 font-medium">
          {{ t('auth.hasAccount') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
