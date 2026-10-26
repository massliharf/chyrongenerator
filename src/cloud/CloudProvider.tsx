import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { GalleryItem } from '../studio/galleryData'
import {
  MEDIA_BUCKET,
  MEDIA_CATEGORY,
  MEDIA_MAX_BYTES,
  MEDIA_TYPES,
  supabase,
  type Team,
  type TeamRole,
} from './client'
import {
  CloudContext,
  LOCAL_CLOUD,
  type Cloud,
  type CloudStatus,
  type UploadResult,
} from './useCloud'

const TEAM_KEY = 'chyron-studio:team'
/** Signed links last six hours; the list is fetched again well before that. */
const LINK_SECONDS = 6 * 60 * 60
const RELOAD_MS = 5 * 60 * 60 * 1000

interface MediaRow {
  id: string
  name: string
  filename: string
  storage_path: string
  uploaded_by: string
  size_bytes: number
  created_at: string
}

const readTeam = () => {
  try {
    return localStorage.getItem(TEAM_KEY)
  } catch {
    return null
  }
}

/** A file name safe as a storage key: letters, digits, dot, dash and underscore. */
const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-120) || 'image'

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name

/**
 * Signs people in with Supabase Auth and holds their teams and the active
 * team's media. Without a Supabase project it hands out the local stand-in,
 * so the studio works exactly as before.
 */
export function CloudProvider({ children }: { children: ReactNode }) {
  if (!supabase)
    return <CloudContext.Provider value={LOCAL_CLOUD}>{children}</CloudContext.Provider>
  return <SupabaseCloud>{children}</SupabaseCloud>
}

