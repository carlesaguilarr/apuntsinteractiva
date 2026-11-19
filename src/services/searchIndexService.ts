import type { VaultCatalog, VaultNoteItem } from '../types/vault'
import { slugify, stripFrontmatter, stripObsidianComments } from './vaultService'

export interface IndexedSection {
  id: string
  heading: string
  level: number
  text: string
  normalized: string
}

export interface IndexedNoteRecord {
  path: string
  sha: string
  plainText: string
  normalizedText: string
  sections: IndexedSection[]
  indexedAt: number
}

export interface SearchSnippetPart {
  text: string
  match: boolean
}

export interface FullTextSearchHit {
  note: VaultNoteItem
  score: number
  matchSource: 'title' | 'heading' | 'content' | 'subject'
  matchedHeading?: { id: string; text: string }
  snippetParts?: SearchSnippetPart[]
}

export interface SearchIndexProgress {
  indexedCount: number
  totalCount: number
  indexing: boolean
  error: string | null
}

const DB_NAME = 'apunts_search_index_v1'
const DB_VERSION = 1
const STORE_NAME = 'notes'
const NOTE_SESSION_CACHE_PREFIX = 'apunts_vault_note_v1_'
const FETCH_CONCURRENCY = 6

const memoryIndex = new Map<string, IndexedNoteRecord>()
let dbLoaded = false
let dbLoadPromise: Promise<void> | null = null
let activeIndexRun: Promise<void> | null = null
let activeCatalogSignature = ''

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function cleanMarkdownLineToPlainText(line: string): string {
  return line
    .replace(/^(\s*)>\s*\[![a-zA-Z0-9_-]+\][+-]?\s*/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/!\[\[([^\]]+)\]\]/g, (_, inner: string) => {
      const parts = inner.split('|')
      const candidate = parts.length > 1 && !/^\d+(x\d+)?$/i.test(parts[1].trim())
        ? parts[1].trim()
        : ''
      return candidate
    })
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[#([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]#]+)#([^\]]+)\]\]/g, '$1 $2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$([^$]+)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildIndexedNoteRecord(
  note: VaultNoteItem,
  rawMarkdown: string,
): IndexedNoteRecord {
  const withoutFrontmatter = stripFrontmatter(rawMarkdown)
  const withoutComments = stripObsidianComments(withoutFrontmatter)
  const lines = withoutComments.split(/\r?\n/)

  const sections: IndexedSection[] = []
  const usedIds = new Map<string, number>()

  let currentHeading = ''
  let currentId = ''
  let currentLevel = 0
  let currentLines: string[] = []
  let inCodeFence = false
  let headingCounter = 0

  const flushSection = () => {
    const joined = currentLines.join(' ').replace(/\s+/g, ' ').trim()
    if (!currentHeading && !joined) return
    const combinedForNorm = currentHeading ? `${currentHeading} ${joined}` : joined
    sections.push({
      id: currentId,
      heading: currentHeading,
      level: currentLevel,
      text: joined,
      normalized: normalizeSearchText(combinedForNorm),
    })
  }

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }

    if (!inCodeFence) {
      const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
      if (headingMatch) {
        flushSection()
        headingCounter += 1

        const level = headingMatch[1].length
        const headingText = headingMatch[2]
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
          .replace(/\[\[#([^\]]+)\]\]/g, '$1')
          .replace(/\[\[([^\]#]+)#([^\]]+)\]\]/g, '$1 › $2')
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/==([^=]+)==/g, '$1')
          .replace(/[*_`~]/g, '')
          .trim()

        let baseId = slugify(headingText) || `seccio-${headingCounter}`
        const count = usedIds.get(baseId) ?? 0
        usedIds.set(baseId, count + 1)
        if (count > 0) {
          baseId = `${baseId}-${count + 1}`
        }

        currentHeading = headingText
        currentId = baseId
        currentLevel = level
        currentLines = []
        continue
      }

      const cleaned = cleanMarkdownLineToPlainText(line)
      if (cleaned) {
        currentLines.push(cleaned)
      }
    } else {
      const trimmedCode = line.trim()
      if (trimmedCode) {
        currentLines.push(trimmedCode)
      }
    }
  }

  flushSection()

  const plainText = sections
    .map((s) => (s.heading ? `${s.heading}. ${s.text}` : s.text))
    .join('\n')
    .trim()

  return {
    path: note.path,
    sha: note.id,
    plainText,
    normalizedText: normalizeSearchText(plainText),
    sections,
    indexedAt: Date.now(),
  }
}

function openIndexDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'path' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function ensureDbLoaded(): Promise<void> {
  if (dbLoaded) return
  if (dbLoadPromise) return dbLoadPromise

  dbLoadPromise = (async () => {
    const db = await openIndexDb()
    if (!db) {
      dbLoaded = true
      return
    }
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const getAllReq = store.getAll()
        getAllReq.onsuccess = () => {
          const rows = (getAllReq.result as IndexedNoteRecord[]) ?? []
          for (const row of rows) {
            if (row?.path) {
              memoryIndex.set(row.path, row)
            }
          }
          resolve()
        }
        getAllReq.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
    db.close()
    dbLoaded = true
  })()

  return dbLoadPromise
}

async function persistRecords(records: IndexedNoteRecord[]): Promise<void> {
  if (records.length === 0) return
  const db = await openIndexDb()
  if (!db) return

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      for (const rec of records) {
        store.put(rec)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

async function pruneStaleRecords(validPaths: Set<string>): Promise<void> {
  const toDelete: string[] = []
  for (const key of memoryIndex.keys()) {
    if (!validPaths.has(key)) {
      memoryIndex.delete(key)
      toDelete.push(key)
    }
  }
  if (toDelete.length === 0) return

  const db = await openIndexDb()
  if (!db) return

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      for (const key of toDelete) {
        store.delete(key)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

export function indexSingleRawNote(note: VaultNoteItem, rawMarkdown: string): void {
  if (note.extension !== 'md') return
  const record = buildIndexedNoteRecord(note, rawMarkdown)
  memoryIndex.set(note.path, record)
  void persistRecords([record])
}

export function getIndexCounts(catalog: VaultCatalog | null): {
  indexedCount: number
  totalCount: number
} {
  if (!catalog) return { indexedCount: 0, totalCount: 0 }
  const mdNotes = catalog.allNotes.filter((n) => n.extension === 'md')
  let indexedCount = 0
  for (const note of mdNotes) {
    if (memoryIndex.get(note.path)?.sha === note.id) {
      indexedCount += 1
    }
  }
  return { indexedCount, totalCount: mdNotes.length }
}

export async function ensureFullTextIndex(
  catalog: VaultCatalog,
  onProgress?: (progress: SearchIndexProgress) => void,
  forceReindex = false,
): Promise<void> {
  await ensureDbLoaded()

  const mdNotes = catalog.allNotes.filter((n) => n.extension === 'md')
  const validPaths = new Set(mdNotes.map((n) => n.path))
  const signature = `${catalog.commitSha ?? ''}:${catalog.fetchedAt}:${mdNotes.length}:${forceReindex ? 'force' : 'normal'}`

  if (forceReindex) {
    memoryIndex.clear()
  }
  void pruneStaleRecords(validPaths)

  // Reutilitzem qualsevol apunt que ja estigui a la caché de sessió només si coincideix el SHA i no es força reindexació
  if (!forceReindex) {
    const hydratedFromSession: IndexedNoteRecord[] = []
    for (const note of mdNotes) {
      if (memoryIndex.get(note.path)?.sha === note.id) continue
      try {
        const cachedRaw = sessionStorage.getItem(`${NOTE_SESSION_CACHE_PREFIX}${note.path}`)
        if (!cachedRaw) continue
        const parsed = JSON.parse(cachedRaw) as { rawMarkdown?: string; sha?: string }
        if (parsed.rawMarkdown && parsed.sha === note.id) {
          const rec = buildIndexedNoteRecord(note, parsed.rawMarkdown)
          memoryIndex.set(note.path, rec)
          hydratedFromSession.push(rec)
        }
      } catch {
        // ignora caché de sessió invàlida
      }
    }
    if (hydratedFromSession.length > 0) {
      void persistRecords(hydratedFromSession)
    }
  }

  const pendingNotes = mdNotes.filter(
    (note) => forceReindex || memoryIndex.get(note.path)?.sha !== note.id,
  )

  const report = (indexing: boolean, error: string | null = null) => {
    const { indexedCount, totalCount } = getIndexCounts(catalog)
    onProgress?.({ indexedCount, totalCount, indexing, error })
  }

  if (pendingNotes.length === 0) {
    report(false, null)
    return
  }

  if (activeIndexRun && activeCatalogSignature === signature) {
    report(true, null)
    await activeIndexRun
    report(false, null)
    return
  }

  activeCatalogSignature = signature
  report(true, null)

  let failedCount = 0

  activeIndexRun = (async () => {
    let cursor = 0
    const batchBuffer: IndexedNoteRecord[] = []

    const flushBuffer = async () => {
      if (batchBuffer.length === 0) return
      const copy = batchBuffer.splice(0, batchBuffer.length)
      await persistRecords(copy)
    }

    const worker = async () => {
      while (cursor < pendingNotes.length) {
        const idx = cursor
        cursor += 1
        const note = pendingNotes[idx]
        try {
          let targetUrl = note.rawUrl
          if (!catalog.commitSha) {
            const params = new URLSearchParams({ sha: note.id })
            if (forceReindex) params.set('t', String(Date.now()))
            targetUrl = `${note.rawUrl}?${params.toString()}`
          } else if (forceReindex) {
            targetUrl = `${note.rawUrl}?t=${Date.now()}`
          }
          const res = await fetch(targetUrl, {
            cache: forceReindex ? 'no-store' : 'default',
          })
          if (!res.ok) {
            failedCount += 1
            continue
          }
          const rawMarkdown = await res.text()
          const rec = buildIndexedNoteRecord(note, rawMarkdown)
          memoryIndex.set(note.path, rec)
          batchBuffer.push(rec)

          if (batchBuffer.length >= FETCH_CONCURRENCY) {
            await flushBuffer()
          }
          report(true, null)
        } catch {
          failedCount += 1
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(FETCH_CONCURRENCY, pendingNotes.length) },
      () => worker(),
    )
    await Promise.all(workers)
    await flushBuffer()
  })()

  try {
    await activeIndexRun
  } finally {
    activeIndexRun = null
    report(
      false,
      failedCount > 0 && failedCount === pendingNotes.length
        ? 'No s’ha pogut descarregar el contingut per a la cerca completa.'
        : null,
    )
  }
}

function buildNormalizedIndexMap(text: string): {
  normalized: string
  origStarts: number[]
  origEnds: number[]
} {
  let normalized = ''
  const origStarts: number[] = []
  const origEnds: number[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const normCh = ch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    for (let k = 0; k < normCh.length; k++) {
      normalized += normCh[k]
      origStarts.push(i)
      origEnds.push(i + 1)
    }
  }

  return { normalized, origStarts, origEnds }
}

function buildSnippetParts(
  sourceText: string,
  normalizedPhrase: string,
  normalizedTokens: string[],
): SearchSnippetPart[] {
  const clean = sourceText.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const { normalized, origStarts } = buildNormalizedIndexMap(clean)

  let anchorNormIdx = normalized.indexOf(normalizedPhrase)
  if (anchorNormIdx === -1) {
    for (const token of normalizedTokens) {
      const idx = normalized.indexOf(token)
      if (idx !== -1 && (anchorNormIdx === -1 || idx < anchorNormIdx)) {
        anchorNormIdx = idx
      }
    }
  }

  const anchorOrig =
    anchorNormIdx >= 0 && anchorNormIdx < origStarts.length ? origStarts[anchorNormIdx] : 0

  const windowBefore = 52
  const windowAfter = 120
  let sliceStart = Math.max(0, anchorOrig - windowBefore)
  let sliceEnd = Math.min(clean.length, anchorOrig + windowAfter)

  if (sliceStart > 0) {
    const nextSpace = clean.indexOf(' ', sliceStart)
    if (nextSpace !== -1 && nextSpace < anchorOrig) {
      sliceStart = nextSpace + 1
    }
  }
  if (sliceEnd < clean.length) {
    const lastSpace = clean.lastIndexOf(' ', sliceEnd)
    if (lastSpace > anchorOrig + 10) {
      sliceEnd = lastSpace
    }
  }

  const excerpt = clean.slice(sliceStart, sliceEnd)
  const excerptMap = buildNormalizedIndexMap(excerpt)

  const ranges: Array<[number, number]> = []
  const searchTerms = Array.from(
    new Set([normalizedPhrase, ...normalizedTokens].filter((t) => t.length >= 2)),
  ).sort((a, b) => b.length - a.length)

  for (const term of searchTerms) {
    let from = 0
    while (from < excerptMap.normalized.length) {
      const hit = excerptMap.normalized.indexOf(term, from)
      if (hit === -1) break
      const origStart = excerptMap.origStarts[hit]
      const origEnd = excerptMap.origEnds[hit + term.length - 1]
      if (origStart !== undefined && origEnd !== undefined) {
        ranges.push([origStart, origEnd])
      }
      from = hit + term.length
    }
  }

  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged: Array<[number, number]> = []
  for (const [start, end] of ranges) {
    const prev = merged[merged.length - 1]
    if (!prev || start > prev[1]) {
      merged.push([start, end])
    } else if (end > prev[1]) {
      prev[1] = end
    }
  }

  const parts: SearchSnippetPart[] = []
  if (sliceStart > 0) {
    parts.push({ text: '…', match: false })
  }

  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) {
      parts.push({ text: excerpt.slice(cursor, start), match: false })
    }
    parts.push({ text: excerpt.slice(start, end), match: true })
    cursor = end
  }

  if (cursor < excerpt.length) {
    parts.push({ text: excerpt.slice(cursor), match: false })
  }
  if (sliceEnd < clean.length) {
    parts.push({ text: '…', match: false })
  }

  return parts
}

export function searchFullTextCatalog(
  catalog: VaultCatalog,
  rawQuery: string,
  options?: {
    subjectName?: string
    limit?: number
  },
): FullTextSearchHit[] {
  const limit = options?.limit ?? 24
  const subjectFilter = options?.subjectName && options.subjectName !== 'totes'
    ? options.subjectName
    : null

  const pool = subjectFilter
    ? catalog.allNotes.filter((n) => n.subjectName === subjectFilter)
    : catalog.allNotes

  const normalizedPhrase = normalizeSearchText(rawQuery.trim())
  if (!normalizedPhrase) {
    return pool.slice(0, 12).map((note) => ({
      note,
      score: 0,
      matchSource: 'title',
    }))
  }

  const tokens = normalizedPhrase.split(/\s+/).filter(Boolean)
  const hits: FullTextSearchHit[] = []

  for (const note of pool) {
    const normTitle = normalizeSearchText(note.title)
    const normSubject = normalizeSearchText(note.subjectName)
    const normPath = normalizeSearchText(note.path)
    const indexed = memoryIndex.get(note.path)

    let score = 0
    let matchSource: FullTextSearchHit['matchSource'] = 'title'
    let matchedHeading: { id: string; text: string } | undefined
    let bestSnippetText: string | undefined

    const allInMeta = tokens.every(
      (t) => normTitle.includes(t) || normSubject.includes(t) || normPath.includes(t),
    )

    if (normTitle === normalizedPhrase) {
      score += 140
      matchSource = 'title'
    } else if (normTitle.startsWith(normalizedPhrase)) {
      score += 110
      matchSource = 'title'
    } else if (normTitle.includes(normalizedPhrase)) {
      score += 88
      matchSource = 'title'
    } else if (tokens.every((t) => normTitle.includes(t))) {
      score += 70
      matchSource = 'title'
    } else if (allInMeta) {
      score += 45
      matchSource = 'subject'
    }

    if (indexed) {
      let bestSectionScore = 0
      let bestSection: IndexedSection | null = null
      let bestSectionIsHeading = false

      for (const section of indexed.sections) {
        const normHeading = normalizeSearchText(section.heading)
        let secScore = 0
        let isHeadingHit = false

        if (normHeading && normHeading.includes(normalizedPhrase)) {
          secScore = 76
          isHeadingHit = true
        } else if (normHeading && tokens.every((t) => normHeading.includes(t))) {
          secScore = 58
          isHeadingHit = true
        } else if (section.normalized.includes(normalizedPhrase)) {
          secScore = 44
        } else if (tokens.every((t) => section.normalized.includes(t))) {
          secScore = 30
        }

        if (secScore > bestSectionScore) {
          bestSectionScore = secScore
          bestSection = section
          bestSectionIsHeading = isHeadingHit
        }
      }

      if (bestSection && bestSectionScore > 0) {
        score += bestSectionScore
        if (bestSection.id && bestSection.heading) {
          matchedHeading = { id: bestSection.id, text: bestSection.heading }
        }
        const bodyHasMatch =
          bestSection.text.length > 0 &&
          tokens.some((t) => normalizeSearchText(bestSection.text).includes(t))
        const candidateSnippet =
          bestSectionIsHeading && !bodyHasMatch
            ? bestSection.text
              ? `${bestSection.heading} — ${bestSection.text}`
              : bestSection.heading
            : bestSection.text || bestSection.heading

        if (score === bestSectionScore || bestSectionScore >= 44) {
          if (score === bestSectionScore) {
            matchSource = bestSectionIsHeading ? 'heading' : 'content'
          }
          bestSnippetText = candidateSnippet
        } else if (candidateSnippet) {
          bestSnippetText = candidateSnippet
        }
      } else if (tokens.every((t) => indexed.normalizedText.includes(t))) {
        score += 18
        if (score === 18) {
          matchSource = 'content'
        }
        bestSnippetText = indexed.plainText
      }
    }

    if (score > 0) {
      hits.push({
        note,
        score,
        matchSource,
        matchedHeading,
        snippetParts: bestSnippetText
          ? buildSnippetParts(bestSnippetText, normalizedPhrase, tokens)
          : undefined,
      })
    }
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.note.title.localeCompare(b.note.title, 'ca', { numeric: true })
  })

  return hits.slice(0, limit)
}
