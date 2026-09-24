import { useState, useMemo, useEffect, useRef } from 'react'
import { X, Search, Image as ImageIcon, Upload, Check, Download } from 'lucide-react'
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  getGalleryItemUrl,
  getGalleryItemThumbUrl,
  downloadGalleryItem,
  type GalleryItem,
} from '../studio/galleryData'

interface MediaGalleryModalProps {
  open: boolean
  initialCategory?: string
  onClose: () => void
  onSelect: (item: GalleryItem) => void
  onUploadClick?: () => void
}

export function MediaGalleryModal({
  open,
  initialCategory,
  onClose,
  onSelect,
  onUploadClick,
}: MediaGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'All')
  const [prevCategory, setPrevCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  if (initialCategory !== prevCategory) {
    setPrevCategory(initialCategory)
    setSelectedCategory(initialCategory || 'All')
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  const filteredItems = useMemo(() => {
    return GALLERY_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.filename.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="media-gallery-dialog"
      aria-label="Media Gallery"
      onClose={onClose}
    >
      <div className="media-gallery-container">
        <header className="media-gallery-header">
          <div className="media-gallery-title-wrap">
            <div className="media-gallery-icon">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="media-gallery-title">Media Gallery</h2>
              <p className="media-gallery-subtitle">
                Select from {GALLERY_ITEMS.length} built-in assets or upload your own
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button close-button"
            aria-label="Close gallery"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="media-gallery-toolbar">
          <div className="media-gallery-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search assets by name or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search assets"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {onUploadClick && (
            <button
              type="button"
              className="button subtle upload-shortcut"
              onClick={() => {
                onClose()
                onUploadClick()
              }}
            >
              <Upload size={16} />
              <span>Upload from device</span>
            </button>
          )}
        </div>

        <nav className="media-gallery-categories" aria-label="Asset categories">
          <button
            type="button"
            className={`category-pill ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('All')}
          >
            All <span className="category-count">{GALLERY_ITEMS.length}</span>
          </button>
          {GALLERY_CATEGORIES.map((cat) => {
            const count = GALLERY_ITEMS.filter((i) => i.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} <span className="category-count">{count}</span>
              </button>
            )
          })}
        </nav>

        <div className="media-gallery-grid-wrap">
          {filteredItems.length === 0 ? (
            <div className="media-gallery-empty">
              <ImageIcon size={40} />
              <p>No matching assets found</p>
              <span>Try a different search keyword or category</span>
            </div>
          ) : (
            <div className="media-gallery-grid">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`gallery-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedItem(item)
                      onSelect(item)
                    }}
                    title={`${item.name} (${item.category})`}
                  >
                    <div className="gallery-thumbnail-wrap">
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
                        className="gallery-thumbnail"
                      />
                      <button
                        type="button"
                        className="gallery-item-download-btn"
                        title={`Download ${item.filename}`}
                        aria-label={`Download ${item.filename}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          void downloadGalleryItem(item)
                        }}
                      >
                        <Download size={14} />
                      </button>
                      {isSelected && (
                        <div className="gallery-check">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                    <div className="gallery-card-info">
                      <span className="gallery-card-name">{item.name}</span>
                      <span className="gallery-card-category">{item.category}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <footer className="media-gallery-footer">
          <span className="media-gallery-info">
            Showing {filteredItems.length} of {GALLERY_ITEMS.length} assets
          </span>
          <div className="media-gallery-actions">
            <button type="button" className="button subtle" onClick={onClose}>
              Cancel
            </button>
            {onUploadClick && (
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  onClose()
                  onUploadClick()
                }}
              >
                <Upload size={16} /> Upload image
              </button>
            )}
          </div>
        </footer>
      </div>
    </dialog>
  )
}