function SupabaseCloud({ children }: { children: ReactNode }) {
  const client = supabase!
  const [status, setStatus] = useState<CloudStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string | null>(readTeam)
  const [media, setMedia] = useState<GalleryItem[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)

  const userId = user?.id ?? null
  const team = teams.find((t) => t.id === teamId) ?? teams[0] ?? null

  const refreshTeams = useCallback(async () => {
    const { data, error } = await client
      .from('team_members')
      .select('role, teams ( id, name )')
      .order('created_at')
    if (error) throw error
    const rows = (data ?? []) as unknown as {
      role: TeamRole
      teams: { id: string; name: string } | null
    }[]
    const list = rows.flatMap((row) =>
      row.teams ? [{ id: row.teams.id, name: row.teams.name, role: row.role }] : [],
    )
    setTeams(list)
    return list
  }, [client])

  // Everyone has a team to upload to and save in: a first sign-in without an
  // invitation gets a team of their own. Once per person, even if sign-in fires twice.
  const personal = useRef(new Map<string, PromiseLike<unknown>>())
  const ensureTeam = useCallback(
    async (next: User) => {
      const list = await refreshTeams()
      if (list.length) return
      if (!personal.current.has(next.id)) {
        const handle = (next.email ?? 'My').split('@')[0].slice(0, 60)
        personal.current.set(
          next.id,
          client.rpc('create_team', { team_name: `${handle}’s team` }).then(() => refreshTeams()),
        )
      }
      await personal.current.get(next.id)
    },
    [client, refreshTeams],
  )

  // Session: restore it, then follow sign-ins, sign-outs and password recovery.
  useEffect(() => {
    let alive = true
    const enter = async (next: User | null) => {
      if (!alive) return
      setUser(next)
      if (!next) {
        setTeams([])
        setMedia([])
        setStatus('signed-out')
        return
      }
      // Invitations sent to this address become memberships on sign-in.
      await client.rpc('accept_invites')
      try {
        await ensureTeam(next)
      } catch (error) {
        console.warn('Could not load teams', error)
      }
      if (alive) setStatus((current) => (current === 'recovery' ? current : 'signed-in'))
    }
    void client.auth.getSession().then(({ data }) => enter(data.session?.user ?? null))
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user ?? null)
        setStatus('recovery')
        return
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Supabase asks not to await other calls inside this callback.
        setTimeout(() => void enter(session?.user ?? null), 0)
      }
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [client, ensureTeam])

  const selectTeam = useCallback((id: string) => {
    setTeamId(id)
    try {
      localStorage.setItem(TEAM_KEY, id)
    } catch {
      /* The choice still applies for this session. */
    }
  }, [])

  const createTeam = useCallback(
    async (name: string) => {
      const { data, error } = await client.rpc('create_team', { team_name: name })
      if (error) throw error
      const created = data as { id: string; name: string }
      await refreshTeams()
      selectTeam(created.id)
      return { id: created.id, name: created.name, role: 'owner' as const }
    },
    [client, refreshTeams, selectTeam],
  )

  const activeTeamId = team?.id ?? null
  const refreshMedia = useCallback(async () => {
    if (!activeTeamId) {
      setMedia([])
      return
    }
    setMediaLoading(true)
    try {
      const { data, error } = await client
        .from('media')
        .select('id, name, filename, storage_path, uploaded_by, size_bytes, created_at')
        .eq('team_id', activeTeamId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as MediaRow[]
      const links = rows.length
        ? await client.storage.from(MEDIA_BUCKET).createSignedUrls(
            rows.map((row) => row.storage_path),
            LINK_SECONDS,
          )
        : { data: [], error: null }
      if (links.error) throw links.error
      const byPath = new Map(links.data.map((link) => [link.path, link.signedUrl]))
      setMedia(
        rows.flatMap((row) => {
          const url = byPath.get(row.storage_path)
          if (!url) return []
          return [
            {
              id: `cloud_${row.id}`,
              category: MEDIA_CATEGORY,
              name: row.name,
              filename: row.filename,
              path: row.storage_path,
              url,
              cloud: {
                id: row.id,
                uploadedBy: row.uploaded_by,
                sizeBytes: row.size_bytes,
                createdAt: row.created_at,
              },
            },
          ]
        }),
      )
    } catch (error) {
      console.warn('Could not load team media', error)
    } finally {
      setMediaLoading(false)
    }
  }, [client, activeTeamId])

  // The active team's library, reloaded before its links run out.
  useEffect(() => {
    if (status !== 'signed-in') return
    const first = setTimeout(() => void refreshMedia(), 0)
    const timer = setInterval(() => void refreshMedia(), RELOAD_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [status, refreshMedia])

  const upload = useCallback(
    async (files: File[], onProgress?: (done: number, total: number) => void) => {
      const result: UploadResult = { uploaded: 0, failed: [] }
      if (!activeTeamId || !userId) {
        result.failed = files.map((file) => ({ name: file.name, reason: 'Choose a team first' }))
        return result
      }
      for (const [index, file] of files.entries()) {
        onProgress?.(index, files.length)
        if (!MEDIA_TYPES.includes(file.type)) {
          result.failed.push({ name: file.name, reason: 'Not a PNG, JPEG, WebP, GIF or SVG image' })
          continue
        }
        if (file.size > MEDIA_MAX_BYTES) {
          result.failed.push({ name: file.name, reason: 'Larger than 25 MB' })
          continue
        }
        const path = `${activeTeamId}/${crypto.randomUUID()}/${safeName(file.name)}`
        const stored = await client.storage
          .from(MEDIA_BUCKET)
          .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
        if (stored.error) {
          result.failed.push({ name: file.name, reason: stored.error.message })
          continue
        }
        const row = await client.from('media').insert({
          team_id: activeTeamId,
          uploaded_by: userId,
          name: baseName(file.name).slice(0, 160),
          filename: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        })
        if (row.error) {
          await client.storage.from(MEDIA_BUCKET).remove([path])
          result.failed.push({ name: file.name, reason: row.error.message })
          continue
        }
        result.uploaded += 1
      }
      onProgress?.(files.length, files.length)
      if (result.uploaded) await refreshMedia()
      return result
    },
    [client, activeTeamId, userId, refreshMedia],
  )

  const removeMedia = useCallback(
    async (item: GalleryItem) => {
      if (!item.cloud) return
      const { error } = await client.from('media').delete().eq('id', item.cloud.id)
      if (error) throw error
      await client.storage.from(MEDIA_BUCKET).remove([item.path])
      setMedia((current) => current.filter((m) => m.id !== item.id))
    },
    [client],
  )

  const role = team?.role
  const canDelete = useCallback(
    (item: GalleryItem) =>
      Boolean(item.cloud) &&
      (item.cloud?.uploadedBy === userId || role === 'owner' || role === 'admin'),
    [userId, role],
  )

  const signOut = useCallback(async () => {
    await client.auth.signOut()
  }, [client])

  const value = useMemo<Cloud>(
    () => ({
      status,
      user,
      teams,
      team,
      selectTeam,
      refreshTeams,
      createTeam,
      media,
      mediaLoading,
      refreshMedia,
      upload,
      removeMedia,
      canDelete,
      signOut,
    }),
    [
      status,
      user,
      teams,
      team,
      selectTeam,
      refreshTeams,
      createTeam,
      media,
      mediaLoading,
      refreshMedia,
      upload,
      removeMedia,
      canDelete,
      signOut,
    ],
  )
  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>
}
