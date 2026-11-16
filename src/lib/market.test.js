// src/lib/market.test.js — Tests for CampusMarket domain logic and SQL migration contracts

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  formatPrice,
  filterAndSortListings,
  validateListingForm,
  validateReportForm,
  getMarketSignedUrl,
  MARKET_IMAGE_MAX_BYTES,
  validateMarketImageFiles,
  uploadMarketImages,
  loadMarketConnections,
} from './market.js'

const migration = readFileSync(new URL('../../database/migration_campus_market.sql', import.meta.url), 'utf8')
const completion = readFileSync(new URL('../../database/migration_campus_market_completion.sql', import.meta.url), 'utf8')
const marketPage = readFileSync(new URL('../pages/Market.jsx', import.meta.url), 'utf8')
const moderationPage = readFileSync(new URL('../components/MarketModeration.jsx', import.meta.url), 'utf8')

test('formatPrice formats INR amounts and free giveaways safely', () => {
  assert.equal(formatPrice(0), 'Free')
  assert.equal(formatPrice('0'), 'Free')
  assert.equal(formatPrice(-5), 'Free')
  assert.equal(formatPrice(250), '₹250')
  assert.equal(formatPrice(1500), '₹1,500')
  assert.equal(formatPrice('45000'), '₹45,000')
  assert.equal(formatPrice(NaN), 'Free')
})

test('filterAndSortListings filters by search, category, condition, status, and user', () => {
  const items = [
    {
      id: '1',
      seller_id: 'user-1',
      title: 'Engineering Mathematics Vol 1',
      description: 'Standard textbook for first year, minimal highlights',
      price: 350,
      category: 'Books',
      condition: 'Good',
      status: 'available',
      created_at: '2026-02-01T10:00:00Z',
    },
    {
      id: '2',
      seller_id: 'user-2',
      title: 'Scientific Calculator fx-991EX',
      description: 'Used for two semesters, working perfectly',
      price: 800,
      category: 'Electronics',
      condition: 'Like New',
      status: 'available',
      created_at: '2026-02-02T10:00:00Z',
    },
    {
      id: '3',
      seller_id: 'user-1',
      title: 'Study Lamp (Rechargeable)',
      description: 'LED desk lamp with clamp',
      price: 0,
      category: 'Hostel Essentials',
      condition: 'Fair',
      status: 'sold',
      created_at: '2026-01-15T10:00:00Z',
    },
  ]

  // Filter category
  assert.equal(filterAndSortListings(items, { category: 'Electronics' }).length, 1)
  assert.equal(filterAndSortListings(items, { category: 'Electronics' })[0].id, '2')

  // Filter condition
  assert.equal(filterAndSortListings(items, { condition: 'Like New' }).length, 1)

  // Filter status
  assert.equal(filterAndSortListings(items, { status: 'sold' }).length, 1)
  assert.equal(filterAndSortListings(items, { status: 'available' }).length, 2)
  assert.equal(filterAndSortListings(items, { status: 'all' }).length, 3)

  // Search by title
  assert.equal(filterAndSortListings(items, { search: 'calculator', status: 'all' }).length, 1)
  assert.equal(filterAndSortListings(items, { search: 'calculator', status: 'all' })[0].id, '2')

  // Search by description
  assert.equal(filterAndSortListings(items, { search: 'textbook', status: 'all' }).length, 1)

  // My listings filter
  assert.equal(filterAndSortListings(items, { onlyMy: true, myUserId: 'user-1', status: 'all' }).length, 2)

  // Sort by price asc
  const asc = filterAndSortListings(items, { status: 'all', sortBy: 'price-asc' })
  assert.equal(asc[0].id, '3') // ₹0
  assert.equal(asc[2].id, '2') // ₹800

  // Sort by price desc
  const desc = filterAndSortListings(items, { status: 'all', sortBy: 'price-desc' })
  assert.equal(desc[0].id, '2') // ₹800
  assert.equal(desc[2].id, '3') // ₹0
})

