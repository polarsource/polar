import { client } from '.'
import { UserRead } from 'polar-api/client'

type Organization = {
  id: string
  platform: string
  name: string
  external_id: number
  avatar_url: string
  is_personal: boolean
  is_site_admin: boolean
  installation_id: number
  installation_created_at: string
  installation_updated_at: string
  installation_suspended_at: string
  status: string
  created_at: string
  modified_at: string
}

export class Session {
  user: UserRead | null
  authenticated: boolean
  fetching: boolean
  onChangeListeners: Array<(session: Session) => void>

  constructor() {
    this.user = null
    this.authenticated = false
    this.fetching = false
    this.onChangeListeners = []
  }

  getOrganizationBySlug(slug: string): Organization | boolean {
    if (!this.user?.profile?.organizations) return false

    let mapped: { [name: string]: Organization } = {}
    this.user.profile.organizations.map((org) => {
      mapped[org.name] = org
    })
    return mapped[slug] || false
  }

  async signin() {
    if (this.authenticated) return

    try {
      this.fetching = true
      const user = await client.users.getAuthenticated()
      if (user?.profile) {
        this.user = user
        this.authenticated = true
      }
    } catch (error) {}
    this.fetching = false
    this.triggerChangeListeners()
  }

  async signout() {
    if (!this.authenticated) return

    try {
      this.fetching = true
      const response = await client.post('/apps/github/signout')
      if (response.data !== null) {
        this.user = null
        this.authenticated = false
      }
    } catch (error) {}
    this.fetching = false
    this.triggerChangeListeners()
  }

  onAuthChange(callback: (data: object) => void) {
    this.onChangeListeners.push(callback)
  }

  triggerChangeListeners() {
    for (const callback of this.onChangeListeners) {
      callback(this)
    }
  }
}

export const session: Session = new Session()
