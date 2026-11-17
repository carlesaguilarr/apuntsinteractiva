import type {
  GitHubTreeNode,
  LoadedNote,
  MarkdownHeading,
  SubjectMetadata,
  VaultCatalog,
  VaultFolderNode,
  VaultNoteItem,
  VaultSubject,
} from '../types/vault'

export const VAULT_OWNER = 'carlesaguilarr'
export const VAULT_REPO = 'Vault'
export const VAULT_BRANCH = 'main'

const TREE_CACHE_KEY = 'apunts_vault_tree_v2'
const NOTE_CACHE_PREFIX = 'apunts_vault_note_v1_'
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minuts

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const ASSET_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'pdf',
  'mp4',
  'webm',
  'mp3',
  'wav',
])

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function encodeGitHubPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function getRawFileUrl(path: string): string {
  return `https://raw.githubusercontent.com/${VAULT_OWNER}/${VAULT_REPO}/${VAULT_BRANCH}/${encodeGitHubPath(path)}`
}

export function getGitHubBlobUrl(path: string): string {
  return `https://github.com/${VAULT_OWNER}/${VAULT_REPO}/blob/${VAULT_BRANCH}/${encodeGitHubPath(path)}`
}

function shouldIgnorePath(path: string): boolean {
  const parts = path.split('/')
  return parts.some((part) => part.startsWith('.') || part.startsWith('_'))
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) return ''
  return filename.slice(idx + 1).toLowerCase()
}

function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) return filename
  return filename.slice(0, idx)
}

function isDraftNote(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.includes('placeholder') || lower.includes('falta rehacer') || lower.includes('esborrany')
}

function sortNodesNaturally<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, 'ca', { numeric: true, sensitivity: 'base' }),
  )
}

function buildFolderTree(
  subjectName: string,
  subjectPath: string,
  notes: VaultNoteItem[],
): VaultFolderNode {
  const root: VaultFolderNode = {
    name: subjectName,
    path: subjectPath,
    slug: slugify(subjectPath),
    notes: [],
    subfolders: [],
    totalNotes: 0,
  }

  for (const note of notes) {
    // folderSegments are segments strictly between subject root and file name
    let current = root
    let currentPath = subjectPath

    for (const seg of note.folderSegments) {
      currentPath = `${currentPath}/${seg}`
      let next = current.subfolders.find((f) => f.name === seg)
      if (!next) {
        next = {
          name: seg,
          path: currentPath,
          slug: slugify(currentPath),
          notes: [],
          subfolders: [],
          totalNotes: 0,
        }
        current.subfolders.push(next)
      }
      current = next
    }
    current.notes.push(note)
  }

  const finalize = (folder: VaultFolderNode): number => {
    folder.notes = sortNodesNaturally(folder.notes)
    folder.subfolders = sortNodesNaturally(folder.subfolders)
    let count = folder.notes.length
    for (const sub of folder.subfolders) {
      count += finalize(sub)
    }
    folder.totalNotes = count
    return count
  }

  finalize(root)
  return root
}

const COURSE_LABELS: Record<string, { label: string; rank: number }> = {
  primer: { label: 'Primer curs', rank: 1 },
  '1': { label: 'Primer curs', rank: 1 },
  '1r': { label: 'Primer curs', rank: 1 },
  '1r curs': { label: 'Primer curs', rank: 1 },
  'primer curs': { label: 'Primer curs', rank: 1 },
  segon: { label: 'Segon curs', rank: 2 },
  '2': { label: 'Segon curs', rank: 2 },
  '2n': { label: 'Segon curs', rank: 2 },
  '2n curs': { label: 'Segon curs', rank: 2 },
  'segon curs': { label: 'Segon curs', rank: 2 },
  tercer: { label: 'Tercer curs', rank: 3 },
  '3': { label: 'Tercer curs', rank: 3 },
  '3r': { label: 'Tercer curs', rank: 3 },
  '3r curs': { label: 'Tercer curs', rank: 3 },
  'tercer curs': { label: 'Tercer curs', rank: 3 },
  quart: { label: 'Quart curs', rank: 4 },
  '4': { label: 'Quart curs', rank: 4 },
  '4t': { label: 'Quart curs', rank: 4 },
  '4t curs': { label: 'Quart curs', rank: 4 },
  'quart curs': { label: 'Quart curs', rank: 4 },
}

