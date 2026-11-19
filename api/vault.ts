// Vercel Function (Node.js runtime amb Web Standard Request/Response)
// Resol l'últim commit SHA i l'arbre complet del repositori del Vault sense caché obsoleta.
// Si GITHUB_TOKEN està configurat a Vercel, utilitza autenticació (5.000 peticions/hora).

interface GitHubCommitResponse {
  sha?: string
  commit?: {
    tree?: {
      sha?: string
    }
  }
}

interface GitHubTreeResponse {
  sha?: string
  truncated?: boolean
  tree?: Array<{
    path: string
    mode: string
    type: 'blob' | 'tree'
    sha: string
    size?: number
    url: string
  }>
}

async function fetchGitHubJson(url: string, token?: string): Promise<Response> {
  const baseHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'apuntsinteractiva-vault-sync',
    'Cache-Control': 'no-cache',
  }

  if (token) {
    const authedRes = await fetch(url, {
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    // Si el token ha caducat o no és vàlid, reintentem sense autenticació per a repositoris públics
    if (authedRes.status !== 401) {
      return authedRes
    }
  }

  return fetch(url, {
    headers: baseHeaders,
    cache: 'no-store',
  })
}

export async function GET(request: Request): Promise<Response> {
  const token = process.env.GITHUB_TOKEN?.trim() || undefined
  const owner = process.env.VAULT_OWNER?.trim() || 'carlesaguilarr'
  const repo = process.env.VAULT_REPO?.trim() || 'Vault'
  const branch = process.env.VAULT_BRANCH?.trim() || 'main'

  const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }

  try {
    const reqUrl = new URL(request.url)
    const bust = reqUrl.searchParams.get('t') || String(Date.now())

    // 1. Obtenim l'últim commit real de la branca per evitar qualsevol caché intermitja de GitHub/CDN
    const commitRes = await fetchGitHubJson(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}?_=${encodeURIComponent(bust)}`,
      token,
    )

    if (!commitRes.ok) {
      const rateLimited = commitRes.status === 403 || commitRes.status === 429
      return Response.json(
        {
          error: rateLimited
            ? 'S’ha assolit temporalment el límit de consultes de GitHub.'
            : `No s’ha pogut consultar l’última versió del repositori (Error ${commitRes.status}).`,
          rateLimited,
        },
        { status: commitRes.status, headers: noStoreHeaders },
      )
    }

    const commitData = (await commitRes.json()) as GitHubCommitResponse
    const commitSha = commitData.sha
    const treeRef = commitData.commit?.tree?.sha || commitSha || branch

    // 2. Descarreguem l'arbre recursiu exacte d'aquest commit immutable
    const treeRes = await fetchGitHubJson(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeRef)}?recursive=1`,
      token,
    )

    if (!treeRes.ok) {
      const rateLimited = treeRes.status === 403 || treeRes.status === 429
      return Response.json(
        {
          error: rateLimited
            ? 'S’ha assolit temporalment el límit de consultes de GitHub.'
            : `No s’ha pogut obtenir l’índex del repositori (Error ${treeRes.status}).`,
          rateLimited,
        },
        { status: treeRes.status, headers: noStoreHeaders },
      )
    }

    const treeData = (await treeRes.json()) as GitHubTreeResponse

    return Response.json(
      {
        commitSha: commitSha ?? null,
        tree: treeData.tree ?? [],
        truncated: Boolean(treeData.truncated),
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: noStoreHeaders },
    )
  } catch {
    return Response.json(
      { error: 'Error de connexió en consultar el repositori de GitHub.' },
      { status: 502, headers: noStoreHeaders },
    )
  }
}
