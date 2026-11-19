interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

const SKIP_NODE_TYPES = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'html'])
const INLINE_HIGHLIGHT_RE = /==([^\n=](?:[^\n]*?[^\n=])?)==/g

function createMarkNode(children: MdastNode[]): MdastNode {
  return {
    type: 'obsidianHighlight',
    data: {
      hName: 'mark',
      hProperties: { className: ['obsidian-mark'] },
    },
    children,
  }
}

function splitInlineHighlights(value: string): MdastNode[] | null {
  INLINE_HIGHLIGHT_RE.lastIndex = 0
  let match = INLINE_HIGHLIGHT_RE.exec(value)
  if (!match) return null

  const nodes: MdastNode[] = []
  let lastIndex = 0

  while (match) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: value.slice(lastIndex, match.index) })
    }
    nodes.push(createMarkNode([{ type: 'text', value: match[1] }]))
    lastIndex = match.index + match[0].length
    match = INLINE_HIGHLIGHT_RE.exec(value)
  }

  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return nodes
}

function transformChildren(children: MdastNode[]): MdastNode[] {
  // Pass 1: transforma ==...== dins d'un mateix node de text i baixa recursivament
  const expanded: MdastNode[] = []
  for (const child of children) {
    if (SKIP_NODE_TYPES.has(child.type)) {
      expanded.push(child)
      continue
    }

    if (child.type === 'text' && typeof child.value === 'string') {
      const split = splitInlineHighlights(child.value)
      if (split) {
        expanded.push(...split)
        continue
      }
    } else if (Array.isArray(child.children)) {
      child.children = transformChildren(child.children)
    }

    expanded.push(child)
  }

  // Pass 2: suporta ==**negreta** i *cursiva*== que travessa nodes germans
  const result: MdastNode[] = []
  const queue = [...expanded]
  let idx = 0

  while (idx < queue.length) {
    const node = queue[idx]
    if (node.type !== 'text' || typeof node.value !== 'string') {
      result.push(node)
      idx += 1
      continue
    }

    const openIdx = node.value.indexOf('==')
    if (openIdx === -1) {
      result.push(node)
      idx += 1
      continue
    }

    // Cerca un tancament '==' en un node de text posterior
    let closeNodeIdx = -1
    let closePos = -1
    for (let j = idx + 1; j < queue.length; j++) {
      const candidate = queue[j]
      if (candidate.type === 'text' && typeof candidate.value === 'string') {
        const found = candidate.value.indexOf('==')
        if (found !== -1) {
          closeNodeIdx = j
          closePos = found
          break
        }
      }
    }

    if (closeNodeIdx === -1) {
      result.push(node)
      idx += 1
      continue
    }

    const beforeText = node.value.slice(0, openIdx)
    const openRemainder = node.value.slice(openIdx + 2)
    const closeNode = queue[closeNodeIdx]
    const closeValue = closeNode.value ?? ''
    const closeLead = closeValue.slice(0, closePos)
    const afterText = closeValue.slice(closePos + 2)

    if (beforeText) {
      result.push({ type: 'text', value: beforeText })
    }

    const markChildren: MdastNode[] = []
    if (openRemainder) {
      markChildren.push({ type: 'text', value: openRemainder })
    }
    for (let k = idx + 1; k < closeNodeIdx; k++) {
      markChildren.push(queue[k])
    }
    if (closeLead) {
      markChildren.push({ type: 'text', value: closeLead })
    }

    if (markChildren.length > 0) {
      result.push(createMarkNode(markChildren))
    }

    if (afterText) {
      queue[closeNodeIdx] = { type: 'text', value: afterText }
      idx = closeNodeIdx
    } else {
      idx = closeNodeIdx + 1
    }
  }

  return result
}

export function remarkObsidianHighlight() {
  return (tree: MdastNode) => {
    if (Array.isArray(tree.children)) {
      tree.children = transformChildren(tree.children)
    }
  }
}
