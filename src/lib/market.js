// src/lib/market.js — CampusMarket domain logic, filtering, formatting and validation

export const MARKET_CATEGORIES = [
  'Books',
  'Electronics',
  'Accessories',
  'Hostel Essentials',
  'Other',
]

export const MARKET_CONDITIONS = [
  'New',
  'Like New',
  'Good',
  'Fair',
]

export const CONTACT_PREFERENCES = [
  'CampusCommunity DM',
  'Meet on Campus',
  'Either',
]

export const REPORT_REASONS = [
  'Misleading or inaccurate description',
  'Prohibited or illegal item',
  'Suspected fraud or scam',
  'Duplicate or spam listing',
  'Other safety concern',
]

export const MARKET_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const MARKET_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/**
 * Validate the whole selection before uploading any files.
 */
export function validateMarketImageFiles(files, existingCount = 0) {
  if (existingCount + files.length > 3) {
    return 'You can have at most 3 images per listing.'
  }
  for (const file of files) {
    if (!Object.hasOwn(MARKET_IMAGE_EXTENSIONS, file.type)) {
      return 'Only JPEG, PNG, WebP and GIF images are permitted.'
    }
    if (file.size > MARKET_IMAGE_MAX_BYTES) {
      return 'Images must be 5 MiB or smaller each.'
    }
  }
  return null
}

/**
 * Keep each successful upload in the form even if a later upload fails.
 * This intentionally does not delete Storage objects.
 */
export async function uploadMarketImages(files, existingCount, userId, supabaseClient, onUploaded) {
  const validationError = validateMarketImageFiles(files, existingCount)
  if (validationError) throw new Error(validationError)
  if (!userId || !supabaseClient) throw new Error('Sign in to upload images.')

  for (const file of files) {
    const ext = MARKET_IMAGE_EXTENSIONS[file.type]
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabaseClient.storage.from('campus-market').upload(path, file)
    if (error) throw new Error(`Storage upload failed: ${error.message || 'Please try again.'}`)
    onUploaded(path)
  }
}

/**
 * Load the relationship hints used by the Market contact dialog.
 * Authorization remains enforced by the Community RPCs.
 */
