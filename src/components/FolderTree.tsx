import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import type { VaultFolderNode } from '../types/vault'

interface FolderTreeProps {
  folder: VaultFolderNode
  activePath?: string
  depth?: number
  onSelectNote?: () => void
}

export function FolderTree({
  folder,
  activePath,
  depth = 0,
  onSelectNote,
}: FolderTreeProps) {
  return (
    <div style={{ paddingLeft: depth > 0 ? '0.65rem' : 0 }}>
      {depth > 0 && (
        <div className="tree-folder-title">
          <FolderOpen size={14} color="var(--accent-brass)" />
          <span>{folder.name}</span>
        </div>
      )}

      <div>
        {folder.notes.map((note) => (
          <Link
            key={note.path}
            to={`/apunt/${note.slug}`}
            className={`tree-note-link ${activePath === note.path ? 'active' : ''}`}
            onClick={onSelectNote}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {note.title}
            </span>
            {note.isDraft && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.64rem',
                  color: 'var(--accent-brass)',
                  flexShrink: 0,
                }}
              >
                Esborrany
              </span>
            )}
          </Link>
        ))}
      </div>

      {folder.subfolders.map((sub) => (
        <FolderTree
          key={sub.path}
          folder={sub}
          activePath={activePath}
          depth={depth + 1}
          onSelectNote={onSelectNote}
        />
      ))}
    </div>
  )
}
