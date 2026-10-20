import type { OrganizerUser } from '~/types'

export function useOrganizerAuth() {
  const user = useState<OrganizerUser | null>('organizer_user', () => null)
  const loading = useState<boolean>('organizer_auth_loading', () => false)
  const initialLoaded = useState<boolean>('organizer_auth_init', () => false)

  async function fetchMe(): Promise<OrganizerUser | null> {
    try {
      const res = await $fetch<{ user: OrganizerUser | null }>('/api/auth/me')
      user.value = res.user
      return res.user
    } catch {
      user.value = null
      return null
    } finally {
      initialLoaded.value = true
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    try {
      const res = await $fetch<{ user: OrganizerUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      user.value = res.user
      return { success: true }
    } catch (err: any) {
      const msg = err.data?.statusMessage || err.message || 'Login fallito'
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    try {
      const res = await $fetch<{ user: OrganizerUser }>('/api/auth/register', {
        method: 'POST',
        body: { email, password, name }
      })
      user.value = res.user
      return { success: true }
    } catch (err: any) {
      const msg = err.data?.statusMessage || err.message || 'Registrazione fallita'
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
    }
  }

  return {
    user,
    loading,
    initialLoaded,
    fetchMe,
    login,
    register,
    logout
  }
}