test('validateListingForm enforces bounds, required fields, and seller folder storage paths', () => {
  const userId = 'usr-uuid-123'
  const valid = validateListingForm({
    title: 'Data Structures and Algorithms in C++',
    description: 'Third edition in excellent condition with no missing pages.',
    price: 450,
    category: 'Books',
    condition: 'Like New',
    contactPreference: 'CampusCommunity DM',
    images: [`${userId}/item1.jpg`, `${userId}/item2.png`],
  }, userId)
  assert.equal(valid.isValid, true)
  assert.equal(valid.data.price, 450)
  assert.equal(valid.data.images.length, 2)

  // Title too short
  const shortTitle = validateListingForm({
    title: 'ab',
    description: 'Valid long description for this item testing',
    price: 100,
    category: 'Books',
  }, userId)
  assert.equal(shortTitle.isValid, false)
  assert.match(shortTitle.errors.title, /between 3 and 100/)

  // Description too short
  const shortDesc = validateListingForm({
    title: 'Valid Long Title',
    description: 'short',
    price: 100,
    category: 'Books',
  }, userId)
  assert.equal(shortDesc.isValid, false)
  assert.match(shortDesc.errors.description, /between 10 and 2000/)

  // Negative price
  const negPrice = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: -10,
    category: 'Books',
  }, userId)
  assert.equal(negPrice.isValid, false)
  assert.match(negPrice.errors.price, /between ₹0 and ₹1,00,000/)

  // Exceeding 3 images
  const tooManyImages = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: 100,
    category: 'Books',
    images: [`${userId}/1.jpg`, `${userId}/2.jpg`, `${userId}/3.jpg`, `${userId}/4.jpg`],
  }, userId)
  assert.equal(tooManyImages.isValid, false)
  assert.match(tooManyImages.errors.images, /up to 3 images only/)

  // Blob URL rejection
  const blobImage = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: 100,
    category: 'Books',
    images: ['blob:http://localhost:5173/1234-5678'],
  }, userId)
  assert.equal(blobImage.isValid, false)
  assert.match(blobImage.errors.images, /Temporary blob URLs cannot be persisted/)

  // External URL rejection
  const externalImage = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: 100,
    category: 'Books',
    images: ['https://example.com/photo.jpg'],
  }, userId)
  assert.equal(externalImage.isValid, false)
  assert.match(externalImage.errors.images, /External image URLs are not permitted/)

  // Foreign user folder rejection
  const foreignFolder = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: 100,
    category: 'Books',
    images: ['other-user-456/photo.jpg'],
  }, userId)
  assert.equal(foreignFolder.isValid, false)
  assert.match(foreignFolder.errors.images, /does not belong to your authenticated user folder/)

  // Directory traversal path rejection
  const traversal = validateListingForm({
    title: 'Valid Title Here',
    description: 'Valid description here for testing item form',
    price: 100,
    category: 'Books',
    images: [`${userId}/../../secrets.jpg`],
  }, userId)
  assert.equal(traversal.isValid, false)
  assert.match(traversal.errors.images, /does not belong to your authenticated user folder/)
})

test('validateReportForm validates report reasons', () => {
  const valid = validateReportForm('Seller is selling prohibited electronic equipment.')
  assert.equal(valid.isValid, true)
  assert.equal(valid.error, null)

  const short = validateReportForm('bad')
  assert.equal(short.isValid, false)
  assert.match(short.error, /between 5 and 500/)
})

test('image validation accepts four MIME types and the exact 5 MiB boundary', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    assert.equal(validateMarketImageFiles([{ type, size: MARKET_IMAGE_MAX_BYTES }]), null)
  }
  assert.match(validateMarketImageFiles([{ type: 'image/jpeg', size: MARKET_IMAGE_MAX_BYTES + 1 }]), /5 MiB/)
  assert.match(validateMarketImageFiles([{ type: 'image/svg+xml', size: 1 }]), /Only JPEG, PNG, WebP and GIF/)
  assert.match(validateMarketImageFiles([{ type: 'image/jpeg', size: 1 }], 3), /at most 3/)
})