const SEMESTER_LABELS: Record<string, { label: string; rank: number }> = {
  primer: { label: 'Primer semestre', rank: 1 },
  '1': { label: 'Primer semestre', rank: 1 },
  '1r': { label: 'Primer semestre', rank: 1 },
  '1r semestre': { label: 'Primer semestre', rank: 1 },
  'primer semestre': { label: 'Primer semestre', rank: 1 },
  segon: { label: 'Segon semestre', rank: 2 },
  '2': { label: 'Segon semestre', rank: 2 },
  '2n': { label: 'Segon semestre', rank: 2 },
  '2n semestre': { label: 'Segon semestre', rank: 2 },
  'segon semestre': { label: 'Segon semestre', rank: 2 },
  anual: { label: 'Anual', rank: 3 },
}

const TAG_LABELS: Record<string, string> = {
  obligatoria: 'Obligatòria',
  obligatòria: 'Obligatòria',
  optativa: 'Optativa',
  basica: 'Formació bàsica',
  bàsica: 'Formació bàsica',
  troncal: 'Troncal',
  practiques: 'Pràctiques',
  pràctiques: 'Pràctiques',
  tfg: 'TFG',
}

function capitalizeWord(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function formatCourseLabel(curs?: string): string | null {
  if (!curs?.trim()) return null
  const key = curs.trim().toLowerCase()
  return COURSE_LABELS[key]?.label ?? capitalizeWord(curs)
}

export function formatSemesterLabel(semestre?: string): string | null {
  if (!semestre?.trim()) return null
  const key = semestre.trim().toLowerCase()
  return SEMESTER_LABELS[key]?.label ?? capitalizeWord(semestre)
}

export function formatCourseSemesterLabel(meta?: SubjectMetadata): string | null {
  const curs = formatCourseLabel(meta?.curs)
  const semestre = formatSemesterLabel(meta?.semestre)
  if (curs && semestre) return `${curs} · ${semestre}`
  return curs || semestre || null
}

export function formatTagLabel(tag: string): string {
  const key = tag.trim().toLowerCase()
  return TAG_LABELS[key] ?? capitalizeWord(tag.replace(/-/g, ' '))
}

function getCourseRank(curs?: string): number {
  if (!curs?.trim()) return 99
  return COURSE_LABELS[curs.trim().toLowerCase()]?.rank ?? 50
}

function getSemesterRank(semestre?: string): number {
  if (!semestre?.trim()) return 99
  return SEMESTER_LABELS[semestre.trim().toLowerCase()]?.rank ?? 50
}

export interface SemesterGroup {
  label: string
  rank: number
  subjects: VaultSubject[]
}

export interface CourseGroup {
  label: string
  rank: number
  semesters: SemesterGroup[]
}

export function groupSubjectsByCurriculum(subjects: VaultSubject[]): CourseGroup[] {
  const courseMap = new Map<string, { rank: number; semMap: Map<string, SemesterGroup> }>()

  for (const subject of subjects) {
    const courseLabel = formatCourseLabel(subject.meta?.curs) ?? 'Altres assignatures'
    const courseRank = getCourseRank(subject.meta?.curs)
    const semLabel = formatSemesterLabel(subject.meta?.semestre) ?? 'General'
    const semRank = getSemesterRank(subject.meta?.semestre)

    let courseEntry = courseMap.get(courseLabel)
    if (!courseEntry) {
      courseEntry = { rank: courseRank, semMap: new Map() }
      courseMap.set(courseLabel, courseEntry)
    }

    let semEntry = courseEntry.semMap.get(semLabel)
    if (!semEntry) {
      semEntry = { label: semLabel, rank: semRank, subjects: [] }
      courseEntry.semMap.set(semLabel, semEntry)
    }

    semEntry.subjects.push(subject)
  }

  return Array.from(courseMap.entries())
    .map(([label, data]) => ({
      label,
      rank: data.rank,
      semesters: Array.from(data.semMap.values()).sort((a, b) => a.rank - b.rank),
    }))
    .sort((a, b) => a.rank - b.rank)
}

function unquoteYaml(val: string): string {
  const trimmed = val.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function parseSubjectMeta(markdown: string): SubjectMetadata {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { tags: [] }

  const lines = match[1].split(/\r?\n/)
  const meta: SubjectMetadata = { tags: [] }
  let currentArrayKey: string | null = null

  for (const rawLine of lines) {
    const listMatch = rawLine.match(/^\s*-\s+(.+)$/)
    if (listMatch && currentArrayKey === 'tags') {
      const tag = unquoteYaml(listMatch[1])
      if (tag) meta.tags.push(tag)
      continue
    }

    const kvMatch = rawLine.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
    if (!kvMatch) {
      currentArrayKey = null
      continue
    }

    const key = kvMatch[1].trim().toLowerCase()
    const rawVal = kvMatch[2].trim()

    if (key === 'tags') {
      if (!rawVal) {
        currentArrayKey = 'tags'
      } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        currentArrayKey = null
        const items = rawVal
          .slice(1, -1)
          .split(',')
          .map((s) => unquoteYaml(s))
          .filter(Boolean)
        meta.tags.push(...items)
      } else {
        currentArrayKey = null
        const single = unquoteYaml(rawVal)
        if (single) meta.tags.push(single)
      }
      continue
    }

    currentArrayKey = null
    const val = unquoteYaml(rawVal)
    if (!val) continue

    if (key === 'curs') meta.curs = val
    else if (key === 'semestre') meta.semestre = val
    else if (key === 'descripcio' || key === 'descripció') meta.descripcio = val
    else if (key === 'ordre') {
      const parsed = Number(val)
      if (!Number.isNaN(parsed)) meta.ordre = parsed
    }
  }

  return meta
}

async function fetchSubjectsMetadata(
  tree: GitHubTreeNode[],
): Promise<Record<string, SubjectMetadata>> {
  const metaNodes = tree.filter((node) => {
    if (node.type !== 'blob') return false
    const parts = node.path.split('/')
    return (
      parts.length === 2 &&
      !parts[0].startsWith('.') &&
      !parts[0].startsWith('_') &&
      parts[1].toLowerCase() === '_meta.md'
    )
  })

  if (metaNodes.length === 0) return {}

  const entries = await Promise.all(
    metaNodes.map(async (node) => {
      const subjectName = node.path.split('/')[0]
      try {
        const res = await fetch(getRawFileUrl(node.path))
        if (!res.ok) return null
        const text = await res.text()
        return [subjectName, parseSubjectMeta(text)] as const
      } catch {
        return null
      }
    }),
  )

  const result: Record<string, SubjectMetadata> = {}
  for (const entry of entries) {
    if (entry) {
      result[entry[0]] = entry[1]
    }
  }
  return result
}

export function buildCatalogFromTree(
  tree: GitHubTreeNode[],
  fetchedAt: string,
  fromCache: boolean,
  rateLimited = false,
  metaBySubject: Record<string, SubjectMetadata> = {},
): VaultCatalog {
  const allNotes: VaultNoteItem[] = []
  const allAssets: VaultNoteItem[] = []
  let readmeNote: VaultNoteItem | null = null

  const subjectMap = new Map<string, VaultNoteItem[]>()

  for (const node of tree) {
    if (node.type !== 'blob') continue
    if (shouldIgnorePath(node.path)) continue

    const segments = node.path.split('/')
    const fileName = segments[segments.length - 1]
    const ext = getExtension(fileName)

    const isMarkdown = ext === 'md'
    const isAsset = ASSET_EXTENSIONS.has(ext)
    if (!isMarkdown && !isAsset) continue

    const isRootFile = segments.length === 1
    const subjectName = isRootFile ? 'General' : segments[0]
    const subjectSlug = slugify(subjectName)
    const folderSegments = isRootFile ? [] : segments.slice(1, -1)

    const item: VaultNoteItem = {
      id: node.sha || node.path,
      path: node.path,
      slug: encodeURIComponent(node.path),
      name: fileName,
      title: stripExtension(fileName),
      extension: ext,
      subjectName,
      subjectSlug,
      folderSegments,
      isDraft: isDraftNote(fileName),
      isAsset,
      rawUrl: getRawFileUrl(node.path),
      githubUrl: getGitHubBlobUrl(node.path),
    }

    if (isRootFile && fileName.toLowerCase() === 'readme.md') {
      readmeNote = item
      continue
    }

    if (isAsset) {
      allAssets.push(item)
      // Si és un PDF dins una assignatura, també el mostrem com a material consultable
      if (ext !== 'pdf' || isRootFile) {
        continue
      }
    }

    allNotes.push(item)
    const existing = subjectMap.get(subjectName) ?? []
    existing.push(item)
    subjectMap.set(subjectName, existing)
  }

  const sortedSubjectNames = Array.from(subjectMap.keys()).sort((a, b) => {
    const metaA = metaBySubject[a]
    const metaB = metaBySubject[b]
    const courseDiff = getCourseRank(metaA?.curs) - getCourseRank(metaB?.curs)
    if (courseDiff !== 0) return courseDiff
    const semDiff = getSemesterRank(metaA?.semestre) - getSemesterRank(metaB?.semestre)
    if (semDiff !== 0) return semDiff
    const orderDiff = (metaA?.ordre ?? 999) - (metaB?.ordre ?? 999)
    if (orderDiff !== 0) return orderDiff
    return a.localeCompare(b, 'ca', { numeric: true, sensitivity: 'base' })
  })

  const subjects: VaultSubject[] = sortedSubjectNames.map((name, index) => {
    const notes = sortNodesNaturally(subjectMap.get(name) ?? [])
    return {
      name,
      slug: slugify(name),
      romanNumeral: ROMAN_NUMERALS[index] ?? String(index + 1),
      path: name,
      totalNotes: notes.length,
      draftNotes: notes.filter((n) => n.isDraft).length,
      rootFolder: buildFolderTree(name, name, notes),
      allNotes: notes,
      meta: metaBySubject[name],
    }
  })

  return {
    subjects,
    allNotes: sortNodesNaturally(allNotes),
    allAssets,
    readmeNote,
    fetchedAt,
    fromCache,
    rateLimited,
  }
}

interface CachedTreePayload {
  tree: GitHubTreeNode[]
  metaBySubject: Record<string, SubjectMetadata>
  fetchedAt: string
  timestamp: number
}

export async function fetchVaultCatalog(forceRefresh = false): Promise<VaultCatalog> {
  const cachedRaw = sessionStorage.getItem(TREE_CACHE_KEY) || localStorage.getItem(TREE_CACHE_KEY)
  let cached: CachedTreePayload | null = null

  if (cachedRaw) {
    try {
      cached = JSON.parse(cachedRaw) as CachedTreePayload
    } catch {
      cached = null
    }
  }

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return buildCatalogFromTree(
      cached.tree,
      cached.fetchedAt,
      true,
      false,
      cached.metaBySubject ?? {},
    )
  }

  const url = `https://api.github.com/repos/${VAULT_OWNER}/${VAULT_REPO}/git/trees/${VAULT_BRANCH}?recursive=1`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      if (cached) {
        return buildCatalogFromTree(
          cached.tree,
          cached.fetchedAt,
          true,
          response.status === 403,
          cached.metaBySubject ?? {},
        )
      }
      throw new Error(
        response.status === 403
          ? 'S’ha assolit temporalment el límit de consultes de GitHub.'
          : `No s’ha pogut connectar amb el repositori (Error ${response.status}).`,
      )
    }

    const data = (await response.json()) as { tree?: GitHubTreeNode[] }
    const tree = data.tree ?? []
    const metaBySubject = await fetchSubjectsMetadata(tree)
    const nowIso = new Date().toISOString()
    const payload: CachedTreePayload = {
      tree,
      metaBySubject,
      fetchedAt: nowIso,
      timestamp: Date.now(),
    }

    const serialized = JSON.stringify(payload)
    sessionStorage.setItem(TREE_CACHE_KEY, serialized)
    localStorage.setItem(TREE_CACHE_KEY, serialized)

    return buildCatalogFromTree(tree, nowIso, false, false, metaBySubject)
  } catch (err) {
    if (cached) {
      return buildCatalogFromTree(
        cached.tree,
        cached.fetchedAt,
        true,
        true,
        cached.metaBySubject ?? {},
      )
    }
    throw err
  }
}