export async function loadMarketConnections(supabaseClient, userId) {
  const [friendsRes, requestsRes, blockedRes] = await Promise.all([
    supabaseClient.from('community_friendships')
      .select('user_a, user_b').eq('active', true)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`),
    supabaseClient.from('community_friend_requests')
      .select('id, requester_id, recipient_id')
      .eq('status', 'pending')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
    supabaseClient.from('community_blocks')
      .select('blocked_id').eq('blocker_id', userId),
  ])
  for (const result of [friendsRes, requestsRes, blockedRes]) {
    if (result.error) throw result.error
  }
  return {
    friends: (friendsRes.data || []).map((item) => ({
      id: item.user_a === userId ? item.user_b : item.user_a,
    })),
    requests: (requestsRes.data || []).map((item) => ({
      id: item.id,
      peerId: item.requester_id === userId ? item.recipient_id : item.requester_id,
      direction: item.requester_id === userId ? 'outgoing' : 'incoming',
    })),
    blocked: (blockedRes.data || []).map((item) => ({ id: item.blocked_id })),
  }
}

/**
 * Format an INR price or display a Giveaway badge
 */
export function formatPrice(price) {
  const num = Number(price)
  if (isNaN(num) || num <= 0) {
    return 'Free'
  }
  return `₹${num.toLocaleString('en-IN')}`
}

/**
 * Filter and sort listings
 */
export function filterAndSortListings(listings, filters = {}) {
  if (!Array.isArray(listings)) return []

  const search = (filters.search || '').trim().toLowerCase()
  const category = filters.category || 'All'
  const condition = filters.condition || 'All'
  const status = filters.status || 'available'
  const sortBy = filters.sortBy || 'newest'
  const myUserId = filters.myUserId || null
  const onlyMy = Boolean(filters.onlyMy)

  let result = listings.filter((item) => {
    // Only my listings filter
    if (onlyMy) {
      if (!myUserId || item.seller_id !== myUserId) return false
    }

    // Status filter
    if (status !== 'all') {
      if (item.status !== status) return false
    }

    // Category filter
    if (category !== 'All') {
      if (item.category !== category) return false
    }

    // Condition filter
    if (condition !== 'All') {
      if (item.condition !== condition) return false
    }

    // Search query on title and description
    if (search) {
      const matchTitle = (item.title || '').toLowerCase().includes(search)
      const matchDesc = (item.description || '').toLowerCase().includes(search)
      const matchCat = (item.category || '').toLowerCase().includes(search)
      if (!matchTitle && !matchDesc && !matchCat) return false
    }

    return true
  })

  // Sorting
  result.sort((a, b) => {
    if (sortBy === 'price-asc') {
      return Number(a.price || 0) - Number(b.price || 0)
    }
    if (sortBy === 'price-desc') {
      return Number(b.price || 0) - Number(a.price || 0)
    }
    // Default newest
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  return result
}

/**
 * Retrieve authenticated signed URL for private storage paths
 */
export async function getMarketSignedUrl(path, supabaseClient, expiresIn = 3600) {
  // Never reuse a persisted bearer URL or load a legacy external URL.
  // Listing RPCs accept only a seller folder and a safe filename.
  if (typeof path !== 'string' ||
      !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path) ||
      !supabaseClient) return null

  try {
    const { data, error } = await supabaseClient.storage
      .from('campus-market')
      .createSignedUrl(path, expiresIn)

    if (error || !data?.signedUrl) {
      return null
    }

    // Reauthorize each request: a path-only cache could reuse one account's
    // bearer URL after a different account signs in or a listing is removed.
    return data.signedUrl
  } catch (err) {
    console.error('Failed to get signed image URL:', err)
    return null
  }
}

/**
 * Validate listing form inputs and enforce storage path ownership
 */
export function validateListingForm(form = {}, authenticatedUserId = null) {
  const errors = {}

  const title = (form.title || '').trim()
  const description = (form.description || '').trim()
  const priceRaw = form.price
  const price = priceRaw === '' || priceRaw === null || priceRaw === undefined ? NaN : Number(priceRaw)
  const category = form.category || 'Books'
  const condition = form.condition || 'Good'
  const contactPreference = form.contactPreference || 'CampusCommunity DM'
  const images = Array.isArray(form.images) ? form.images : []

  if (!title || title.length < 3 || title.length > 100) {
    errors.title = 'Title must be between 3 and 100 characters.'
  }

  if (!description || description.length < 10 || description.length > 2000) {
    errors.description = 'Description must be between 10 and 2000 characters.'
  }

  if (isNaN(price) || price < 0 || price > 100000) {
    errors.price = 'Price must be between ₹0 and ₹1,00,000.'
  }

  if (!MARKET_CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${MARKET_CATEGORIES.join(', ')}`
  }

  if (!MARKET_CONDITIONS.includes(condition)) {
    errors.condition = `Condition must be one of: ${MARKET_CONDITIONS.join(', ')}`
  }

  if (!CONTACT_PREFERENCES.includes(contactPreference)) {
    errors.contactPreference = 'Invalid contact preference selected.'
  }

  if (images.length > 3) {
    errors.images = 'You can upload up to 3 images only.'
  }

  for (const img of images) {
    if (typeof img !== 'string') {
      errors.images = 'Invalid image path.'
      break
    }

    // Reject temporary blob URLs
    if (img.startsWith('blob:')) {
      errors.images = 'Temporary blob URLs cannot be persisted. Upload images first.'
      break
    }

    // Reject external HTTP/HTTPS URLs
    if (img.startsWith('http://') || img.startsWith('https://')) {
      errors.images = 'External image URLs are not permitted. Store images in your private storage folder.'
      break
    }

    // Verify image belongs to authenticated user's folder
    if (authenticatedUserId) {
      const userFolderPattern = new RegExp(`^${authenticatedUserId}/[a-zA-Z0-9_\\-\\.]+$`)
      if (!userFolderPattern.test(img)) {
        errors.images = `Image "${img}" does not belong to your authenticated user folder.`
        break
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      title,
      description,
      price: isNaN(price) ? 0 : price,
      category,
      condition,
      contactPreference,
      images,
    },
  }
}

/**
 * Validate listing report input
 */
export function validateReportForm(reason = '') {
  const clean = reason.trim()
  if (!clean || clean.length < 5 || clean.length > 500) {
    return {
      isValid: false,
      error: 'Report reason must be between 5 and 500 characters.',
      reason: clean,
    }
  }
  return {
    isValid: true,
    error: null,
    reason: clean,
  }
}