test('[mock] uploads validate the complete selection and retain each success after a later failure', async () => {
  const calls = []
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'campus-market')
        return {
          async upload(path, file) {
            calls.push({ path, file })
            return { error: calls.length === 2 ? new Error('upload denied') : null }
          },
        }
      },
    },
  }
  const uploaded = []
  const jpeg = { type: 'image/jpeg', size: 100 }
  const png = { type: 'image/png', size: 100 }
  await assert.rejects(
    uploadMarketImages([jpeg, { type: 'image/svg+xml', size: 1 }], 0, 'seller-1', client, (path) => uploaded.push(path)),
    /Only JPEG/
  )
  assert.equal(calls.length, 0)
  await assert.rejects(
    uploadMarketImages([jpeg, png], 0, 'seller-1', client, (path) => uploaded.push(path)),
    /Storage upload failed: upload denied/
  )
  assert.equal(calls.length, 2)
  assert.equal(uploaded.length, 1)
  assert.equal(uploaded[0], calls[0].path)
  assert.match(uploaded[0], /^seller-1\/[a-zA-Z0-9_.-]+\.jpg$/)
  assert.match(calls[1].path, /^seller-1\/[a-zA-Z0-9_.-]+\.png$/)
})

test('[mock] uploads derive safe extensions from all supported MIME types', async () => {
  const paths = []
  const client = { storage: { from: () => ({
    upload: async (path) => { paths.push(path); return { error: null } },
  }) } }
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    await uploadMarketImages([{ type, size: 1 }], 0, 'seller-1', client, () => {})
  }
  assert.deepEqual(paths.map((path) => path.split('.').pop()), ['jpg', 'png', 'webp', 'gif'])
})

test('[mock] Market contact relationships use the actual friendship schema and surface errors', async () => {
  const calls = []
  const responses = {
    community_friendships: { data: [{ user_a: 'me', user_b: 'friend' }], error: null },
    community_friend_requests: { data: [
      { id: 'r1', requester_id: 'me', recipient_id: 'outgoing' },
      { id: 'r2', requester_id: 'incoming', recipient_id: 'me' },
    ], error: null },
    community_blocks: { data: [{ blocked_id: 'blocked' }], error: null },
  }
  const client = {
    from(table) {
      const builder = {
        select(value) { calls.push([table, 'select', value]); return this },
        eq(column, value) { calls.push([table, 'eq', column, value]); return this },
        or(value) { calls.push([table, 'or', value]); return this },
        then(resolve, reject) { return Promise.resolve(responses[table]).then(resolve, reject) },
      }
      return builder
    },
  }
  assert.deepEqual(await loadMarketConnections(client, 'me'), {
    friends: [{ id: 'friend' }],
    requests: [
      { id: 'r1', peerId: 'outgoing', direction: 'outgoing' },
      { id: 'r2', peerId: 'incoming', direction: 'incoming' },
    ],
    blocked: [{ id: 'blocked' }],
  })
  assert.ok(calls.some((call) => call.join('|') === 'community_friendships|eq|active|true'))
  assert.ok(calls.some((call) => call.join('|') === 'community_friend_requests|select|id, requester_id, recipient_id'))
  responses.community_friendships = { data: null, error: new Error('permission denied') }
  await assert.rejects(loadMarketConnections(client, 'me'), /permission denied/)
})

test('[mock] getMarketSignedUrl reauthorizes storage paths and rejects persisted URLs', async () => {
  // Empty or invalid inputs
  assert.equal(await getMarketSignedUrl(null, null), null)
  assert.equal(await getMarketSignedUrl('', null), null)

  // Persisted bearer or external URLs must never bypass authorization.
  const signedUrl = 'https://supabase.co/storage/v1/object/sign/campus-market/u/img.jpg?token=abc123xyz'
  assert.equal(await getMarketSignedUrl(signedUrl, null), null)
  assert.equal(await getMarketSignedUrl('https://example.com/photo.jpg', null), null)
  assert.equal(await getMarketSignedUrl('blob:example', null), null)

  // Calling Supabase client to create a signed URL
  let callCount = 0
  const fakeSupabase = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'campus-market')
        return {
          async createSignedUrl(path, expiresIn) {
            callCount++
            assert.equal(expiresIn, 3600)
            return {
              data: { signedUrl: `https://mock.supabase.co/signed/${path}?token=generated` },
              error: null,
            }
          },
        }
      },
    },
  }

  const testPath = 'u-test-789/book.jpg'
  const result1 = await getMarketSignedUrl(testPath, fakeSupabase, 3600)
  assert.equal(result1, `https://mock.supabase.co/signed/${testPath}?token=generated`)
  assert.equal(callCount, 1)

  // A second call reauthorizes; a prior account's URL must not be reused.
  const result2 = await getMarketSignedUrl(testPath, fakeSupabase, 3600)
  assert.equal(result2, result1)
  assert.equal(callCount, 2)

  // Error handling returns null cleanly
  const failingSupabase = {
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return { data: null, error: new Error('Object not found') }
          },
        }
      },
    },
  }
  const failResult = await getMarketSignedUrl('u-test-fail/missing.jpg', failingSupabase)
  assert.equal(failResult, null)
  assert.equal(await getMarketSignedUrl(testPath, failingSupabase), null)
})

