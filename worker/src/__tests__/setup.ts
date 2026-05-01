import { mock } from 'bun:test'

// ─── Chainable Supabase query builder mock ────────────────────────────────────
// Mirrors the Supabase JS fluent API so pipeline steps can be tested without a DB.

export type MockResult = { data: unknown; error: null; count?: number }

export function createChain(result: MockResult) {
  const chain: Record<string, unknown> = {}

  const filterMethods = [
    'eq','neq','in','is','lt','lte','gt','gte','ilike','order','limit','range','maybeSingle',
  ]

  for (const m of filterMethods) {
    chain[m] = mock(() => chain)
  }

  // Thenable — resolves when awaited directly
  chain.then = (resolve: (v: MockResult) => unknown) => Promise.resolve(result).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject)

  chain.single = mock(() => Promise.resolve(result))
  chain.maybeSingle = mock(() => Promise.resolve(result))

  return chain
}

export function createSupabaseMock(defaults: {
  selectResult?: MockResult
  insertResult?: MockResult
  updateResult?: MockResult
  upsertResult?: MockResult
  rpcResult?: MockResult
  storageDownload?: { data: Blob | null; error: null }
} = {}) {
  const sel = defaults.selectResult ?? { data: null, error: null }
  const ins = defaults.insertResult ?? { data: { id: 'test-uuid' }, error: null }
  const upd = defaults.updateResult ?? { data: null, error: null }
  const ups = defaults.upsertResult ?? { data: null, error: null }

  // Stable object — same reference returned on every from() call so assertions work.
  const _table = {
    select: mock(() => createChain(sel)),
    insert: mock(() => createChain(ins)),
    update: mock(() => createChain(upd)),
    upsert: mock(() => createChain(ups)),
    delete: mock(() => createChain({ data: null, error: null })),
  }

  return {
    from: mock(() => _table),
    _table,
    rpc: mock(() => Promise.resolve(defaults.rpcResult ?? { data: [], error: null })),
    storage: {
      from: mock(() => ({
        download: mock(() => Promise.resolve(defaults.storageDownload ?? { data: null, error: null })),
        upload: mock(() => Promise.resolve({ data: {}, error: null })),
        createSignedUploadUrl: mock(() =>
          Promise.resolve({ data: { signedUrl: 'https://storage.example.com/upload' }, error: null })
        ),
      })),
    },
    channel: mock(() => ({
      on: mock(() => ({ subscribe: mock(() => {}) })),
    })),
    auth: {
      getUser: mock(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  }
}

export const VALID_REPORT_BODY = {
  text_description: 'Taxikář mě ohodnotil 3x více než mělo stát na letišti Praha.',
  location: 'Letiště Praha',
  business_name: 'AAA Taxi',
}

export const SPAM_TEXT = 'KUPTE SI VIAGRA LEVNĚ klikněte ZDE!!! AKCE!!!'
export const LEGIT_CZECH_TIP = 'Směnárna na Václavském náměstí mi dala špatný kurz a vzala poplatek navíc.'
