import React from 'react'
import { Clock, Rocket, CornerDownLeft } from 'lucide-react'
import type { Terminal } from '@xterm/xterm'

export interface SuggestionItem {
  type: 'history' | 'snippet'
  command: string
  label?: string
}

interface SuggestionPopupProps {
  suggestions: SuggestionItem[]
  selectedIndex: number
  inputBuffer: string
  isFocused: boolean
  xtermRef: React.RefObject<Terminal | null>
  terminalRef: React.RefObject<HTMLDivElement | null>
  onSelect: (item: SuggestionItem) => void
}

/**
 * Autocomplete suggestion popup rendered over the terminal.
 * Position is computed from the xterm cursor coordinates.
 */
export const SuggestionPopup: React.FC<SuggestionPopupProps> = ({
  suggestions,
  selectedIndex,
  inputBuffer,
  isFocused,
  xtermRef,
  terminalRef,
  onSelect,
}) => {
  const getStyle = (): React.CSSProperties => {
    if (!xtermRef.current || !terminalRef.current) return { display: 'none' }
    const term = xtermRef.current
    const cursorX = term.buffer.active.cursorX
    const cursorY = term.buffer.active.cursorY
    // @ts-ignore — accessing internal render dimensions
    const core = term._core
    const charWidth = core._renderService?.dimensions?.css?.cell?.width || 8.4
    const charHeight = core._renderService?.dimensions?.css?.cell?.height || 19

    const popupHeight = Math.min(suggestions.length + 1, 7) * 36
    const containerHeight = terminalRef.current.clientHeight

    let top = (cursorY + 1) * charHeight + 8
    if (top + popupHeight > containerHeight && cursorY > 5) {
      top = cursorY * charHeight + 8 - popupHeight
    }

    return {
      left: cursorX * charWidth + 12,
      top,
      display: suggestions.length > 0 && isFocused ? 'block' : 'none',
    }
  }

  return (
    <div
      className="absolute z-50 w-80 bg-sidebar/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={getStyle()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${selectedIndex === 0 ? 'bg-hover' : ''}`}
      >
        <Rocket size={14} className="text-accent" />
        <span className="flex-1 font-mono text-sm text-textMain truncate">
          {inputBuffer}
        </span>
      </div>
      <div className="py-1">
        {suggestions.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
              selectedIndex === idx + 1 ? 'bg-accent text-white' : 'hover:bg-hover'
            }`}
            onClick={() => onSelect(item)}
          >
            {item.type === 'history' ? (
              <Clock
                size={14}
                className={selectedIndex === idx + 1 ? 'text-white' : 'text-textMuted'}
              />
            ) : (
              <Rocket
                size={14}
                className={selectedIndex === idx + 1 ? 'text-white' : 'text-accent'}
              />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={`font-mono text-sm truncate ${
                  selectedIndex === idx + 1 ? 'text-white' : 'text-textMain'
                }`}
              >
                {item.command}
              </div>
              {item.label && (
                <div
                  className={`text-[10px] uppercase tracking-wider ${
                    selectedIndex === idx + 1 ? 'text-white/70' : 'text-textMuted'
                  }`}
                >
                  {item.label}
                </div>
              )}
            </div>
            {selectedIndex === idx + 1 && (
              <CornerDownLeft size={14} className="opacity-50" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