test('[static] Market warns about report deletion and refreshes actual moderation records', () => {
  assert.match(migration, /listing_id\s+UUID NOT NULL REFERENCES public\.market_listings\(id\) ON DELETE CASCADE/)
  assert.match(marketPage, /permanently deletes its reports/)
  assert.match(moderationPage, /permanently deletes its reports/)
  assert.match(moderationPage, /await loadData\(\)/)
  assert.doesNotMatch(moderationPage, /market_listings: null/)
})

test('[static] every Market UI RPC matches both applicable local SQL signatures', () => {
  const expected = {
    market_create_listing: ['p_title', 'p_description', 'p_price', 'p_category', 'p_condition', 'p_images', 'p_contact_preference'],
    market_update_listing: ['p_listing_id', 'p_title', 'p_description', 'p_price', 'p_category', 'p_condition', 'p_images', 'p_contact_preference'],
    market_toggle_status: ['p_listing_id', 'p_status'],
    market_delete_listing: ['p_listing_id'],
    market_report_listing: ['p_listing_id', 'p_reason'],
    market_admin_review_report: ['p_report_id', 'p_status'],
  }
  const ui = marketPage + moderationPage
  for (const [name, args] of Object.entries(expected)) {
    const call = ui.match(new RegExp(`\\.rpc\\('${name}',\\s*\\{([\\s\\S]*?)\\}\\)`))?.[1]
    assert.ok(call, `missing UI call ${name}`)
    assert.deepEqual([...call.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((item) => item[1]), args)
    for (const sql of name === 'market_admin_review_report' ? [migration, completion] : [migration]) {
      const signature = sql.match(new RegExp(`FUNCTION public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`))?.[1]
      assert.ok(signature, `missing SQL signature ${name}`)
      assert.deepEqual([...signature.matchAll(/\b(p_[a-z_]+)\s+(?:UUID|TEXT|NUMERIC)/g)].map((item) => item[1]), args)
    }
  }
})

test('[Static SQL Verification] migration includes preflight check for base schema, collision, and bucket verification', () => {
  assert.match(migration, /to_regclass\('public\.profiles'\) IS NULL/)
  assert.match(migration, /attname = 'id'/)
  assert.match(migration, /'market_listings', 'market_listing_reports'/)
  assert.match(migration, /Existing table public\.% conflicts with this first-install migration/)
  assert.match(migration, /'market_is_admin'/)
  assert.match(migration, /'market_create_listing'/)
  assert.match(migration, /'market_report_listing'/)
  assert.match(migration, /FROM pg_policies/)
  assert.match(migration, /Unexpected RLS policies exist on CampusMarket tables/)

  // Storage bucket collision check
  assert.match(migration, /WHERE id = 'campus-market' AND name <> 'campus-market'/)
  assert.match(migration, /An unrelated storage bucket with ID campus-market exists with a different name/)
})

test('[Static SQL Verification] tables and constraints enforce btrim, lengths, and valid enums', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.market_listings/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.market_listing_reports/)

  // Check btrim in constraints
  assert.match(migration, /char_length\(btrim\(title\)\) >= 3/)
  assert.match(migration, /char_length\(btrim\(description\)\) >= 10/)
  assert.match(migration, /char_length\(btrim\(reason\)\) >= 5/)

  // Price constraints (including free ₹0)
  assert.match(migration, /price\s+NUMERIC\(10, 2\)\s+NOT NULL\s+CHECK \(price >= 0 AND price <= 100000\)/)

  // Categories and Conditions
  assert.match(migration, /'Books', 'Electronics', 'Accessories', 'Hostel Essentials', 'Other'/)
  assert.match(migration, /'New', 'Like New', 'Good', 'Fair'/)

  // Max 3 images constraint
  assert.match(migration, /cardinality\(images\) <= 3/)

  // Zero bare trim() calls
  assert.equal(/(?<!b)trim\s*\(/.test(migration), false, 'No bare trim() calls should exist in migration')
})

