import { clearOrganizerSession } from '../../utils/auth'

export default defineEventHandler((event) => {
  clearOrganizerSession(event)
  return { success: true }
})
