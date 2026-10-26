import { useCallback } from 'react'
import { SAVVY_TYPE, savvyName, sendSavvyFile, type SavvyKind } from '../utils/savvyFile'
import { supabase } from './client'
import { useCloud } from './useCloud'

/**
 * Team projects: each editor's .savvy file kept in Supabase Storage, listed
 * on Home. A project opened from Home stays linked to its editor, so the next
 * "Save to team" there updates it instead of making a copy.
 */
export const PROJECT_BUCKET = 'team-projects'
export const PROJECTS_CHANGED = 'savvy:projects-changed'
const LINK_SECONDS = 6 * 60 * 60
const THUMB_SIZE = 480

export interface CloudProject {
  id: string
  teamId: string
  kind: SavvyKind
  name: string
  storagePath: string
  thumbUrl: string | null
  sizeBytes: number
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

interface ProjectRow {
  id: string
  team_id: string
  kind: SavvyKind
  name: string
  storage_path: string
  thumb_path: string | null
  size_bytes: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

/* ---------- Which cloud project each editor has open ---------- */

const fromCloud = new WeakMap<File, { id: string; teamId: string }>()
const linked = new Map<SavvyKind, { id: string; teamId: string }>()

/** Editors call this whenever they open a file: a file from Home links, any other unlinks. */
export function linkOpenedFile(kind: SavvyKind, file: File) {
  const link = fromCloud.get(file)
  if (link) linked.set(kind, link)
  else linked.delete(kind)
}

/** A new document in an editor is not the cloud project any more. */
export const unlinkCloud = (kind: SavvyKind) => linked.delete(kind)

const changed = () => window.dispatchEvent(new Event(PROJECTS_CHANGED))

/* ---------- Listing, opening, deleting ---------- */

export async function listProjects(teamId: string, limit = 60): Promise<CloudProject[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = (data ?? []) as ProjectRow[]
  const thumbs = rows.flatMap((row) => (row.thumb_path ? [row.thumb_path] : []))
  const signed = thumbs.length
    ? await supabase.storage.from(PROJECT_BUCKET).createSignedUrls(thumbs, LINK_SECONDS)
    : { data: [], error: null }
  const byPath = new Map((signed.data ?? []).map((link) => [link.path, link.signedUrl]))
  return rows.map((row) => ({
    id: row.id,
    teamId: row.team_id,
    kind: row.kind,
    name: row.name,
    storagePath: row.storage_path,
    // The update time keeps a re-saved thumbnail from coming out of the cache.
    thumbUrl: row.thumb_path
      ? `${byPath.get(row.thumb_path) ?? ''}&v=${Date.parse(row.updated_at)}`
      : null,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/** Downloads a project and hands it to its editor, linked for later saves. */
export async function openCloudProject(project: CloudProject) {
  if (!supabase) return
  const { data, error } = await supabase.storage.from(PROJECT_BUCKET).download(project.storagePath)
  if (error || !data) throw error ?? new Error('The project could not be downloaded.')
  const file = new File([data], savvyName(project.name), { type: SAVVY_TYPE })
  fromCloud.set(file, { id: project.id, teamId: project.teamId })
  sendSavvyFile(project.kind, file)
}

export async function deleteCloudProject(project: CloudProject) {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', project.id)
  if (error) throw error
  await supabase.storage
    .from(PROJECT_BUCKET)
    .remove([project.storagePath, project.storagePath.replace(/\.savvy$/, '.webp')])
  for (const [kind, link] of linked) if (link.id === project.id) linked.delete(kind)
  changed()
}

export async function renameCloudProject(project: CloudProject, name: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('projects')
    .update({ name: name.trim().slice(0, 120) })
    .eq('id', project.id)
  if (error) throw error
  changed()
}

/* ---------- Saving ---------- */

/** A small WebP of what an editor shows, from its preview canvas; null when there is none. */
async function captureThumb(selector: string): Promise<Blob | null> {
  const source = document.querySelector<HTMLCanvasElement>(selector)
  if (!source || !source.width || !source.height) return null
  const scale = Math.min(1, THUMB_SIZE / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  try {
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  } catch {
    // A canvas showing pictures from elsewhere can't be read back.
    return null
  }
}

export interface TeamSave {
  /** The team projects go to. */
  teamName: string
  /** Saves (or updates the linked project); resolves with what to tell the person. */
  save: (name: string, blob: Blob) => Promise<string>
}

/**
 * "Save to team" for one editor. `thumbSelector` names the canvas whose
 * picture becomes the project's thumbnail on Home. Null when signed out.
 */
export function useTeamSave(kind: SavvyKind, thumbSelector: string): TeamSave | null {
  const { status, team, user } = useCloud()
  const teamId = team?.id ?? null
  const userId = user?.id ?? null
  const save = useCallback(
    async (rawName: string, blob: Blob) => {
      if (!supabase || !teamId || !userId) throw new Error('Sign in to a team first.')
      if (blob.size > 50 * 1024 * 1024)
        throw new Error('This project is over 50 MB, the most one team project can hold.')
      const name = rawName.trim().slice(0, 120) || 'Untitled'
      const storage = supabase.storage.from(PROJECT_BUCKET)
      const client = supabase
      const thumb = await captureThumb(thumbSelector)

      /** Writes the file and its row; false when the linked project was deleted meanwhile. */
      const write = async (existing: string | null) => {
        const id = existing ?? crypto.randomUUID()
        const path = `${teamId}/${id}.savvy`
        const thumbPath = `${teamId}/${id}.webp`
        const stored = await storage.upload(path, blob, {
          contentType: SAVVY_TYPE,
          upsert: true,
          cacheControl: '0',
        })
        if (stored.error) throw stored.error
        const thumbed = thumb
          ? !(await storage.upload(thumbPath, thumb, { contentType: 'image/webp', upsert: true }))
              .error
          : false
        const fields = {
          name,
          size_bytes: blob.size,
          updated_by: userId,
          updated_at: new Date().toISOString(),
          ...(thumbed ? { thumb_path: thumbPath } : {}),
        }
        const row = existing
          ? await client.from('projects').update(fields).eq('id', id).select('id')
          : await client
              .from('projects')
              .insert({
                id,
                team_id: teamId,
                kind,
                storage_path: path,
                created_by: userId,
                ...fields,
              })
              .select('id')
        if (row.error) {
          if (!existing) await storage.remove([path, thumbPath])
          throw row.error
        }
        if (existing && !row.data?.length) return null
        return id
      }

      const link = linked.get(kind)
      const existing = link && link.teamId === teamId ? link.id : null
      // Saving over a project someone deleted meanwhile makes it anew.
      const updated = existing ? await write(existing) : null
      const id = updated ?? (await write(null))!
      linked.set(kind, { id, teamId })
      changed()
      return updated
        ? `Saved “${name}” to ${team?.name}.`
        : `Saved “${name}” to ${team?.name} as a new project.`
    },
    [kind, thumbSelector, teamId, userId, team?.name],
  )
  if (status !== 'signed-in' || !team) return null
  return { teamName: team.name, save }
}
