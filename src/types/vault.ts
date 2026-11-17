export interface GitHubTreeNode {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

export interface VaultNoteItem {
  id: string
  path: string
  slug: string
  name: string
  title: string
  extension: string
  subjectName: string
  subjectSlug: string
  folderSegments: string[]
  isDraft: boolean
  isAsset: boolean
  rawUrl: string
  githubUrl: string
}

export interface VaultFolderNode {
  name: string
  path: string
  slug: string
  notes: VaultNoteItem[]
  subfolders: VaultFolderNode[]
  totalNotes: number
}

export interface SubjectMetadata {
  curs?: string
  semestre?: string
  tags: string[]
  ordre?: number
  descripcio?: string
}

export interface VaultSubject {
  name: string
  slug: string
  romanNumeral: string
  path: string
  totalNotes: number
  draftNotes: number
  rootFolder: VaultFolderNode
  allNotes: VaultNoteItem[]
  meta?: SubjectMetadata
}

export interface VaultCatalog {
  subjects: VaultSubject[]
  allNotes: VaultNoteItem[]
  allAssets: VaultNoteItem[]
  readmeNote: VaultNoteItem | null
  fetchedAt: string
  fromCache: boolean
  rateLimited?: boolean
}

export interface MarkdownHeading {
  id: string
  text: string
  level: number
}

export interface LoadedNote {
  item: VaultNoteItem
  rawMarkdown: string
  processedMarkdown: string
  headings: MarkdownHeading[]
  wordCount: number
  readingTimeMin: number
  fromCache: boolean
}

export type TicketStatus = 'pendent' | 'en_revisio' | 'acceptat' | 'rebutjat'
export type TicketType = 'addicio' | 'modificacio' | 'correccio'

export interface TicketAttachment {
  name: string
  size: number
  type: string
  url?: string
  dataUrl?: string
}

export interface TicketItem {
  id: string
  number?: number
  title: string
  subject: string
  notePath?: string
  type: TicketType
  description: string
  authorName: string
  authorContact?: string
  status: TicketStatus
  attachment?: TicketAttachment
  createdAt: string
  updatedAt: string
  htmlUrl?: string
  source: 'github' | 'local'
  commentsCount?: number
}

export interface CreateTicketPayload {
  title: string
  subject: string
  notePath?: string
  type: TicketType
  description: string
  authorName: string
  authorContact?: string
  file?: File | null
}