test('[Static SQL Verification] admin authorization reuses public.admin_users and does not assume public.is_admin() exists', () => {
  const adminFn = migration.match(/CREATE OR REPLACE FUNCTION public\.market_is_admin[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(adminFn, 'public.market_is_admin function must be defined')
  assert.match(adminFn, /SECURITY DEFINER/, 'market_is_admin must be SECURITY DEFINER')
  assert.match(adminFn, /SET search_path = ''/, 'market_is_admin must set search_path = empty')
  assert.match(adminFn, /to_regprocedure\('public\.is_admin\(\)'\)/, 'market_is_admin checks public.is_admin() conditionally')
  assert.match(adminFn, /EXECUTE 'SELECT public\.is_admin\(\)'/, 'market_is_admin dynamically executes public.is_admin()')
  assert.match(adminFn, /to_regclass\('public\.admin_users'\)/, 'market_is_admin falls back to public.admin_users')
  assert.match(adminFn, /SELECT 1 FROM public\.admin_users WHERE user_id = \$1/, 'market_is_admin dynamically queries admin_users')

  // Granted to authenticated, revoked from PUBLIC
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.market_is_admin\(\) FROM PUBLIC;/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.market_is_admin\(\) TO authenticated;/)

  // Reports select policy uses market_is_admin()
  assert.match(migration, /public\.market_is_admin\(\)/)
  const reportsPolicy = migration.match(/CREATE POLICY "market_reports_select"[\s\S]*?;/)?.[0] || ''
  assert.ok(reportsPolicy, 'market_reports_select policy must exist')
  assert.match(reportsPolicy, /\(SELECT auth\.uid\(\)\) = reporter_id\s+OR public\.market_is_admin\(\)/)
})

test('[Static SQL Verification] storage bucket is configured as private with MIME-type, 5MB limits and folder RLS', () => {
  assert.match(migration, /'campus-market'/)
  assert.match(migration, /public = false|public,\s*file_size_limit[\s\S]*false,\s*-- Private bucket/i)
  assert.match(migration, /5242880/) // 5 MB
  assert.match(migration, /'image\/jpeg', 'image\/png', 'image\/webp', 'image\/gif'/)

  // Private storage policies on storage.objects
  assert.match(migration, /CREATE POLICY "campus_market_storage_select"[\s\S]*?TO authenticated\s+USING \(bucket_id = 'campus-market'\)/)
  assert.match(migration, /CREATE POLICY "campus_market_storage_insert"[\s\S]*?TO authenticated\s+WITH CHECK \(\s*bucket_id = 'campus-market'\s+AND \(storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)::text\)\s*\)/)
  assert.match(migration, /CREATE POLICY "campus_market_storage_update"[\s\S]*?TO authenticated\s+USING \(\s*bucket_id = 'campus-market'\s+AND \(storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)::text\)\s*\)/)
  assert.match(migration, /CREATE POLICY "campus_market_storage_delete"[\s\S]*?TO authenticated\s+USING \(\s*bucket_id = 'campus-market'\s+AND \(storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)::text\)\s*\)/)
})