export function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!match) return markdown
  return markdown.slice(match[0].length)
}

function resolveWikilinkTarget(targetRaw: string, catalog: VaultCatalog): VaultNoteItem | null {
  const cleanTarget = targetRaw.split('#')[0].trim().replace(/\.md$/i, '')
  if (!cleanTarget) return null

  const normalized = cleanTarget.toLowerCase()

  // 1. Coincidència exacta per ruta sense extensió
  const byPath = catalog.allNotes.find(
    (n) => n.path.replace(/\.md$/i, '').toLowerCase() === normalized,
  )
  if (byPath) return byPath

  // 2. Coincidència exacta per títol de nota
  const targetBasename = normalized.split('/').pop() ?? normalized
  const byTitle = catalog.allNotes.find((n) => n.title.toLowerCase() === targetBasename)
  if (byTitle) return byTitle

  return null
}

function resolveAssetTarget(targetRaw: string, catalog: VaultCatalog): string | null {
  const clean = targetRaw.split('|')[0].trim().toLowerCase()
  const match =
    catalog.allAssets.find((a) => a.path.toLowerCase() === clean) ||
    catalog.allAssets.find((a) => a.name.toLowerCase() === clean.split('/').pop())
  return match ? match.rawUrl : null
}

const CALLOUT_DEFAULT_TITLES: Record<string, string> = {
  info: 'Informació',
  note: 'Nota',
  quote: 'Cita',
  cite: 'Cita',
  tip: 'Consell',
  hint: 'Pista',
  warning: 'Atenció',
  caution: 'Precaució',
  danger: 'Important',
  example: 'Exemple',
  abstract: 'Resum',
}

