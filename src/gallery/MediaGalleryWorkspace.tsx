import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Archive,
  Check,
  Clapperboard,
  Copy,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  Maximize2,
  Search,
  X,
} from 'lucide-react'
import { WorkspaceNav, type Workspace } from '../components/WorkspaceNav'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  getGalleryItemUrl,
  getGalleryItemThumbUrl,
  downloadGalleryItem,
  downloadGalleryZip,
  type GalleryItem,
} from '../studio/galleryData'
import './MediaGalleryWorkspace.css'

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
  const [formatFilter, setFormatFilter] = useState<'all' | 'png' | 'svg' | 'jpg'>('all')
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState('')
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null)
  const previewDialogRef = useRef<HTMLDialogElement>(null)

  // Filter items
  const filteredItems = useMemo(() => {
    return GALLERY_ITEMS.filter((item) => {
      // Category
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      // Format
      if (formatFilter !== 'all') {
        const ext = item.filename.split('.').pop()?.toLowerCase()
        if (formatFilter === 'jpg' && ext !== 'jpg' && ext !== 'jpeg') return false
        if (formatFilter === 'png' && ext !== 'png') return false
        if (formatFilter === 'svg' && ext !== 'svg') return false
      }
      // Search query
      const query = searchQuery.trim().toLowerCase()
      if (query) {
        const matchName = item.name.toLowerCase().includes(query)
        const matchFile = item.filename.toLowerCase().includes(query)
        const matchCat = item.category.toLowerCase().includes(query)
        if (!matchName && !matchFile && !matchCat) return false
      }
      return true
    })
  }, [selectedCategory, formatFilter, searchQuery])

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: GALLERY_ITEMS.length }
    for (const cat of GALLERY_CATEGORIES) {
      counts[cat] = GALLERY_ITEMS.filter((i) => i.category === cat).length
    }
    return counts
  }, [])

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
    navigator.clipboard.writeText(item.path)
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

  // Send to Stream Images
  const handleUseInStream = (item: GalleryItem) => {
    window.dispatchEvent(
      new CustomEvent('stream:import-gallery-item', {
        detail: {
          item,
          target: item.category === 'Backgrounds' ? 'background' : 'host',
        },
      }),
    )
    setPreviewItem(null)
    onWorkspaceChange('stream')
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

  return (
    <div className="studio-shell mg-shell" data-active={active}>
      {/* App Header */}
      <header className="app-header mg-header" role="banner">
        <div className="header-start">
          <h1 className="brand" aria-label="Chyron Studio">
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>
              chyron<span>studio</span>
            </strong>
          </h1>
          <WorkspaceNav current="gallery" onChange={onWorkspaceChange} />
        </div>

        <div className="project-header mg-search-header">
          <span className="header-divider" />
          <div className="mg-search-box">
            <Search size={16} className="mg-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="mg-search-input"
              placeholder="Search 102 assets by name or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search media assets"
            />
            {searchQuery && (
              <button
                type="button"
                className="mg-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="header-actions">
          <ThemeToggle />
          <button
            type="button"
            className="button primary export-trigger mg-zip-btn"
            disabled={downloadingZip || filteredItems.length === 0}
            onClick={handleDownloadZip}
            title={`Download ${filteredItems.length} assets as ZIP`}
          >
            {downloadingZip ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Archive size={18} />
            )}
            <span>
              {downloadingZip ? (
                `Zipping ${zipProgress}`
              ) : (
                <>
                  Download ZIP <span className="si-count">{filteredItems.length}</span>
                </>
              )}
            </span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="mg-workspace">
        {/* Categories Sidebar */}
        <aside className="mg-sidebar" aria-label="Categories">
          <div className="mg-sidebar-header">
            <span className="mg-sidebar-title">Categories</span>
            <span className="mg-sidebar-total">{GALLERY_ITEMS.length} items</span>
          </div>

          <nav className="mg-category-nav">
            <button
              type="button"
              className={`mg-category-item ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              <FolderOpen size={16} className="mg-cat-icon" />
              <span className="mg-cat-label">All Media</span>
              <span className="mg-cat-badge">{categoryCounts.All}</span>
            </button>

            {GALLERY_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0
              return (
                <button
                  key={cat}
                  type="button"
                  className={`mg-category-item ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="mg-cat-dot" aria-hidden="true" />
                  <span className="mg-cat-label">{cat}</span>
                  <span className="mg-cat-badge">{count}</span>
                </button>
              )
            })}
          </nav>

          {/* Format filters */}
          <div className="mg-format-section">
            <span className="mg-format-title">Format</span>
            <div className="mg-format-pills">
              {(['all', 'png', 'svg', 'jpg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`mg-format-pill ${formatFilter === fmt ? 'active' : ''}`}
                  onClick={() => setFormatFilter(fmt)}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Assets Main Grid Area */}
        <main className="mg-main">
          {/* Status / Toolbar */}
          <div className="mg-toolbar">
            <div className="mg-toolbar-left">
              <h2 className="mg-toolbar-title">
                {selectedCategory === 'All' ? 'All Media Assets' : selectedCategory}
              </h2>
              <span className="mg-toolbar-count">
                {filteredItems.length} {filteredItems.length === 1 ? 'asset' : 'assets'} available
              </span>
            </div>

            <div className="mg-toolbar-right">
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  className="button subtle mg-batch-download"
                  disabled={downloadingZip}
                  onClick={handleDownloadZip}
                >
                  <Download size={15} />
                  <span>Download Category ZIP</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          {filteredItems.length === 0 ? (
            <div className="mg-empty-state">
              <ImageIcon size={48} className="mg-empty-icon" />
              <p className="mg-empty-text">No media assets match your filter</p>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setSelectedCategory('All')
                  setSearchQuery('')
                  setFormatFilter('all')
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="mg-grid">
              {filteredItems.map((item) => {
                const isDownloading = downloadingIds.has(item.id)
                const isCopied = copiedId === item.id
                const ext = item.filename.split('.').pop()?.toUpperCase() || 'IMG'

                return (
                  <div key={item.id} className="mg-card" tabIndex={0}>
                    {/* Thumbnail */}
                    <div
                      className="mg-card-thumb-wrap"
                      onClick={() => setPreviewItem(item)}
                      role="button"
                      tabIndex={-1}
                      title={`Inspect ${item.name}`}
                    >
                      <img
                        src={getGalleryItemThumbUrl(item)}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const target = e.currentTarget
                          const fullUrl = getGalleryItemUrl(item)
                          if (target.src !== fullUrl) {
                            target.src = fullUrl
                          }
                        }}
                        className="mg-card-img"
                      />
                      <span className="mg-card-ext">{ext}</span>

                      {/* Hover action overlay */}
                      <div className="mg-card-overlay">
                        <button
                          type="button"
                          className="mg-icon-btn"
                          title="Preview full size"
                          aria-label="Preview full size"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewItem(item)
                          }}
                        >
                          <Maximize2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="mg-icon-btn"
                          title={isCopied ? 'Path copied!' : 'Copy relative path'}
                          aria-label="Copy relative path"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyPath(item)
                          }}
                        >
                          {isCopied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        <button
                          type="button"
                          className="mg-icon-btn mg-download-btn"
                          title={`Download ${item.filename}`}
                          aria-label={`Download ${item.filename}`}
                          disabled={isDownloading}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDownloadItem(item)
                          }}
                        >
                          {isDownloading ? (
                            <LoaderCircle size={15} className="spin" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Card Footer Info */}
                    <div className="mg-card-details">
                      <div className="mg-card-text">
                        <span className="mg-card-name" title={item.filename}>
                          {item.name}
                        </span>
                        <span className="mg-card-cat">{item.category}</span>
                      </div>
                      <button
                        type="button"
                        className="mg-direct-download"
                        title={`Download ${item.filename}`}
                        aria-label={`Download ${item.filename}`}
                        disabled={isDownloading}
                        onClick={() => void handleDownloadItem(item)}
                      >
                        {isDownloading ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <Download size={15} />
                        )}
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox / Detail Inspection Dialog */}
      <dialog
        ref={previewDialogRef}
        className="mg-dialog"
        aria-label="Asset Details"
        onClose={() => setPreviewItem(null)}
      >
        {previewItem && (
          <div className="mg-dialog-content">
            <header className="mg-dialog-header">
              <div className="mg-dialog-title-wrap">
                <ImageIcon size={18} />
                <div>
                  <h3 className="mg-dialog-title">{previewItem.name}</h3>
                  <span className="mg-dialog-sub">
                    {previewItem.category} &bull; {previewItem.filename}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close preview"
                onClick={() => setPreviewItem(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="mg-dialog-preview-area">
              <img
                src={getGalleryItemUrl(previewItem)}
                alt={previewItem.name}
                className="mg-dialog-img"
                onLoad={(e) => {
                  const target = e.currentTarget
                  setImageMeta({
                    width: target.naturalWidth,
                    height: target.naturalHeight,
                  })
                }}
              />
            </div>

            <div className="mg-dialog-meta-strip">
              <div className="mg-meta-item">
                <span className="mg-meta-label">Category</span>
                <span className="mg-meta-val">{previewItem.category}</span>
              </div>
              <div className="mg-meta-item">
                <span className="mg-meta-label">Filename</span>
                <span className="mg-meta-val">{previewItem.filename}</span>
              </div>
              {imageMeta && (
                <div className="mg-meta-item">
                  <span className="mg-meta-label">Dimensions</span>
                  <span className="mg-meta-val">
                    {imageMeta.width} &times; {imageMeta.height} px
                  </span>
                </div>
              )}
              <div className="mg-meta-item">
                <span className="mg-meta-label">Path</span>
                <span className="mg-meta-val mg-path-val">{previewItem.path}</span>
              </div>
            </div>

            <footer className="mg-dialog-footer">
              <div className="mg-dialog-quick-use">
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => handleUseInChyron(previewItem)}
                >
                  <Clapperboard size={16} />
                  <span>Use in Chyron</span>
                </button>
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => handleUseInStream(previewItem)}
                >
                  <Images size={16} />
                  <span>Use in Stream Images</span>
                </button>
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => handleCopyPath(previewItem)}
                >
                  {copiedId === previewItem.id ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedId === previewItem.id ? 'Copied' : 'Copy Path'}</span>
                </button>
              </div>

              <div className="mg-dialog-primary-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void handleDownloadItem(previewItem)}
                >
                  <Download size={16} />
                  <span>Download Image</span>
                </button>
              </div>
            </footer>
          </div>
        )}
      </dialog>
    </div>
  )
}
