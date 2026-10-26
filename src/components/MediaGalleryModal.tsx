import { useState, useMemo, useEffect, useRef } from 'react'
import { X, Search, Image as ImageIcon, Upload } from 'lucide-react'
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  getGalleryItemUrl,
  getGalleryItemThumbUrl,
  type GalleryItem,
} from '../studio/galleryData'
import { useCloud } from '../cloud/useCloud'
import { MEDIA_CATEGORY } from '../cloud/client'

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
  const { media: teamMedia } = useCloud()
  const allItems = useMemo(() => [...teamMedia, ...GALLERY_ITEMS], [teamMedia])
  const categories = teamMedia.length
    ? ['All', MEDIA_CATEGORY, ...GALLERY_CATEGORIES]
    : ['All', ...GALLERY_CATEGORIES]

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
    return allItems.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(query))
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.filename.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        Boolean(matchKeywords)
      return matchesCategory && matchesSearch
    })
  }, [allItems, selectedCategory, searchQuery])

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
          <p>
            {GALLERY_ITEMS.length} built-in assets
            {teamMedia.length ? ` · ${teamMedia.length} team uploads` : ''}
          </p>
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
          {categories.map((cat) => (
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
                  ? allItems.length
                  : allItems.filter((i) => i.category === cat).length}
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
                <span className="picker-card-thumb">
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
          {filteredItems.length} of {allItems.length} assets
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
