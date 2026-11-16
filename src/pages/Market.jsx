// src/pages/Market.jsx — CampusMarket: Secure campus-only student marketplace

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  Plus,
  Search,
  Tag,
  ShieldCheck,
  AlertTriangle,
  MessageCircle,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  RotateCcw,
  X,
  Upload,
  AlertCircle,
  Eye,
  Flag,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  MARKET_CATEGORIES,
  MARKET_CONDITIONS,
  CONTACT_PREFERENCES,
  REPORT_REASONS,
  formatPrice,
  filterAndSortListings,
  validateListingForm,
  validateReportForm,
  getMarketSignedUrl,
  uploadMarketImages,
  loadMarketConnections,
} from '../lib/market'
import { communityFriendRelationship } from '../lib/community'

// ─── 0. PRIVATE STORAGE IMAGE COMPONENT ──────────────────────
function MarketImage({ src, alt, className, fallbackText = 'No Image Provided' }) {
  const { user } = useAuth()

  if (!src || !user?.id) {
    return <MarketImageFallback className={className} text={fallbackText} />
  }

  return <AuthorizedMarketImage key={`${user.id}:${src}`} src={src} alt={alt} className={className} fallbackText={fallbackText} />
}

function MarketImageFallback({ className, text }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 text-center text-[var(--cm-muted)] ${className}`}>
      <ShoppingBag size={32} strokeWidth={1.5} className="mb-2 opacity-50" />
      <span className="text-xs font-medium">{text}</span>
    </div>
  )
}

function AuthorizedMarketImage({ src, alt, className, fallbackText }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let refreshTimer
    const refresh = async () => {
      const url = await getMarketSignedUrl(src, supabase)
      if (isMounted) {
        setSignedUrl(url)
        setLoading(false)
        // Refresh before the one-hour URL expires; retry failed authorizations later.
        refreshTimer = window.setTimeout(refresh, url ? 55 * 60 * 1000 : 60 * 1000)
      }
    }
    refresh()

    return () => {
      isMounted = false
      window.clearTimeout(refreshTimer)
    }
  }, [src])

  if (loading) {
    return <div className={`animate-pulse bg-[var(--cm-secondary)] ${className}`} />
  }

  if (!signedUrl) {
    return <MarketImageFallback className={className} text={fallbackText} />
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setSignedUrl(null)}
    />
  )
}

// ─── 1. LISTING CARD SUBCOMPONENT ─────────────────────────────
function ListingCard({
  listing,
  isOwner,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  onContact,
  onReport,
}) {
  const isFree = Number(listing.price) === 0
  const isSold = listing.status === 'sold'
  const primaryImage = listing.images && listing.images.length > 0 ? listing.images[0] : null
  const sellerName = listing.seller?.full_name || 'Campus Student'

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-[var(--cm-surface)] p-4 shadow-sm transition-all hover:shadow-md ${
        isSold ? 'border-dashed border-[var(--cm-border)] opacity-85' : 'border-[var(--cm-border)]'
      }`}
    >
      {/* Image Thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--cm-secondary)]">
        {primaryImage ? (
          <MarketImage
            src={primaryImage}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-[var(--cm-muted)]">
            <ShoppingBag size={36} strokeWidth={1.5} className="mb-2 opacity-50" />
            <span className="text-xs font-medium">No Image Provided</span>
          </div>
        )}

        {/* Price & Giveaway Badge */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-bold shadow-sm ${
              isFree
                ? 'bg-amber-500 text-white'
                : 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
            }`}
          >
            {formatPrice(listing.price)}
          </span>
          {isSold && (
            <span className="rounded-md bg-stone-700 px-2 py-1 text-xs font-bold text-white shadow-sm">
              SOLD
            </span>
          )}
        </div>

        {/* Condition Tag */}
        <div className="absolute bottom-2.5 right-2.5">
          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
            {listing.condition}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-[var(--cm-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[var(--cm-accent)]">
              {listing.category}
            </span>
            <span>By {sellerName}</span>
          </div>

          <h3 className="mt-1 text-base font-bold text-[var(--cm-text)] line-clamp-1">
            {listing.title}
          </h3>

          <p className="mt-1 text-xs text-[var(--cm-muted)] line-clamp-2">
            {listing.description}
          </p>
        </div>

        {/* Card Actions */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--cm-border)] pt-3">
          <button
            type="button"
            onClick={() => onView(listing)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--cm-accent)] hover:underline"
          >
            <Eye size={14} />
            <span>Details</span>
          </button>

          <div className="flex items-center gap-1.5">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggleStatus(listing)}
                  title={isSold ? 'Mark as available' : 'Mark as sold'}
                  className="flex items-center gap-1 rounded-md border border-[var(--cm-border)] px-2.5 py-1 text-xs font-medium text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                >
                  {isSold ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                  <span>{isSold ? 'Reopen' : 'Sold'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(listing)}
                  title="Edit listing"
                  className="rounded-md border border-[var(--cm-border)] p-1.5 text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                  aria-label="Edit listing"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(listing)}
                  title="Delete listing"
                  className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/30"
                  aria-label="Delete listing"
                >
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onContact(listing)}
                  className="flex items-center gap-1.5 rounded-md bg-[var(--cm-accent)] px-3 py-1 text-xs font-bold text-[var(--cm-accent-text)] transition-opacity hover:opacity-90"
                >
                  <MessageCircle size={13} />
                  <span>Contact</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReport(listing)}
                  title="Report listing"
                  className="rounded-md p-1.5 text-[var(--cm-muted)] hover:text-rose-600"
                  aria-label="Report listing"
                >
                  <Flag size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. DETAILS MODAL ─────────────────────────────────────────
function ListingDetailsModal({
  listing,
  isOwner,
  onClose,
  onContact,
  onReport,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  if (!listing) return null

  const isFree = Number(listing.price) === 0
  const isSold = listing.status === 'sold'
  const images = listing.images && listing.images.length > 0 ? listing.images : []
  const currentImage = images[activeImageIdx] || null
  const sellerName = listing.seller?.full_name || 'Campus Student'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)]"
          aria-label="Close details"
        >
          <X size={20} />
        </button>

        {/* Image Showcase */}
        {images.length > 0 ? (
          <div className="relative mb-6">
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-[var(--cm-secondary)]">
              <MarketImage
                src={currentImage}
                alt={listing.title}
                className="h-full w-full object-contain"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-2.5 flex justify-center gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`h-14 w-14 overflow-hidden rounded-md border-2 transition-all ${
                      idx === activeImageIdx
                        ? 'border-[var(--cm-accent)] opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <MarketImage src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 flex aspect-[16/9] w-full flex-col items-center justify-center rounded-xl bg-[var(--cm-secondary)] text-[var(--cm-muted)]">
            <ShoppingBag size={48} strokeWidth={1.5} className="mb-2 opacity-40" />
            <p className="text-sm font-medium">No photos attached</p>
          </div>
        )}

        {/* Badges and Price */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cm-border)] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-lg px-3 py-1 text-sm font-extrabold ${
                isFree
                  ? 'bg-amber-500 text-white'
                  : 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
              }`}
            >
              {formatPrice(listing.price)}
            </span>
            <span className="rounded-lg bg-[var(--cm-secondary)] px-2.5 py-1 text-xs font-bold text-[var(--cm-text)]">
              {listing.category}
            </span>
            <span className="rounded-lg border border-[var(--cm-border)] px-2.5 py-1 text-xs font-semibold text-[var(--cm-muted)]">
              Condition: {listing.condition}
            </span>
            {isSold && (
              <span className="rounded-lg bg-stone-700 px-2.5 py-1 text-xs font-bold text-white">
                Item Sold
              </span>
            )}
          </div>

          <span className="text-xs text-[var(--cm-muted)]">
            Listed {new Date(listing.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Title and Description */}
        <div className="mt-4">
          <h2 id="details-title" className="text-xl font-bold text-[var(--cm-text)]">
            {listing.title}
          </h2>

          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--cm-text)]">
            {listing.description}
          </div>
        </div>

        {/* Seller Info & Contact Preference */}
        <div className="mt-6 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-secondary)]/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-[var(--cm-muted)]">Seller</p>
              <p className="text-sm font-bold text-[var(--cm-text)]">{sellerName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--cm-muted)]">Preferred Contact</p>
              <p className="text-sm font-semibold text-[var(--cm-accent)]">
                {listing.contact_preference}
              </p>
            </div>
          </div>
        </div>

        {/* Safety Note */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <ShieldCheck size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <strong>Campus Safety:</strong> For your security, inspect items in person and exchange
            payment only in busy campus areas (e.g. library, cafe, student center). Never transfer money
            before seeing the item.
          </p>
        </div>

        {/* Modal Bottom Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cm-border)] pt-4">
          <div>
            {!isOwner && (
              <button
                type="button"
                onClick={() => onReport(listing)}
                className="flex items-center gap-1.5 text-xs text-[var(--cm-muted)] hover:text-rose-600"
              >
                <Flag size={13} />
                <span>Report Suspicious Listing</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggleStatus(listing)}
                  className="rounded-lg border border-[var(--cm-border)] px-3 py-1.5 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                >
                  {isSold ? 'Reopen Listing' : 'Mark as Sold'}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(listing)}
                  className="rounded-lg border border-[var(--cm-border)] px-3 py-1.5 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(listing)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onContact(listing)}
                className="flex items-center gap-2 rounded-lg bg-[var(--cm-accent)] px-4 py-2 text-sm font-bold text-[var(--cm-accent-text)] shadow-sm hover:opacity-90"
              >
                <MessageCircle size={16} />
                <span>Contact Seller</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 3. CREATE / EDIT LISTING FORM MODAL ───────────────────────
function ListingFormModal({
  initialData,
  isEditing,
  isOpen,
  onClose,
  onSubmit,
  submitting,
  userId,
}) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [price, setPrice] = useState(initialData?.price ?? '')
  const [category, setCategory] = useState(initialData?.category || 'Books')
  const [condition, setCondition] = useState(initialData?.condition || 'Good')
  const [contactPreference, setContactPreference] = useState(
    initialData?.contact_preference || 'CampusCommunity DM'
  )
  const [images, setImages] = useState(initialData?.images || [])
  const [uploading, setUploading] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)

  if (!isOpen) return null

  // Image file upload to private Supabase storage bucket 'campus-market'
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setUploading(true)
    setGeneralError(null)

    try {
      await uploadMarketImages(files, images.length, userId, supabase, (path) => {
        setImages((prev) => [...prev, path])
      })
    } catch (err) {
      console.error('Upload error:', err)
      setGeneralError(err.message || 'Failed to upload image.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setGeneralError(null)

    const validation = validateListingForm({
      title,
      description,
      price,
      category,
      condition,
      contactPreference,
      images,
    }, userId)

    if (!validation.isValid) {
      setFormErrors(validation.errors)
      return
    }

    setFormErrors({})
    onSubmit(validation.data)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting || uploading}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)] disabled:opacity-50"
          aria-label="Close form"
        >
          <X size={20} />
        </button>

        <h2 id="form-title" className="text-xl font-bold text-[var(--cm-text)]">
          {isEditing ? 'Edit Marketplace Listing' : 'Post an Item for Sale or Giveaway'}
        </h2>
        <p className="mt-1 text-xs text-[var(--cm-muted)]">
          Signed-in accounts can see your listing.
        </p>

        {generalError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Item Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Physics Textbook, Sony WH-1000XM4..."
              className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              maxLength={100}
            />
            {formErrors.title && (
              <p className="mt-1 text-xs text-rose-600">{formErrors.title}</p>
            )}
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              >
                {MARKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              >
                {MARKET_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Contact Preference */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Price in INR (₹) *
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm font-bold text-[var(--cm-muted)]">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0 for Free Giveaway"
                  className="w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] py-2 pl-8 pr-3 text-sm font-semibold text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--cm-muted)]">
                Enter 0 if offering as a free campus giveaway.
              </p>
              {formErrors.price && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.price}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Contact Preference
              </label>
              <select
                value={contactPreference}
                onChange={(e) => setContactPreference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              >
                {CONTACT_PREFERENCES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Description *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe item condition, edition, accessories included, reason for selling..."
              className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              maxLength={2000}
            />
            <div className="flex justify-between text-[11px] text-[var(--cm-muted)]">
              <span>{formErrors.description ? (
                <span className="text-rose-600">{formErrors.description}</span>
              ) : 'Min 10 characters'}</span>
              <span>{description.length} / 2000</span>
            </div>
          </div>

          {/* Image Upload & Management */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Photos (Max 3)
            </label>

            {/* Thumbnail preview list */}
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2.5">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--cm-border)] bg-[var(--cm-secondary)]"
                  >
                    <MarketImage
                      src={img}
                      alt={`Preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      disabled={uploading || submitting}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black disabled:opacity-50"
                      aria-label="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload controls */}
            {images.length < 3 && (
              <div className="mt-2.5">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--cm-border)] bg-[var(--cm-secondary)]/30 px-3 py-2 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]">
                  <Upload size={14} />
                  <span>{uploading ? 'Uploading...' : 'Upload Image File (≤ 5 MiB)'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            )}
            {formErrors.images && (
              <p className="mt-1 text-xs text-rose-600">{formErrors.images}</p>
            )}
            <p className="mt-1 text-[11px] text-[var(--cm-muted)]">
              Removing a photo detaches it from the listing when saved; it does not delete the stored file.
            </p>
          </div>

          {/* Form Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--cm-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || uploading}
              className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-lg bg-[var(--cm-accent)] px-5 py-2 text-xs font-bold text-[var(--cm-accent-text)] shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Listing' : 'Publish Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 4. CONTACT SELLER MODAL ──────────────────────────────────
function ContactSellerModal({
  listing,
  isOpen,
  onClose,
  friends,
  requests,
  blocked,
  connectionsLoading,
  connectionsError,
  onRetryConnections,
  onSendFriendRequest,
  onStartConversation,
  actionLoading,
}) {
  const navigate = useNavigate()
  if (!isOpen || !listing) return null

  const sellerId = listing.seller_id
  const sellerName = listing.seller?.full_name || 'Campus Student'
  const relationship = communityFriendRelationship(sellerId, friends, requests, blocked)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)]"
          aria-label="Close contact dialog"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cm-accent)] text-[var(--cm-accent-text)]">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 id="contact-title" className="text-base font-bold text-[var(--cm-text)]">
              Contact {sellerName}
            </h2>
            <p className="text-xs text-[var(--cm-muted)]">About &quot;{listing.title}&quot;</p>
          </div>
        </div>

        {/* Safety Note */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-semibold">Privacy & Safety Notice</p>
          <p className="mt-1">
            To prevent spam and protect student privacy, phone numbers and personal emails are never
            exposed. Direct messages are securely conducted through CampusCommunity.
          </p>
        </div>

        {/* Relationship Status & Action */}
        <div className="mt-5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-secondary)]/30 p-4">
          {connectionsLoading ? (
            <p className="text-xs text-[var(--cm-muted)]">Checking your connection...</p>
          ) : connectionsError ? (
            <p role="alert" className="text-xs text-rose-600">
              {connectionsError}{' '}
              <button type="button" onClick={onRetryConnections} className="font-bold underline">Retry</button>
            </p>
          ) : relationship === 'blocked' ? (
            <p className="text-xs text-[var(--cm-muted)]">
              You have blocked this student. Manage blocked students in CampusCommunity before contacting them.
            </p>
          ) : relationship === 'friend' ? (
            <div>
              <p className="text-xs font-medium text-[var(--cm-text)]">
                You and <strong>{sellerName}</strong> are connected on CampusCommunity.
              </p>
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  const convId = await onStartConversation(sellerId)
                  if (convId) {
                    onClose()
                    navigate('/community')
                  }
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cm-accent)] py-2 text-xs font-bold text-[var(--cm-accent-text)] shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <MessageCircle size={15} />
                <span>{actionLoading ? 'Connecting...' : 'Continue to CampusCommunity'}</span>
              </button>
            </div>
          ) : relationship === 'outgoing' ? (
            <div>
              <p className="text-xs font-medium text-[var(--cm-text)]">
                Friend request sent to <strong>{sellerName}</strong>.
              </p>
              <p className="mt-1 text-[11px] text-[var(--cm-muted)]">
                Once {sellerName} accepts your request on CampusCommunity, you will be able to message
                them directly.
              </p>
            </div>
          ) : relationship === 'incoming' ? (
            <div>
              <p className="text-xs font-medium text-[var(--cm-text)]">
                <strong>{sellerName}</strong> has sent you a friend request.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/community')
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cm-accent)] py-2 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90"
              >
                <span>Respond in CampusCommunity</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-[var(--cm-text)]">
                Connect with <strong>{sellerName}</strong> to start a conversation about this item.
              </p>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onSendFriendRequest(sellerId)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cm-accent)] py-2 text-xs font-bold text-[var(--cm-accent-text)] shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <UserPlus size={15} />
                <span>{actionLoading ? 'Sending...' : 'Send Friend Request to Message'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--cm-border)] px-4 py-1.5 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 5. REPORT LISTING MODAL ──────────────────────────────────
