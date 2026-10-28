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

// In-memory reference to captured native BeforeInstallPromptEvent
let globalDeferredPrompt: any = null

export function usePwa() {
  const nuxtApp = useNuxtApp()
  const state = computed<PwaState | null>(() => (nuxtApp.$pwa as unknown as PwaState) ?? null)
  const isInstallModalOpen = useState<boolean>('mr_install_modal_open', () => false)
  const isStandalone = useState<boolean>('mr_is_standalone', () => false)
  const hasCapturedPrompt = useState<boolean>('mr_has_captured_prompt', () => false)
  const isInstalledManually = useState<boolean>('mr_is_installed_manually', () => false)
  const platform = useState<'ios' | 'android' | 'desktop' | 'other'>('mr_user_platform', () => 'other')

  if (import.meta.client) {
    try {
      // 1. Detect standalone mode
      const mql = window.matchMedia('(display-mode: standalone)')
      isStandalone.value = mql.matches || Boolean((window.navigator as any)?.standalone)

      // 2. Detect user platform
      const ua = window.navigator.userAgent || ''
      if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
        platform.value = 'ios'
      } else if (/android/i.test(ua)) {
        platform.value = 'android'
      } else if (/windows|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) {
        platform.value = 'desktop'
      }

      // 3. Sync early-captured prompt from head script
      if ((window as any).__mr_bip) {
        globalDeferredPrompt = (window as any).__mr_bip
        hasCapturedPrompt.value = true
      }

      // 4. Listen for beforeinstallprompt event if not yet captured
      window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault()
        globalDeferredPrompt = e
        ;(window as any).__mr_bip = e
        hasCapturedPrompt.value = true
      })

      window.addEventListener('mr-bip-ready', () => {
        if ((window as any).__mr_bip) {
          globalDeferredPrompt = (window as any).__mr_bip
          hasCapturedPrompt.value = true
        }
      })

      // 5. Reset on app installed
      window.addEventListener('appinstalled', () => {
        globalDeferredPrompt = null
        ;(window as any).__mr_bip = null
        hasCapturedPrompt.value = false
        isInstalledManually.value = true
        isInstallModalOpen.value = false
      })
    } catch {
      // ignore
    }
  }

  const canInstall = computed(() => {
    return Boolean(
      hasCapturedPrompt.value ||
      globalDeferredPrompt ||
      (import.meta.client && (window as any).__mr_bip) ||
      state.value?.showInstallPrompt
    )
  })

  const isInstalled = computed(() => {
    return Boolean(
      state.value?.isInstalled ||
      isStandalone.value ||
      isInstalledManually.value
    )
  })

  const needRefresh = computed(() => Boolean(state.value?.needRefresh))
  const offlineReady = computed(() => Boolean(state.value?.offlineReady))

  async function install(): Promise<string | undefined> {
    if (!import.meta.client) return undefined

    // Prioritize direct native prompt
    const promptEvent = globalDeferredPrompt || (window as any).__mr_bip
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        await promptEvent.prompt()
        const userChoice = await promptEvent.userChoice
        if (userChoice?.outcome === 'accepted') {
          globalDeferredPrompt = null
          ;(window as any).__mr_bip = null
          hasCapturedPrompt.value = false
          isInstalledManually.value = true
          isInstallModalOpen.value = false
        }
        return userChoice?.outcome
      } catch (err) {
        console.warn('Native prompt failed:', err)
      }
    }

    // Fallback to plugin install method
    if (state.value && typeof state.value.install === 'function') {
      try {
        const result = await state.value.install()
        if (result?.outcome === 'accepted') {
          isInstalledManually.value = true
          isInstallModalOpen.value = false
        }
        return result?.outcome
      } catch (err) {
        console.warn('$pwa.install failed:', err)
      }
    }

    return undefined
  }

  async function triggerInstall(): Promise<void> {
    // If the browser provides the native install prompt, open it directly!
    if (canInstall.value) {
      const outcome = await install()
      // If prompt opened and user interacted with it (accepted or dismissed), return immediately
      if (outcome) return
    }

    // If native prompt is not supported by the browser (e.g. iOS Safari) or not yet fired,
    // open the instructions modal tailored to the user's platform.
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
    platform,
    install,
    triggerInstall,
    dismissInstall,
    updateApp
  }
}