function preprocessObsidianCallouts(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let inCodeFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      out.push(line)
      continue
    }

    if (!inCodeFence) {
      const calloutMatch = line.match(/^(\s*)>\s*\[!([a-zA-Z0-9_-]+)\][+-]?\s*(.*)$/)
      if (calloutMatch) {
        const indent = calloutMatch[1] ?? ''
        const type = calloutMatch[2].toLowerCase()
        const rawTitle = calloutMatch[3].trim()
        const title = rawTitle || CALLOUT_DEFAULT_TITLES[type] || type
        out.push(`${indent}> OBSCALLOUT::${type}::${title}`)
        out.push(`${indent}>`)
        continue
      }
    }

    out.push(line)
  }

  return out.join('\n')
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.split(/\r?\n/)
  const headings: MarkdownHeading[] = []
  let inCodeFence = false
  const usedIds = new Map<string, number>()

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    const match = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!match) continue

    const level = match[1].length
    const text = match[2]
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim()

    if (!text) continue

    let baseId = slugify(text) || `seccio-${headings.length + 1}`
    const count = usedIds.get(baseId) ?? 0
    usedIds.set(baseId, count + 1)
    if (count > 0) {
      baseId = `${baseId}-${count + 1}`
    }

    headings.push({ id: baseId, text, level })
  }

  return headings
}

