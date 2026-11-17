// Vercel Function (Node.js runtime amb Web Standard Request/Response)
// Variables d'entorn necessàries a Vercel (Project Settings -> Environment Variables):
// - GITHUB_TOKEN: Personal Access Token amb permisos de 'Issues' (Read & Write) i 'Contents' (Read & Write) sobre carlesaguilarr/Vault
// - VAULT_OWNER (opcional, per defecte 'carlesaguilarr')
// - VAULT_REPO (opcional, per defecte 'Vault')

interface IncomingAttachment {
  name: string
  size: number
  type: string
  dataUrl: string
}

interface IncomingTicketBody {
  title: string
  subject: string
  notePath?: string
  type: 'addicio' | 'modificacio' | 'correccio'
  description: string
  authorName: string
  authorContact?: string
  attachment?: IncomingAttachment
}

const MAX_RAW_BYTES = 3 * 1024 * 1024 // 3 MB (~4 MB en base64, dins el límit de 4.5 MB de Vercel)

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'md',
  'txt',
  'doc',
  'docx',
  'png',
  'jpg',
  'jpeg',
  'webp',
])

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'document'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.VAULT_OWNER || 'carlesaguilarr'
  const repo = process.env.VAULT_REPO || 'Vault'

  if (!token) {
    return Response.json(
      { error: 'Falta configurar GITHUB_TOKEN al servidor de Vercel.' },
      { status: 501 },
    )
  }

  let body: IncomingTicketBody
  try {
    body = (await request.json()) as IncomingTicketBody
  } catch {
    return Response.json(
      { error: 'No s’ha pogut processar la sol·licitud.' },
      { status: 400 },
    )
  }

  if (!body.title?.trim() || !body.subject?.trim() || !body.description?.trim()) {
    return Response.json(
      { error: 'Cal omplir el títol, l’assignatura i la descripció.' },
      { status: 400 },
    )
  }

  let attachmentMarkdown = ''
  let attachmentUrl: string | undefined

  if (body.attachment?.dataUrl && body.attachment.name) {
    const ext = getExtension(body.attachment.name)
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json(
        { error: 'Format de document adjunt no permès.' },
        { status: 400 },
      )
    }

    if (body.attachment.size > MAX_RAW_BYTES) {
      return Response.json(
        { error: 'El document adjunt supera el límit màxim de 3 MB.' },
        { status: 413 },
      )
    }

    const base64Content = body.attachment.dataUrl.includes(',')
      ? body.attachment.dataUrl.split(',')[1]
      : body.attachment.dataUrl

    if (!base64Content) {
      return Response.json(
        { error: 'El fitxer adjunt és buit o no s’ha pogut llegir.' },
        { status: 400 },
      )
    }

    const stamp = new Date().toISOString().slice(0, 10)
    const safeName = sanitizeFileName(body.attachment.name)
    const uploadPath = `_aportacions/${stamp}-${Date.now()}-${safeName}`

    const uploadRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `Aportació pendent de revisió: ${safeName}`,
          content: base64Content,
        }),
      },
    )

    if (!uploadRes.ok) {
      return Response.json(
        {
          error:
            'No s’ha pogut desar el document adjunt a GitHub. Revisa els permisos del token (Contents: Read & Write).',
        },
        { status: 502 },
      )
    }

    const uploadData = (await uploadRes.json()) as {
      content?: { html_url?: string }
    }
    attachmentUrl = uploadData.content?.html_url
    if (attachmentUrl) {
      attachmentMarkdown = `**Document adjunt:** [${body.attachment.name}](${attachmentUrl})`
    }
  }

  const typeLabelMap = {
    addicio: 'Nou material',
    modificacio: 'Modificació',
    correccio: 'Correcció',
  }

  const issueBody = [
    `**Assignatura:** ${body.subject.trim()}`,
    `**Tipus:** ${typeLabelMap[body.type] ?? body.type}`,
    `**Apunt relacionat:** ${body.notePath?.trim() || 'Cap en concret'}`,
    `**Autor/a:** ${body.authorName?.trim() || 'Estudiant UAB'}`,
    body.authorContact?.trim() ? `**Contacte:** ${body.authorContact.trim()}` : '',
    attachmentMarkdown,
    '',
    '---',
    '',
    body.description.trim(),
  ]
    .filter(Boolean)
    .join('\n')

  const typeIssueLabelMap = {
    addicio: 'addició',
    modificacio: 'modificació',
    correccio: 'correcció',
  }

  const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: `[${body.subject.trim()}] ${body.title.trim()}`,
      body: issueBody,
      labels: ['pendent', typeIssueLabelMap[body.type] ?? body.type],
    }),
  })

  if (!issueRes.ok) {
    return Response.json(
      {
        error:
          'No s’ha pogut crear el tiquet a GitHub. Revisa els permisos del token (Issues: Read & Write).',
      },
      { status: 502 },
    )
  }

  const created = (await issueRes.json()) as {
    id: number
    number: number
    title: string
    created_at: string
    updated_at: string
    html_url: string
  }

  return Response.json(
    {
      id: `gh-${created.id}`,
      number: created.number,
      title: body.title.trim(),
      subject: body.subject.trim(),
      notePath: body.notePath?.trim() || undefined,
      type: body.type,
      description: body.description.trim(),
      authorName: body.authorName?.trim() || 'Estudiant UAB',
      status: 'pendent',
      attachment: body.attachment
        ? {
            name: body.attachment.name,
            size: body.attachment.size,
            type: body.attachment.type,
            url: attachmentUrl,
          }
        : undefined,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      htmlUrl: created.html_url,
      source: 'github',
    },
    { status: 201 },
  )
}
