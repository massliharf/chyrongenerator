import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Archive,
  Check,
  Clapperboard,
  Copy,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  PenTool,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { Workspace } from '../components/WorkspaceNav'
import { sendToDesigner } from '../designer/inbox'
import { sendToHero } from '../apps/hero/handoff'
import { MenuButton } from '../components/Menu'
import { TopBar } from '../components/TopBar'
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  getGalleryItemUrl,
  getGalleryItemThumbUrl,
  downloadGalleryItem,
  downloadGalleryZip,
  type GalleryItem,
} from '../studio/galleryData'
import { useCloud } from '../cloud/useCloud'
import { MEDIA_CATEGORY, MEDIA_TYPES } from '../cloud/client'

interface MediaGalleryWorkspaceProps {
  active: boolean
  onWorkspaceChange: (workspace: Workspace) => void
}

export default function MediaGalleryWorkspace({
  active,
  onWorkspaceChange,
}: MediaGalleryWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState('')
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null)
  const previewDialogRef = useRef<HTMLDialogElement>(null)
  const cloud = useCloud()
  const uploadInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; danger?: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  // Team uploads, when signed in to a team, come before the built-in assets.
  const canUpload = cloud.status === 'signed-in' && cloud.team !== null
  const { media: teamMedia, refreshMedia } = cloud
  const allItems = useMemo(() => [...teamMedia, ...GALLERY_ITEMS], [teamMedia])

  // Someone else in the team may have added media meanwhile.
  useEffect(() => {
    if (!active || !canUpload) return
    const timer = setTimeout(() => void refreshMedia(), 0)
    return () => clearTimeout(timer)
  }, [active, canUpload, refreshMedia])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), notice.danger ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const handleUpload = async (files: File[]) => {
    if (!canUpload || uploading || files.length === 0) return
    setUploading(`0/${files.length}`)
    try {
      const result = await cloud.upload(files, (done, total) => setUploading(`${done}/${total}`))
      setSelectedCategory(MEDIA_CATEGORY)
      setSearchQuery('')
      if (result.failed.length)
        setNotice({
          danger: true,
          text:
            `${result.uploaded ? `Uploaded ${result.uploaded}. ` : ''}` +
            result.failed.map((f) => `${f.name}: ${f.reason}`).join(' · '),
        })
      else
        setNotice({
          text: `Uploaded ${result.uploaded} ${result.uploaded === 1 ? 'image' : 'images'} to ${cloud.team?.name}.`,
        })
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (item: GalleryItem) => {
    if (!window.confirm(`Delete ${item.name} from ${cloud.team?.name ?? 'the team'} for everyone?`))
      return
    try {
      await cloud.removeMedia(item)
      setPreviewItem(null)
      setNotice({ text: `Deleted ${item.name}.` })
    } catch (error) {
      setNotice({ danger: true, text: error instanceof Error ? error.message : String(error) })
    }
  }

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Category
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      // Search query
      const query = searchQuery.trim().toLowerCase()
      if (query) {
        const matchName = item.name.toLowerCase().includes(query)
        const matchFile = item.filename.toLowerCase().includes(query)
        const matchCat = item.category.toLowerCase().includes(query)
        const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(query))
        if (!matchName && !matchFile && !matchCat && !matchKeywords) return false
      }
      return true
    })
  }, [allItems, selectedCategory, searchQuery])

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: allItems.length,
      [MEDIA_CATEGORY]: teamMedia.length,
    }
    for (const cat of GALLERY_CATEGORIES) {
      counts[cat] = GALLERY_ITEMS.filter((i) => i.category === cat).length
    }
    return counts
  }, [allItems, teamMedia])

  // Download individual asset
  const handleDownloadItem = async (item: GalleryItem) => {
    setDownloadingIds((prev) => new Set(prev).add(item.id))
    try {
      await downloadGalleryItem(item)
    } finally {
      setTimeout(() => {
        setDownloadingIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }, 600)
    }
  }

  // Download ZIP
  const handleDownloadZip = async () => {
    if (downloadingZip || filteredItems.length === 0) return
    setDownloadingZip(true)
    setZipProgress('Starting…')
    const zipName =
      selectedCategory === 'All'
        ? 'chyron-media-gallery-all'
        : `chyron-${selectedCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-assets`

    try {
      await downloadGalleryZip(filteredItems, zipName, ({ loaded, total }) => {
        setZipProgress(`${loaded}/${total}`)
      })
    } finally {
      setDownloadingZip(false)
      setZipProgress('')
    }
  }

  // Copy path or link
  const handleCopyPath = (item: GalleryItem) => {
    navigator.clipboard.writeText(item.url ?? item.path)
    setCopiedId(item.id)
    setTimeout(() => {
      setCopiedId((curr) => (curr === item.id ? null : curr))
    }, 1800)
  }

  // Send to Chyron
  const handleUseInChyron = (item: GalleryItem) => {
    window.dispatchEvent(new CustomEvent('chyron:import-gallery-item', { detail: item }))
    setPreviewItem(null)
    onWorkspaceChange('chyron')
  }

  // Send to Designer
  const handleUseInDesigner = (item: GalleryItem) => {
    sendToDesigner(item)
    setPreviewItem(null)
    onWorkspaceChange('designer')
  }

  // Send to the Hero image generator (Apps)
  const handleUseInHero = (item: GalleryItem) => {
    sendToHero({ item, target: item.category === 'Backgrounds' ? 'background' : 'host' })
    setPreviewItem(null)
    onWorkspaceChange('apps')
  }

  // Lightbox dialog control
  useEffect(() => {
    const dialog = previewDialogRef.current
    if (!dialog) return
    if (previewItem) {
      setImageMeta(null)
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [previewItem])

  const categories = canUpload
    ? ['All', MEDIA_CATEGORY, ...GALLERY_CATEGORIES]
    : ['All', ...GALLERY_CATEGORIES]
  const title = selectedCategory === 'All' ? 'All media' : selectedCategory
  const resetFilters = () => {
    setSelectedCategory('All')
    setSearchQuery('')
  }

  return (
    <div className="workspace-root gallery-root" data-active={active}>
      <TopBar
        actions={
          <>
            {canUpload && (
              <>
                <input
                  ref={uploadInput}
                  type="file"
                  accept={MEDIA_TYPES.join(',')}
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    void handleUpload(files)
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={uploading !== null}
                  onClick={() => uploadInput.current?.click()}
                  title={`Upload images to ${cloud.team?.name}`}
                >
                  {uploading ? (
                    <LoaderCircle size={18} className="spin" aria-hidden="true" />
                  ) : (
                    <Upload size={18} aria-hidden="true" />
                  )}
                  <span className="label">{uploading ? `Uploading ${uploading}` : 'Upload'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="button primary topbar-primary"
              disabled={downloadingZip || filteredItems.length === 0}
              onClick={handleDownloadZip}
              aria-label={`Download ${filteredItems.length} assets as ZIP`}
              title={`Download ${filteredItems.length} assets as ZIP`}
            >
              {downloadingZip ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <Archive size={18} aria-hidden="true" />
              )}
              <span className="label">
                {downloadingZip ? `Zipping ${zipProgress}` : 'Download ZIP'}
              </span>
              {!downloadingZip && <span className="count-badge">{filteredItems.length}</span>}
            </button>
          </>
        }
      >
        <h1 className="topbar-title">Media gallery</h1>
        <div className="search-field topbar-search">
          <Search size={18} className="search-field-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder={`Search ${allItems.length} assets`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search media assets"
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-button sm"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </TopBar>

      <div className="workspace-body gallery-body">
        <nav className="gallery-categories" aria-label="Categories">
          <span className="gallery-categories-title" aria-hidden="true">
            Categories
          </span>
          <ul>
            {categories.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  className="gallery-category"
                  aria-current={selectedCategory === cat ? 'true' : undefined}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat === 'All' ? 'All media' : cat}</span>
                  <span className="count">{categoryCounts[cat] || 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main
          className={`gallery-main ${dragging ? 'is-dropping' : ''}`}
          aria-labelledby="gallery-title"
          onDragOver={(e) => {
            if (!canUpload || !e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(e) => {
            if (!canUpload) return
            e.preventDefault()
            setDragging(false)
            void handleUpload(Array.from(e.dataTransfer.files))
          }}
        >
          <div className="page-header">
            <h2 id="gallery-title">{title}</h2>
            <span role="status">
              {filteredItems.length} {filteredItems.length === 1 ? 'asset' : 'assets'}
              {searchQuery.trim() ? ` matching “${searchQuery.trim()}”` : ''}
            </span>
          </div>

          {filteredItems.length === 0 &&
          selectedCategory === MEDIA_CATEGORY &&
          !searchQuery.trim() ? (
            <div className="empty-state">
              <Upload size={48} aria-hidden="true" />
              <strong>{cloud.mediaLoading ? 'Loading team media…' : 'No team uploads yet'}</strong>
              <span>
                Drop images here or upload them: everyone in {cloud.team?.name} can use them in the
                Chyron editor, the Designer and the Hero image generator.
              </span>
              <button
                type="button"
                className="button primary"
                onClick={() => uploadInput.current?.click()}
              >
                <Upload size={16} aria-hidden="true" /> Upload images
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <ImageIcon size={48} aria-hidden="true" />
              <strong>No assets match</strong>
              <span>Try another search term or show every category.</span>
              <button type="button" className="button secondary" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="asset-grid">
              {filteredItems.map((item) => {
                const isDownloading = downloadingIds.has(item.id)
                const ext = item.filename.split('.').pop()?.toUpperCase() || 'IMG'
                return (
                  <li key={item.id} className="asset-card">
                    <button
                      type="button"
                      className="asset-card-main"
                      onClick={() => setPreviewItem(item)}
                      aria-label={`Open ${item.name}, ${item.category}`}
                    >
                      <span className="asset-card-thumb">
                        <img
                          src={getGalleryItemThumbUrl(item)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.currentTarget
                            const fullUrl = getGalleryItemUrl(item)
                            if (target.src !== fullUrl) target.src = fullUrl
                          }}
                        />
                        {ext !== 'PNG' && <span className="badge asset-card-ext">{ext}</span>}
                      </span>
                      <span className="asset-card-text">
                        <strong title={item.filename}>{item.name}</strong>
                        <span>{item.category}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button asset-card-download"
                      title={`Download ${item.filename}`}
                      aria-label={`Download ${item.filename}`}
                      disabled={isDownloading}
                      onClick={() => void handleDownloadItem(item)}
                    >
                      {isDownloading ? (
                        <LoaderCircle size={18} className="spin" />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </main>
      </div>

      {notice && (
        <div className={`toast ${notice.danger ? 'toast-danger' : ''}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            className="icon-button sm"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lightbox / Detail Inspection Dialog */}
      <dialog
        ref={previewDialogRef}
        className="dialog dialog-lg asset-dialog"
        aria-labelledby="asset-dialog-title"
        onClose={() => setPreviewItem(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreviewItem(null)
        }}
      >
        {previewItem && (
          <>
            <header className="dialog-header">
              <div>
                <h2 id="asset-dialog-title">{previewItem.name}</h2>
                <p>
                  {previewItem.category}
                  {imageMeta ? ` · ${imageMeta.width} × ${imageMeta.height} px` : ''} ·{' '}
                  {previewItem.filename}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close preview"
                onClick={() => setPreviewItem(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="dialog-body asset-dialog-preview">
              <img
                src={getGalleryItemUrl(previewItem)}
                alt={previewItem.name}
                onLoad={(e) => {
                  const target = e.currentTarget
                  setImageMeta({ width: target.naturalWidth, height: target.naturalHeight })
                }}
              />
            </div>
            <footer className="dialog-footer">
              <button
                type="button"
                className="button ghost"
                onClick={() => handleCopyPath(previewItem)}
              >
                {copiedId === previewItem.id ? <Check size={16} /> : <Copy size={16} />}
                <span>
                  {copiedId === previewItem.id
                    ? previewItem.url
                      ? 'Link copied'
                      : 'Path copied'
                    : previewItem.url
                      ? 'Copy link'
                      : 'Copy path'}
                </span>
              </button>
              {cloud.canDelete(previewItem) && (
                <button
                  type="button"
                  className="button ghost danger-text"
                  onClick={() => void handleDelete(previewItem)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              )}
              <span className="dialog-footer-spacer" />
              <MenuButton
                label="Use in…"
                className="button outline"
                placement="top"
                align="end"
                items={[
                  {
                    label: 'Add to Chyron',
                    hint: 'As an image layer',
                    Icon: Clapperboard,
                    onSelect: () => handleUseInChyron(previewItem),
                  },
                  {
                    label: 'Add to Designer',
                    hint: 'As a new layer',
                    Icon: PenTool,
                    onSelect: () => handleUseInDesigner(previewItem),
                  },
                  {
                    label: 'Use in Hero image generator',
                    hint: previewItem.category === 'Backgrounds' ? 'As background' : 'As host',
                    Icon: Images,
                    onSelect: () => handleUseInHero(previewItem),
                  },
                ]}
              >
                <span>Use in…</span>
                <ChevronDown size={16} aria-hidden="true" />
              </MenuButton>
              <button
                type="button"
                className="button primary"
                onClick={() => void handleDownloadItem(previewItem)}
              >
                <Download size={16} aria-hidden="true" />
                <span>Download</span>
              </button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  )
}
