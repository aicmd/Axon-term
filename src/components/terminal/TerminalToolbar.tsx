import React, { useState, useCallback } from 'react'
import { Download, X, Check } from 'lucide-react'
import type { Terminal } from '@xterm/xterm'

interface TerminalToolbarProps {
  isFocused: boolean
  hostId: string
  xtermRef: React.RefObject<Terminal | null>
  onClose?: () => void
}

/**
 * Floating toolbar rendered in the top-right corner of a terminal pane.
 * Provides AI explain, save-output, and close actions.
 */
export const TerminalToolbar: React.FC<TerminalToolbarProps> = ({
  isFocused,
  hostId,
  xtermRef,
  onClose,
}) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  const handleSaveOutput = useCallback(() => {
    if (!xtermRef.current) return
    const term = xtermRef.current
    const buffer = term.buffer.active
    const lines: string[] = []

    // Iterate through all lines in the scrollback buffer and current viewport
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) {
        // translateToString(true) trims trailing whitespace which is ideal for logs
        lines.push(line.translateToString(true))
      }
    }

    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    // Create a temporary link to trigger the browser download
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = `axon-term-${hostId || 'local'}-${timestamp}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Provide visual feedback
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [hostId, xtermRef])

  return (
    <div
      className={`absolute top-2 right-4 flex items-center gap-1 bg-sidebar/80 backdrop-blur-md border border-border rounded-md p-1 z-10 opacity-0 hover:opacity-100 transition-opacity ${isFocused ? 'opacity-100' : ''
        }`}
    >
      {/* <button
        className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded"
        title="AI Explain"
      >
        <Sparkles size={14} className="text-accent" />
      </button> */}
      <button
        className={`p-1.5 rounded transition-colors ${saveStatus === 'saved'
          ? 'text-success bg-success/10'
          : 'text-textMuted hover:text-textMain hover:bg-hover'
          }`}
        title={saveStatus === 'saved' ? 'Saved!' : 'Save Output'}
        onClick={handleSaveOutput}
      >
        {saveStatus === 'saved' ? <Check size={14} /> : <Download size={14} />}
      </button>
      <div className="w-px h-4 bg-border mx-1"></div>
      {onClose && (
        <button
          className="p-1.5 text-textMuted hover:text-error hover:bg-hover rounded"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