export function preprocessObsidianMarkdown(
  rawMarkdown: string,
  note: VaultNoteItem,
  catalog: VaultCatalog,
): string {
  let content = stripFrontmatter(rawMarkdown)

  // Converteix incrustacions d'imatges ![[imatge.png]] o ![[imatge.png|400]]
  content = content.replace(/!\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const resolved = resolveAssetTarget(inner, catalog)
    const alt = inner.split('|')[0].trim()
    if (resolved) {
      return `![${alt}](${resolved})`
    }
    return `*[Recurs adjunt: ${alt}]*`
  })

  // Converteix enllaços interns d'Obsidian [[Destí|Àlies]] o [[Destí]]
  content = content.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const [targetPart, aliasPart] = inner.split('|')
    const label = (aliasPart ?? targetPart.split('#')[0]).trim()
    const matchedNote = resolveWikilinkTarget(targetPart, catalog)

    if (matchedNote) {
      return `[${label}](#/apunt/${matchedNote.slug})`
    }
    return `[${label}](#/nota-pendent/${encodeURIComponent(targetPart.trim())})`
  })

  // Resol imatges Markdown relatives ![alt](./img.png) cap a raw.githubusercontent.com
  const baseDir = note.path.includes('/')
    ? note.path.slice(0, note.path.lastIndexOf('/'))
    : ''

  content = content.replace(/!\[([^\]]*)\]\((?!https?:\/\/|#)([^)]+)\)/g, (_, alt: string, relPath: string) => {
    const cleaned = relPath.replace(/^\.\//, '')
    const fullPath = baseDir ? `${baseDir}/${cleaned}` : cleaned
    return `![${alt}](${getRawFileUrl(fullPath)})`
  })

  content = preprocessObsidianCallouts(content)
  return content
}

