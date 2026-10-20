import { getAuthenticatedOrganizer } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const organizer = await getAuthenticatedOrganizer(event)
  return { user: organizer }
})
