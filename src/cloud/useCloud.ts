import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { GalleryItem } from '../studio/galleryData'
import type { Team } from './client'

export type CloudStatus = 'local' | 'loading' | 'signed-out' | 'recovery' | 'signed-in'

export interface Cloud {
  /** `local`: no Supabase project configured, everything stays on this device. */
  status: CloudStatus
  user: User | null
  teams: Team[]
  team: Team | null
  selectTeam: (id: string) => void
  refreshTeams: () => Promise<Team[]>
  createTeam: (name: string) => Promise<Team>
  /** The active team's uploads, newest first, as Media gallery items. */
  media: GalleryItem[]
  mediaLoading: boolean
  refreshMedia: () => Promise<void>
  upload: (
    files: File[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<UploadResult>
  removeMedia: (item: GalleryItem) => Promise<void>
  canDelete: (item: GalleryItem) => boolean
  signOut: () => Promise<void>
}

export interface UploadResult {
  uploaded: number
  /** Files that were refused, with the reason, in the order given. */
  failed: { name: string; reason: string }[]
}

const noop = async () => {}

export const LOCAL_CLOUD: Cloud = {
  status: 'local',
  user: null,
  teams: [],
  team: null,
  selectTeam: () => {},
  refreshTeams: async () => [],
  createTeam: () => Promise.reject(new Error('Cloud is not configured')),
  media: [],
  mediaLoading: false,
  refreshMedia: noop,
  upload: async () => ({ uploaded: 0, failed: [] }),
  removeMedia: noop,
  canDelete: () => false,
  signOut: noop,
}

export const CloudContext = createContext<Cloud>(LOCAL_CLOUD)

export const useCloud = () => useContext(CloudContext)
