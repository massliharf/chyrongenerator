import { useState, useMemo, useEffect, useRef } from 'react'
import { X, Search, Image as ImageIcon, Upload } from 'lucide-react'
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  getGalleryItemUrl,
  getGalleryItemThumbUrl,
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
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
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
      className="dialog dialog-xl picker-dialog"
      aria-labelledby="picker-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <header className="dialog-header">
        <div>
          <h2 id="picker-title">Choose from Media gallery</h2>
          <p>{GALLERY_ITEMS.length} built-in assets</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close gallery" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="picker-toolbar">
        <div className="search-field">
          <Search size={18} className="search-field-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search assets"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search assets"
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
        <div className="chip-row" role="group" aria-label="Asset categories">
          {['All', ...GALLERY_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              className="filter-chip"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              <span className="count">
                {cat === 'All'
                  ? GALLERY_ITEMS.length
                  : GALLERY_ITEMS.filter((i) => i.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="dialog-body">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <ImageIcon size={40} aria-hidden="true" />
            <strong>No assets match</strong>
            <span>Try another search term or category.</span>
          </div>
        ) : (
          <div className="picker-grid">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="picker-card"
                aria-label={`Use ${item.name} (${item.category})`}
                onClick={() => onSelect(item)}
              >
                <span className="picker-card-thumb checker">
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
                </span>
                <span className="picker-card-name">{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className="dialog-footer">
        <span className="dialog-footer-note">
          {filteredItems.length} of {GALLERY_ITEMS.length} assets
        </span>
        <span className="dialog-footer-spacer" />
        <button type="button" className="button outline" onClick={onClose}>
          Cancel
        </button>
        {onUploadClick && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              onClose()
              onUploadClick()
            }}
          >
            <Upload size={16} aria-hidden="true" /> Upload from device
          </button>
        )}
      </footer>
    </dialog>
  )
}