export async function fetchNoteContent(
  note: VaultNoteItem,
  catalog: VaultCatalog,
  forceRefresh = false,
): Promise<LoadedNote> {
  const cacheKey = `${NOTE_CACHE_PREFIX}${note.path}`
  const cachedRaw = sessionStorage.getItem(cacheKey)

  if (!forceRefresh && cachedRaw) {
    try {
      const parsed = JSON.parse(cachedRaw) as { rawMarkdown: string; timestamp: number }
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        const processed = preprocessObsidianMarkdown(parsed.rawMarkdown, note, catalog)
        const headings = extractHeadings(processed)
        const words = parsed.rawMarkdown.trim().split(/\s+/).filter(Boolean).length
        return {
          item: note,
          rawMarkdown: parsed.rawMarkdown,
          processedMarkdown: processed,
          headings,
          wordCount: words,
          readingTimeMin: Math.max(1, Math.round(words / 210)),
          fromCache: true,
        }
      }
    } catch {
      // ignora caché corrupta
    }
  }

  const response = await fetch(note.rawUrl)
  if (!response.ok) {
    throw new Error(`No s’ha pogut carregar l’apunt «${note.title}» (${response.status}).`)
  }

  const rawMarkdown = await response.text()
  sessionStorage.setItem(
    cacheKey,
    JSON.stringify({ rawMarkdown, timestamp: Date.now() }),
  )

  const processed = preprocessObsidianMarkdown(rawMarkdown, note, catalog)
  const headings = extractHeadings(processed)
  const words = rawMarkdown.trim().split(/\s+/).filter(Boolean).length

  return {
    item: note,
    rawMarkdown,
    processedMarkdown: processed,
    headings,
    wordCount: words,
    readingTimeMin: Math.max(1, Math.round(words / 210)),
    fromCache: false,
  }
}
