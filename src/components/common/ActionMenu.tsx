import { useEffect, useRef, useState } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  label?: string
  align?: 'left' | 'right'
  trigger?: 'icon' | 'text'
  triggerLabel?: string
}

export function ActionMenu({
  items,
  label = 'More',
  align = 'right',
  trigger = 'icon',
  triggerLabel,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!items.length) return null

  return (
    <div className={`action-menu ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={trigger === 'icon' ? 'icon-button' : 'button button-ghost button-small'}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        {trigger === 'icon' ? <MoreVertical size={18} /> : triggerLabel ?? label}
      </button>
      {open && (
        <div className={`action-menu-popover align-${align}`} role="menu">
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                role="menuitem"
                key={`${item.label}-${index}`}
                className={item.danger ? 'danger' : ''}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  item.onClick()
                }}
              >
                {Icon && <Icon size={16} />}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
