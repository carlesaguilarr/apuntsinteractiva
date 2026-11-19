import type {
  CreateTicketPayload,
  TicketAttachment,
  TicketItem,
  TicketStatus,
  TicketType,
} from '../types/vault'
import { VAULT_OWNER, VAULT_REPO } from './vaultService'

const LOCAL_TICKETS_KEY = 'apunts_local_tickets_v1'
const TICKET_ENDPOINT = import.meta.env.VITE_TICKET_ENDPOINT as string | undefined

interface GitHubIssueLabel {
  name: string
}

interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  state_reason?: string | null
  labels: GitHubIssueLabel[]
  user: { login: string } | null
  created_at: string
  updated_at: string
  html_url: string
  comments: number
  pull_request?: unknown
}

function mapGitHubIssueToStatus(issue: GitHubIssue): TicketStatus {
  const labelNames = issue.labels.map((l) => l.name.toLowerCase())

  if (issue.state === 'closed') {
    if (
      labelNames.some((n) => n.includes('rebutjat') || n.includes('wontfix') || n.includes('descartat')) ||
      issue.state_reason === 'not_planned'
    ) {
      return 'rebutjat'
    }
    return 'acceptat'
  }

  if (labelNames.some((n) => n.includes('revis') || n.includes('review') || n.includes('progrés'))) {
    return 'en_revisio'
  }
  return 'pendent'
}

function mapGitHubIssueToType(issue: GitHubIssue): TicketType {
  const labelNames = issue.labels.map((l) => l.name.toLowerCase())
  const titleLower = issue.title.toLowerCase()
  const bodyLower = (issue.body ?? '').toLowerCase()

  if (labelNames.some((n) => n.includes('correcc') || n.includes('error')) || titleLower.includes('correcc')) {
    return 'correccio'
  }
  if (labelNames.some((n) => n.includes('modific')) || bodyLower.includes('tipus:** modific')) {
    return 'modificacio'
  }
  return 'addicio'
}

function extractFieldFromBody(body: string, field: string): string | undefined {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'i')
  const match = body.match(regex)
  return match ? match[1].trim() : undefined
}

function cleanIssueDescription(body: string): string {
  return body
    .replace(/\*\*Assignatura:\*\*.*\r?\n?/gi, '')
    .replace(/\*\*Tipus:\*\*.*\r?\n?/gi, '')
    .replace(/\*\*Apunt relacionat:\*\*.*\r?\n?/gi, '')
    .replace(/\*\*Autor\/a:\*\*.*\r?\n?/gi, '')
    .replace(/\*\*Contacte:\*\*.*\r?\n?/gi, '')
    .replace(/\*\*Document adjunt:\*\*.*\r?\n?/gi, '')
    .replace(/^---\r?\n?/gm, '')
    .trim()
}

function cleanIssueTitle(rawTitle: string, subject: string): string {
  const prefix = `[${subject}]`
  if (rawTitle.startsWith(prefix)) {
    return rawTitle.slice(prefix.length).trim()
  }
  return rawTitle
}

export function getLocalTickets(): TicketItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TicketItem[]
  } catch {
    return []
  }
}

function saveLocalTicket(ticket: TicketItem): void {
  const existing = getLocalTickets()
  localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify([ticket, ...existing]))
}

