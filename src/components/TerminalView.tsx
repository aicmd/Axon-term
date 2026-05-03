import React, { useState, useRef, useCallback } from "react";
import {
  Terminal as TerminalIcon,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from "lucide-react";
import { useI18n } from "../I18nContext";
import { ConnectionState } from "../types";
import { TerminalPane } from "./terminal/TerminalPane";
import { TerminalPaneHandle } from "./terminal/types";

/**
 * Main TerminalView component managing multiple panes and broadcast mode.
 */
export const TerminalView: React.FC<{
  hostId: string;
  isActive?: boolean;
  tabId?: string;
  onStatusChange?: (state: ConnectionState) => void;
}> = ({ hostId, isActive = true, tabId = "default", onStatusChange }) => {
  const { t } = useI18n();
  const [panes, setPanes] = useState([{ id: "1" }]);
  const [focusedPane, setFocusedPane] = useState("1");
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [splitDirection, setSplitDirection] = useState<"row" | "col">("row");

  // Use a ref to track all active pane handles for broadcasting
  const paneRefs = useRef<Record<string, TerminalPaneHandle | null>>({});

  const splitPane = (direction: "row" | "col") => {
    setSplitDirection(direction);
    const newId = Date.now().toString();
    setPanes(prev => [...prev, { id: newId }]);
    setFocusedPane(newId);
  };

  const handleSetFocusedPane = useCallback((id: string) => {
    setFocusedPane(id);
  }, []);

  const handleClosePane = useCallback((id: string) => {
    setPanes(prev => {
      if (prev.length === 1) return prev;
      const newPanes = prev.filter((p) => p.id !== id);
      setFocusedPane(current => current === id ? newPanes[0].id : current);
      return newPanes;
    });
    delete paneRefs.current[id];
  }, []);

  const handleBroadcastCommand = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && broadcastInput.trim()) {
      window.dispatchEvent(new CustomEvent("axon-broadcast", {
        detail: { command: broadcastInput + "\r" }
      }));
      setBroadcastInput("");
    }
  };

  // Focus back to active terminal when broadcast mode is turned off
  React.useEffect(() => {
    if (!isBroadcastMode && focusedPane) {
      // Small delay to ensure the broadcast input has been unmounted or hidden
      setTimeout(() => {
        paneRefs.current[focusedPane]?.focus();
      }, 50);
    }
  }, [isBroadcastMode, focusedPane]);

  return (
    <div className="flex flex-col h-full w-full bg-main overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <TerminalIcon size={16} />
          <span>{t('sshSession')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isBroadcastMode ? "bg-error/20 text-error border border-error/50" : "bg-hover text-textMuted hover:text-textMain"}`}
            onClick={() => setIsBroadcastMode(!isBroadcastMode)}
          >
            <div
              className={`w-2 h-2 rounded-full ${isBroadcastMode ? "bg-error animate-pulse" : "bg-textMuted"}`}
            ></div>
            {t("broadcast")}
          </button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button
            className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded transition-colors"
            onClick={() => splitPane("row")}
            title={t("splitH")}
          >
            <SplitSquareHorizontal size={16} />
          </button>
          <button
            className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded transition-colors"
            onClick={() => splitPane("col")}
            title={t("splitV")}
          >
            <SplitSquareVertical size={16} />
          </button>
        </div>
      </div>

      <div className={`flex-1 flex ${splitDirection === "col" ? "flex-col" : "flex-row"} overflow-hidden`}>
        {panes.map((pane, index) => (
          <React.Fragment key={pane.id}>
            <TerminalPane
              ref={el => { paneRefs.current[pane.id] = el; }}
              id={pane.id}
              hostId={hostId}
              tabId={tabId}
              isFocused={isActive && focusedPane === pane.id}
              onClick={handleSetFocusedPane}
              onClose={panes.length > 1 ? handleClosePane : undefined}
              onStatusChange={onStatusChange}
            />
            {index < panes.length - 1 && (
              <div className={`${splitDirection === "col" ? "h-px w-full" : "w-px h-full"} bg-border cursor-${splitDirection === "col" ? "row" : "col"}-resize shrink-0`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {isBroadcastMode && (
        <div className="p-2 bg-sidebar border-t border-error/30 flex items-center gap-3">
          <div className="text-xs font-bold text-error uppercase tracking-wider whitespace-nowrap">
            {t("broadcast")}
          </div>
          <input
            type="text"
            className="flex-1 bg-main border border-border rounded px-3 py-1.5 text-sm font-mono text-textMain focus:outline-none focus:border-error/50"
            placeholder={t('broadcastPlaceholder')}
            value={broadcastInput}
            onChange={(e) => setBroadcastInput(e.target.value)}
            onKeyDown={handleBroadcastCommand}
            autoFocus
          />
        </div>
      )}
    </div>
  );
};
