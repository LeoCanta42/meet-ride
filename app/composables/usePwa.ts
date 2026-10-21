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
  const isInstallModalOpen = useState<boolean>('mr_install_modal_open', () => false)
  const isStandalone = useState<boolean>('mr_is_standalone', () => false)

  if (import.meta.client) {
    try {
      const mql = window.matchMedia('(display-mode: standalone)')
      isStandalone.value = mql.matches || Boolean((window.navigator as any)?.standalone)
    } catch {
      // ignore
    }
  }

  const canInstall = computed(() => Boolean(state.value?.showInstallPrompt))
  const isInstalled = computed(() => Boolean(state.value?.isInstalled) || isStandalone.value)
  const needRefresh = computed(() => Boolean(state.value?.needRefresh))
  const offlineReady = computed(() => Boolean(state.value?.offlineReady))

  async function install(): Promise<string | undefined> {
    try {
      const result = await state.value?.install()
      if (result?.outcome === 'accepted') {
        isInstallModalOpen.value = false
      }
      return result?.outcome
    } catch (err) {
      console.error('PWA install failed:', err)
      return undefined
    }
  }

  async function triggerInstall() {
    if (canInstall.value) {
      const outcome = await install()
      if (outcome) return
    }
    isInstallModalOpen.value = true
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
    isInstallModalOpen,
    install,
    triggerInstall,
    dismissInstall,
    updateApp
  }
}
