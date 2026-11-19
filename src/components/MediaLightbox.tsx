import { useEffect, useState } from 'react'
import { ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

export type LightboxMedia =
  | {
      kind: 'image'
      src: string
      alt: string
    }
  | {
      kind: 'svg'
      svg: string
      title: string
    }

interface MediaLightboxProps {
  media: LightboxMedia | null
  onClose: () => void
}

function MediaLightboxInner({
  media,
  onClose,
}: {
  media: LightboxMedia
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))
      } else if (e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))
      } else if (e.key === '0') {
        e.preventDefault()
        setZoom(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const caption = media.kind === 'image' ? media.alt : media.title

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={caption || 'Vista ampliada'}
      onClick={onClose}
    >
      <div className="lightbox-shell" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-toolbar">
          <div className="lightbox-caption" title={caption}>
            {caption || 'Vista ampliada'}
          </div>

          <div className="lightbox-controls">
            <button
              type="button"
              className="lightbox-btn"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              aria-label="Reduir zoom"
              title="Reduir (-)"
            >
              <ZoomOut size={15} />
            </button>

            <span className="lightbox-zoom-label">{Math.round(zoom * 100)}%</span>

            <button
              type="button"
              className="lightbox-btn"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
              aria-label="Augmentar zoom"
              title="Ampliar (+)"
            >
              <ZoomIn size={15} />
            </button>

            {zoom !== 1 && (
              <button
                type="button"
                className="lightbox-btn"
                onClick={() => setZoom(1)}
                aria-label="Restablir zoom"
                title="Ajustar (0)"
              >
                <RotateCcw size={14} />
              </button>
            )}

            {media.kind === 'image' && (
              <a
                href={media.src}
                target="_blank"
                rel="noreferrer"
                className="lightbox-btn"
                title="Obrir imatge original en una pestanya nova"
                aria-label="Obrir original"
              >
                <ExternalLink size={15} />
              </a>
            )}

            <button
              type="button"
              className="lightbox-btn"
              onClick={onClose}
              aria-label="Tancar vista ampliada"
              title="Tancar (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="lightbox-stage"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          {media.kind === 'image' ? (
            <img
              src={media.src}
              alt={media.alt}
              className="lightbox-image"
              style={{ transform: `scale(${zoom})` }}
              onClick={() => setZoom((z) => (z === 1 ? 1.75 : 1))}
            />
          ) : (
            <div
              className="lightbox-svg-stage"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: media.svg }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  if (!media) return null
  const resetKey = media.kind === 'image' ? `img:${media.src}` : `svg:${media.title}:${media.svg.length}`
  return <MediaLightboxInner key={resetKey} media={media} onClose={onClose} />
}
