interface PwaState {
  isInstalled: boolean
  showInstallPrompt: boolean
  needRefresh: boolean
  offlineReady: boolean
  registrationError: boolean
  install: () => Promise<{ outcome: string } | undefined>
  cancelInstall: () => void
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  cancelPrompt: () => Promise<void>
}

export function usePwa() {
  const nuxtApp = useNuxtApp()
  const state = computed<PwaState | null>(() => (nuxtApp.$pwa as unknown as PwaState) ?? null)

  const canInstall = computed(() => Boolean(state.value?.showInstallPrompt))
  const isInstalled = computed(() => Boolean(state.value?.isInstalled))
  const needRefresh = computed(() => Boolean(state.value?.needRefresh))
  const offlineReady = computed(() => Boolean(state.value?.offlineReady))

  async function install(): Promise<string | undefined> {
    try {
      const result = await state.value?.install()
      return result?.outcome
    } catch (err) {
      console.error('PWA install failed:', err)
      return undefined
    }
  }

  function dismissInstall() {
    state.value?.cancelInstall()
  }

  async function updateApp() {
    await state.value?.updateServiceWorker(true)
  }

  return {
    canInstall,
    isInstalled,
    needRefresh,
    offlineReady,
    install,
    dismissInstall,
    updateApp
  }
}