export async function fetchTickets(forceRefresh = false): Promise<{
  tickets: TicketItem[]
  githubError?: string
}> {
  const localTickets = getLocalTickets()
  const url = `https://api.github.com/repos/${VAULT_OWNER}/${VAULT_REPO}/issues?state=all&per_page=50${
    forceRefresh ? `&_=${Date.now()}` : ''
  }`

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: forceRefresh ? 'no-store' : 'default',
    })

    if (!response.ok) {
      return {
        tickets: localTickets,
        githubError: 'No s’han pogut obtenir els tiquets en directe de GitHub.',
      }
    }

    const issues = (await response.json()) as GitHubIssue[]
    const githubTickets: TicketItem[] = issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => {
        const body = issue.body ?? ''
        const subject = extractFieldFromBody(body, 'Assignatura') ?? 'General'
        const notePath = extractFieldFromBody(body, 'Apunt relacionat')
        const authorName = extractFieldFromBody(body, 'Autor/a') ?? issue.user?.login ?? 'Anònim'
        const attachmentMatch = body.match(/\*\*Document adjunt:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/i)

        const attachment: TicketAttachment | undefined = attachmentMatch
          ? {
              name: attachmentMatch[1],
              size: 0,
              type: 'application/octet-stream',
              url: attachmentMatch[2],
            }
          : undefined

        return {
          id: `gh-${issue.id}`,
          number: issue.number,
          title: cleanIssueTitle(issue.title, subject),
          subject,
          notePath: notePath === 'Cap en concret' ? undefined : notePath,
          type: mapGitHubIssueToType(issue),
          description: cleanIssueDescription(body) || cleanIssueTitle(issue.title, subject),
          authorName,
          status: mapGitHubIssueToStatus(issue),
          attachment,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          htmlUrl: issue.html_url,
          source: 'github',
          commentsCount: issue.comments,
        }
      })

    const merged = [...localTickets, ...githubTickets].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    return { tickets: merged }
  } catch {
    return {
      tickets: localTickets,
      githubError: 'Error de connexió en consultar el seguiment de GitHub.',
    }
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No s’ha pogut llegir el fitxer adjunt.'))
    reader.readAsDataURL(file)
  })
}

export async function createTicket(payload: CreateTicketPayload): Promise<{
  ticket: TicketItem
  mode: 'remote' | 'local'
}> {
  let fileDataUrl: string | undefined
  if (payload.file) {
    fileDataUrl = await readFileAsBase64(payload.file)
  }

  const endpoint = TICKET_ENDPOINT || '/api/tickets'

  let response: Response | null
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        subject: payload.subject,
        notePath: payload.notePath,
        type: payload.type,
        description: payload.description,
        authorName: payload.authorName,
        authorContact: payload.authorContact,
        attachment: payload.file
          ? {
              name: payload.file.name,
              size: payload.file.size,
              type: payload.file.type,
              dataUrl: fileDataUrl,
            }
          : undefined,
      }),
    })
  } catch {
    response = null
  }

  if (response) {
    if (response.ok) {
      const created = (await response.json()) as TicketItem
      return { ticket: created, mode: 'remote' }
    }

    // Només passem a mode local si l'endpoint no està desplegat (404) o falta configurar el token (501)
    if (response.status !== 404 && response.status !== 501) {
      let message = 'No s’ha pogut registrar el tiquet al servidor.'
      try {
        const errData = (await response.json()) as { error?: string }
        if (errData.error) message = errData.error
      } catch {
        // resposta no JSON
      }
      throw new Error(message)
    }
  }

  const nowIso = new Date().toISOString()
  const localNumber = Math.floor(100 + Math.random() * 900)
  const localTicket: TicketItem = {
    id: `local-${Date.now()}`,
    number: localNumber,
    title: payload.title,
    subject: payload.subject,
    notePath: payload.notePath,
    type: payload.type,
    description: payload.description,
    authorName: payload.authorName.trim() || 'Estudiant UAB',
    authorContact: payload.authorContact?.trim() || undefined,
    status: 'pendent',
    attachment: payload.file
      ? {
          name: payload.file.name,
          size: payload.file.size,
          type: payload.file.type,
          dataUrl: fileDataUrl,
        }
      : undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: 'local',
  }

  saveLocalTicket(localTicket)
  return { ticket: localTicket, mode: 'local' }
}

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; description: string; tone: 'pending' | 'review' | 'accepted' | 'rejected' }
> = {
  pendent: {
    label: 'Pendent',
    description: 'Petició registrada, pendent de revisió editorial.',
    tone: 'pending',
  },
  en_revisio: {
    label: 'En revisió',
    description: 'S’està verificant i adaptant el material proposat.',
    tone: 'review',
  },
  acceptat: {
    label: 'Acceptat i publicat',
    description: 'Contingut revisat i incorporat al repositori d’apunts.',
    tone: 'accepted',
  },
  rebutjat: {
    label: 'Descartat',
    description: 'La petició s’ha tancat sense incorporar canvis.',
    tone: 'rejected',
  },
}

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  addicio: 'Nou material / apunts',
  modificacio: 'Ampliació o modificació',
  correccio: 'Correcció d’errades',
}