function ReportListingModal({ listing, isOpen, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [error, setError] = useState(null)

  if (!isOpen || !listing) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason
    const valid = validateReportForm(fullReason)
    if (!valid.isValid) {
      setError(valid.error)
      return
    }
    setError(null)
    onSubmit(listing.id, valid.reason)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)] disabled:opacity-50"
          aria-label="Close report dialog"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2.5 text-rose-600">
          <AlertTriangle size={20} />
          <h2 id="report-title" className="text-base font-bold text-[var(--cm-text)]">
            Report Listing
          </h2>
        </div>
        <p className="mt-1 text-xs text-[var(--cm-muted)]">
          Report &quot;{listing.title}&quot; for community guidelines violation.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-600">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs text-[var(--cm-text)]"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Additional Details (Optional)
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain why this listing is suspicious, fraudulent, or inaccurate..."
              className="mt-1 w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs text-[var(--cm-text)]"
              maxLength={400}
            />
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-[var(--cm-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-[var(--cm-border)] px-4 py-1.5 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 6. MAIN CAMPUSMARKET PAGE COMPONENT ──────────────────────
export default function Market() {
  const { user } = useAuth()
  return <MarketWorkspace key={user?.id || 'signed-out'} />
}

function MarketWorkspace() {
  const { user } = useAuth()
  const userId = user?.id

  // State
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('browse') // 'browse' | 'my-listings'
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedCondition, setSelectedCondition] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('available')
  const [sortBy, setSortBy] = useState('newest')

  // Modals
  const [selectedListing, setSelectedListing] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [contactingListing, setContactingListing] = useState(null)
  const [reportingListing, setReportingListing] = useState(null)

  // Community connections for DM check
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [blocked, setBlocked] = useState([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [connectionsError, setConnectionsError] = useState('')
  const connectionsRequestRef = useRef(0)

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Fetch listings from Supabase with joined seller profile
  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!supabase) {
        setListings([])
        return
      }

      const { data, error: fetchErr } = await supabase
        .from('market_listings')
        .select(`
          id,
          seller_id,
          title,
          description,
          price,
          category,
          condition,
          images,
          contact_preference,
          status,
          created_at,
          updated_at,
          seller:seller_id (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setListings(data || [])
    } catch (err) {
      console.error('Error fetching marketplace listings:', err)
      setError(err.message || 'Failed to load marketplace listings.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch friends and requests for the contact modal
  const fetchConnections = useCallback(async () => {
    if (!supabase || !userId) return
    const request = ++connectionsRequestRef.current
    setConnectionsLoading(true)
    setConnectionsError('')
    try {
      const connections = await loadMarketConnections(supabase, userId)
      if (request !== connectionsRequestRef.current) return
      setFriends(connections.friends)
      setRequests(connections.requests)
      setBlocked(connections.blocked)
    } catch (err) {
      console.error('Error fetching community connections:', err)
      if (request === connectionsRequestRef.current) {
        setConnectionsError(`Could not load connection status: ${err.message || 'Please try again.'}`)
      }
    } finally {
      if (request === connectionsRequestRef.current) setConnectionsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchListings()
    fetchConnections()
    return () => { connectionsRequestRef.current += 1 }
  }, [fetchListings, fetchConnections])

  const openContact = (listing) => {
    setContactingListing(listing)
    fetchConnections()
  }

  // Filtered and sorted listings
  const filteredListings = useMemo(() => {
    return filterAndSortListings(listings, {
      search,
      category: selectedCategory,
      condition: selectedCondition,
      status: activeTab === 'my-listings' ? 'all' : selectedStatus,
      sortBy,
      myUserId: user?.id,
      onlyMy: activeTab === 'my-listings',
    })
  }, [listings, search, selectedCategory, selectedCondition, selectedStatus, sortBy, activeTab, user?.id])

  // Handlers for RPC actions
  const handleCreateOrUpdate = async (formData) => {
    setSubmitting(true)
    try {
      if (editingListing) {
        const { error: rpcErr } = await supabase.rpc('market_update_listing', {
          p_listing_id: editingListing.id,
          p_title: formData.title,
          p_description: formData.description,
          p_price: formData.price,
          p_category: formData.category,
          p_condition: formData.condition,
          p_images: formData.images,
          p_contact_preference: formData.contactPreference,
        })
        if (rpcErr) throw rpcErr
        showFeedback('Listing updated successfully!')
      } else {
        const { error: rpcErr } = await supabase.rpc('market_create_listing', {
          p_title: formData.title,
          p_description: formData.description,
          p_price: formData.price,
          p_category: formData.category,
          p_condition: formData.condition,
          p_images: formData.images,
          p_contact_preference: formData.contactPreference,
        })
        if (rpcErr) throw rpcErr
        showFeedback('Item published to CampusMarket!')
      }

      setIsFormOpen(false)
      setEditingListing(null)
      await fetchListings()
    } catch (err) {
      console.error('Error saving listing:', err)
      showFeedback(err.message || 'Failed to save listing.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (listing) => {
    const newStatus = listing.status === 'available' ? 'sold' : 'available'
    setSubmitting(true)
    try {
      const { error: rpcErr } = await supabase.rpc('market_toggle_status', {
        p_listing_id: listing.id,
        p_status: newStatus,
      })
      if (rpcErr) throw rpcErr
      showFeedback(`Listing marked as ${newStatus}!`)
      if (selectedListing?.id === listing.id) {
        setSelectedListing((prev) => ({ ...prev, status: newStatus }))
      }
      await fetchListings()
    } catch (err) {
      console.error('Error toggling listing status:', err)
      showFeedback(err.message || 'Failed to update status.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.title}"? In the reviewed Market schema, this permanently deletes its reports too.`)) return
    setSubmitting(true)
    try {
      const { error: rpcErr } = await supabase.rpc('market_delete_listing', {
        p_listing_id: listing.id,
      })
      if (rpcErr) throw rpcErr
      showFeedback('Listing deleted successfully.')
      if (selectedListing?.id === listing.id) {
        setSelectedListing(null)
      }
      await fetchListings()
    } catch (err) {
      console.error('Error deleting listing:', err)
      showFeedback(err.message || 'Failed to delete listing.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReport = async (listingId, reason) => {
    setSubmitting(true)
    try {
      const { error: rpcErr } = await supabase.rpc('market_report_listing', {
        p_listing_id: listingId,
        p_reason: reason,
      })
      if (rpcErr) throw rpcErr
      showFeedback('Thank you for keeping CampusMarket safe. Report submitted for review.')
      setReportingListing(null)
    } catch (err) {
      console.error('Error reporting listing:', err)
      showFeedback(err.message || 'Failed to submit report.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendFriendRequest = async (sellerId) => {
    setSubmitting(true)
    try {
      const { error: rpcErr } = await supabase.rpc('community_send_friend_request', {
        p_other: sellerId,
      })
      if (rpcErr) throw rpcErr
      showFeedback('Friend request sent! Once accepted, you can direct message the seller.')
      await fetchConnections()
    } catch (err) {
      console.error('Error sending friend request:', err)
      showFeedback(err.message || 'Failed to send request.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartConversation = async (sellerId) => {
    setSubmitting(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('community_start_conversation', {
        p_other: sellerId,
      })
      if (rpcErr) throw rpcErr
      return data
    } catch (err) {
      console.error('Error starting conversation:', err)
      showFeedback(err.message || 'Failed to connect.', 'error')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold shadow-lg transition-all ${
            feedback.type === 'error'
              ? 'border border-rose-200 bg-rose-600 text-white'
              : 'border border-[var(--cm-border)] bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Safety Notice Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Campus Safety Reminder:</strong> Only exchange items in daylight at high-traffic campus
            locations (e.g. library, cafe, student centre). CampusMate does not process bank payments or
            hold funds.
          </span>
        </div>
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          Listings visible to signed-in accounts
        </span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-sm">
              <ShoppingBag size={22} strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--cm-text)]">
              CampusMarket
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--cm-muted)]">
            Buy, sell and give away textbooks, electronics and hostel gear with other signed-in accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingListing(null)
              setIsFormOpen(true)
            }}
            className="flex items-center gap-2 rounded-xl bg-[var(--cm-accent)] px-4 py-2.5 text-xs font-bold text-[var(--cm-accent-text)] shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            <span>Post an Item</span>
          </button>
        </div>
      </div>

      {/* Tabs: Browse vs My Listings */}
      <div className="mt-6 flex border-b border-[var(--cm-border)]">
        <button
          type="button"
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'browse'
              ? 'border-[var(--cm-accent)] text-[var(--cm-accent)]'
              : 'border-transparent text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
          }`}
        >
          <ShoppingBag size={14} />
          <span>Browse All Items</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my-listings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'my-listings'
              ? 'border-[var(--cm-accent)] text-[var(--cm-accent)]'
              : 'border-transparent text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
          }`}
        >
          <Tag size={14} />
          <span>My Listings</span>
          {listings.filter((l) => l.seller_id === user?.id).length > 0 && (
            <span className="rounded-full bg-[var(--cm-secondary)] px-2 py-0.5 text-[10px]">
              {listings.filter((l) => l.seller_id === user?.id).length}
            </span>
          )}
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="mt-5 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search bar */}
          <div className="relative lg:col-span-2">
            <Search
              size={15}
              className="absolute left-3 top-2.5 text-[var(--cm-muted)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author or item..."
              className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] py-2 pl-9 pr-3 text-xs text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs font-medium text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              aria-label="Filter by category"
            >
              <option value="All">All Categories</option>
              {MARKET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Condition Filter */}
          <div>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs font-medium text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              aria-label="Filter by condition"
            >
              <option value="All">All Conditions</option>
              {MARKET_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs font-medium text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-hidden"
              aria-label="Sort listings"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Status Filter for Browse Tab */}
        {activeTab === 'browse' && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--cm-border)] pt-3 text-xs text-[var(--cm-muted)]">
            <span className="font-semibold">Show:</span>
            <button
              type="button"
              onClick={() => setSelectedStatus('available')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                selectedStatus === 'available'
                  ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
                  : 'bg-[var(--cm-secondary)] text-[var(--cm-text)] hover:opacity-80'
              }`}
            >
              Available Only
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                selectedStatus === 'all'
                  ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
                  : 'bg-[var(--cm-secondary)] text-[var(--cm-text)] hover:opacity-80'
              }`}
            >
              Include Sold
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center py-16 text-center text-[var(--cm-muted)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cm-accent)] border-t-transparent" />
          <p className="mt-3 text-xs font-semibold">Loading marketplace listings...</p>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle size={24} className="mx-auto mb-2 text-rose-600" />
          <p className="text-sm font-bold">Failed to load marketplace</p>
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchListings}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--cm-border)] bg-[var(--cm-surface)] p-12 text-center">
          <ShoppingBag size={42} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--cm-muted)] opacity-40" />
          <h3 className="text-base font-bold text-[var(--cm-text)]">
            {activeTab === 'my-listings' ? 'No items listed yet' : 'No listings found'}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--cm-muted)]">
            {activeTab === 'my-listings'
              ? 'You have not posted any items for sale or giveaway yet. Declutter your room and help a fellow student!'
              : 'Try clearing your search query or adjusting your category and condition filters.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'my-listings') {
                setEditingListing(null)
                setIsFormOpen(true)
              } else {
                setSearch('')
                setSelectedCategory('All')
                setSelectedCondition('All')
                setSelectedStatus('available')
              }
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--cm-accent)] px-4 py-2 text-xs font-bold text-[var(--cm-accent-text)] shadow-sm hover:opacity-90"
          >
            {activeTab === 'my-listings' ? (
              <>
                <Plus size={14} />
                <span>Post Your First Item</span>
              </>
            ) : (
              <span>Reset Filters</span>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isOwner={listing.seller_id === user?.id}
              onView={(item) => setSelectedListing(item)}
              onEdit={(item) => {
                setEditingListing(item)
                setIsFormOpen(true)
              }}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onContact={openContact}
              onReport={(item) => setReportingListing(item)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedListing && (
        <ListingDetailsModal
          listing={selectedListing}
          isOwner={selectedListing.seller_id === user?.id}
          onClose={() => setSelectedListing(null)}
          onContact={(item) => {
            setSelectedListing(null)
            openContact(item)
          }}
          onReport={(item) => {
            setSelectedListing(null)
            setReportingListing(item)
          }}
          onEdit={(item) => {
            setSelectedListing(null)
            setEditingListing(item)
            setIsFormOpen(true)
          }}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      )}

      {isFormOpen && (
        <ListingFormModal
          key={editingListing ? editingListing.id : 'new-listing'}
          initialData={editingListing}
          isEditing={Boolean(editingListing)}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false)
            setEditingListing(null)
          }}
          onSubmit={handleCreateOrUpdate}
          submitting={submitting}
          userId={user?.id}
        />
      )}

      {contactingListing && (
        <ContactSellerModal
          listing={contactingListing}
          isOpen={Boolean(contactingListing)}
          onClose={() => setContactingListing(null)}
          friends={friends}
          requests={requests}
          blocked={blocked}
          connectionsLoading={connectionsLoading}
          connectionsError={connectionsError}
          onRetryConnections={fetchConnections}
          onSendFriendRequest={handleSendFriendRequest}
          onStartConversation={handleStartConversation}
          actionLoading={submitting}
        />
      )}

      {reportingListing && (
        <ReportListingModal
          listing={reportingListing}
          isOpen={Boolean(reportingListing)}
          onClose={() => setReportingListing(null)}
          onSubmit={handleReport}
          submitting={submitting}
        />
      )}
    </div>
  )
}