test('[Static SQL Verification] RPCs strictly enforce image folder ownership, storage object existence and reject external/blob URLs', () => {
  const createFn = migration.match(/CREATE OR REPLACE FUNCTION public\.market_create_listing[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(createFn, 'market_create_listing must exist')
  assert.match(createFn, /v_img ~\* '\^blob:'/, 'create_listing rejects blob URLs')
  assert.match(createFn, /v_img ~\* '\^https\?:\/\/'/, 'create_listing rejects external HTTP/HTTPS URLs')
  assert.match(createFn, /v_img ~\* \('\^' \|\| v_uid::text \|\| '\/\[a-zA-Z0-9_\\-\\.]\+\$'\)/, 'create_listing enforces seller folder regex')
  assert.match(createFn, /to_regclass\('storage\.objects'\)/, 'create_listing checks storage.objects existence')
  assert.match(createFn, /WHERE bucket_id = 'campus-market'/, 'create_listing verifies campus-market bucket')
  assert.match(createFn, /\(storage\.foldername\(name\)\)\[1\] = v_uid::text/, 'create_listing verifies foldername ownership')

  const updateFn = migration.match(/CREATE OR REPLACE FUNCTION public\.market_update_listing[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(updateFn, 'market_update_listing must exist')
  assert.match(updateFn, /v_img ~\* '\^blob:'/, 'update_listing rejects blob URLs')
  assert.match(updateFn, /v_img ~\* '\^https\?:\/\/'/, 'update_listing rejects external HTTP/HTTPS URLs')
  assert.match(updateFn, /v_img ~\* \('\^' \|\| v_uid::text \|\| '\/\[a-zA-Z0-9_\\-\\.]\+\$'\)/, 'update_listing enforces seller folder regex')
  assert.match(updateFn, /to_regclass\('storage\.objects'\)/, 'update_listing checks storage.objects existence')
  assert.match(updateFn, /WHERE bucket_id = 'campus-market'/, 'update_listing verifies campus-market bucket')
  assert.match(updateFn, /\(storage\.foldername\(name\)\)\[1\] = v_uid::text/, 'update_listing verifies foldername ownership')
})

test('[Static SQL Verification] client writes are revoked and all mutations run through secure RPCs', () => {
  // Direct client writes revoked
  assert.match(
    migration,
    /REVOKE ALL ON public\.market_listings, public\.market_listing_reports\s+FROM PUBLIC, anon, authenticated;/
  )
  assert.match(
    migration,
    /GRANT SELECT ON public\.market_listings, public\.market_listing_reports\s+TO authenticated;/
  )

  const rpcs = [
    'market_create_listing',
    'market_update_listing',
    'market_toggle_status',
    'market_delete_listing',
    'market_report_listing',
    'market_admin_review_report',
  ]

  for (const rpc of rpcs) {
    const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}[\\s\\S]*?\\n\\$\\$;`)
    const fnDef = migration.match(fnRegex)?.[0]
    assert.ok(fnDef, `Function public.${rpc} must exist in migration`)
    assert.match(fnDef, /SECURITY DEFINER/, `${rpc} must be SECURITY DEFINER`)
    assert.match(fnDef, /SET search_path = ''/, `${rpc} must set empty search_path`)
    assert.match(fnDef, /v_uid := auth\.uid\(\);/, `${rpc} must derive caller identity from auth.uid()`)

    // Verify revoked from PUBLIC and granted to authenticated
    const grantRegex = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\b.*?TO authenticated;`)
    assert.match(migration, grantRegex, `${rpc} must be explicitly granted to authenticated`)
    const revokeRegex = new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${rpc}\\b.*?FROM PUBLIC;`)
    assert.match(migration, revokeRegex, `${rpc} must revoke execute from PUBLIC`)
  }

  // Delete listing allows seller OR admin
  const deleteFn = migration.match(/CREATE OR REPLACE FUNCTION public\.market_delete_listing[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(deleteFn, /v_listing\.seller_id <> v_uid AND NOT public\.market_is_admin\(\)/)
})

test('[Static SQL Verification] seller immutability guard prevents changing listing seller', () => {
  const guardDef = migration.match(/CREATE OR REPLACE FUNCTION public\.market_guard_seller[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(guardDef, 'market_guard_seller must be defined')
  assert.match(guardDef, /OLD\.seller_id <> NEW\.seller_id/)
  assert.match(guardDef, /Listing seller cannot be changed/)
})
