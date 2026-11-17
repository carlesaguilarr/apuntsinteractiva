import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import type { VaultFolderNode } from '../types/vault'

interface FolderTreeProps {
  folder: VaultFolderNode
  activePath?: string
  onSelectNote?: () => void
}

function folderContainsNote(folder: VaultFolderNode, targetPath?: string): boolean {
  if (!targetPath) return false
  if (folder.notes.some((n) => n.path === targetPath)) return true
  return folder.subfolders.some((sub) => folderContainsNote(sub, targetPath))
}

function SubfolderBranch({
  folder,
  activePath,
  onSelectNote,
}: {
  folder: VaultFolderNode
  activePath?: string
  onSelectNote?: () => void
}) {
  const [open, setOpen] = useState(() => folderContainsNote(folder, activePath))

  return (
    <div>
      <button
        type="button"
        className="tree-folder-btn"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
          {open ? (
            <FolderOpen size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          ) : (
            <Folder size={14} color="var(--accent-brass)" style={{ flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.name}
          </span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {folder.totalNotes}
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {open && (
        <div
          style={{
            paddingLeft: '0.75rem',
            marginLeft: '0.45rem',
            borderLeft: '1px solid var(--border-hairline)',
          }}
        >
          <FolderTree
            folder={folder}
            activePath={activePath}
            onSelectNote={onSelectNote}
          />
        </div>
      )}
    </div>
  )
}

export function FolderTree({
  folder,
  activePath,
  onSelectNote,
}: FolderTreeProps) {
  return (
    <div>
      {folder.subfolders.map((sub) => (
        <SubfolderBranch
          key={sub.path}
          folder={sub}
          activePath={activePath}
          onSelectNote={onSelectNote}
        />
      ))}

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
    </div>
  )
}
