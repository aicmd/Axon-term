import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "../../ThemeContext";
import { useHosts } from "../../HostContext";
import { useSnippets } from "../../SnippetContext";
import { useSettings } from "../../SettingsContext";
import { XTERM_THEMES } from "./constants";
import { SuggestionPopup, SuggestionItem } from "./SuggestionPopup";
import { TerminalToolbar } from "./TerminalToolbar";
import { useTerminal } from "./useTerminal";
import { TerminalPaneProps, TerminalPaneHandle } from "./types";

const MAX_SUGGESTIONS = 6;

/**
 * TerminalPane component representing a single terminal instance.
 * Uses @xterm/xterm for rendering and useTerminal for communication.
 * Wrapped in React.memo to prevent unnecessary re-renders when other panes change.
 */
export const TerminalPane = React.memo(forwardRef<TerminalPaneHandle, TerminalPaneProps>(({
  id,
  hostId,
  tabId = "default",
  onClose,
  isFocused,
  onClick,
  onStatusChange
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();
  const { getHost } = useHosts();
  const { settings } = useSettings();

  const [appHistory, setAppHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem("axon-terminal-history");
    return saved ? JSON.parse(saved) : [];
  });
  const [systemHistory, setSystemHistory] = useState<string[]>([]);
  const [inputBuffer, setInputBuffer] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentLineRef = useRef("");
  const suggestionsRef = useRef<SuggestionItem[]>([]);
  const selectedIndexRef = useRef(0);

  // Hook for terminal logic
  const { connect, write, resize, disconnect } = useTerminal(hostId, settings.terminalEmulation, onStatusChange);

  // Stable session ID for this terminal pane
  const terminalSessionId = React.useMemo(() => `term_${tabId}_${hostId}_${id}`, [tabId, hostId, id]);

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Fetch system shell history if enabled
  useEffect(() => {
    if (settings.importShellHistory) {
      const fetchSystemHistory = async () => {
        try {
          interface ParsedHistoryItem { command: string; timestamp: number | null; }
          const items = await invoke<ParsedHistoryItem[]>("get_shell_history");
          setSystemHistory(items.map(i => i.command));
        } catch (err) {
          console.error("Failed to fetch system history:", err);
        }
      };
      fetchSystemHistory();
    } else {
      setSystemHistory([]);
    }
  }, [settings.importShellHistory]);

  const addToAppHistory = useCallback((cmd: string) => {
    if (!cmd.trim()) return;
    setAppHistory((prev) => {
      const newHistory = [cmd, ...prev.filter((h) => h !== cmd)].slice(0, 500);
      localStorage.setItem("axon-terminal-history", JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const sendRawData = useCallback((data: string) => {
    write(data);
  }, [write]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    sendRawData,
    focus: () => xtermRef.current?.focus()
  }));

  // Listen for snippet execution and broadcast events
  useEffect(() => {
    const handleRunSnippet = (e: Event) => {
      const customEvent = e as CustomEvent<{ command: string; tabId?: string }>;
      if (!customEvent.detail.tabId || customEvent.detail.tabId === tabId) {
        sendRawData(customEvent.detail.command);
      }
    };

    const handleBroadcast = (e: Event) => {
      const customEvent = e as CustomEvent<{ command: string }>;
      sendRawData(customEvent.detail.command);
    };

    window.addEventListener("axon-run-snippet", handleRunSnippet);
    window.addEventListener("axon-broadcast", handleBroadcast);

    return () => {
      window.removeEventListener("axon-run-snippet", handleRunSnippet);
      window.removeEventListener("axon-broadcast", handleBroadcast);
    };
  }, [sendRawData, tabId]);

  const { snippets, addToHistory } = useSnippets();

  const handleInput = useCallback((data: string) => {
    if (data === "\r") {
      const cmd = currentLineRef.current.trim();
      if (cmd) {
        addToHistory(cmd, undefined, hostId || 'local');
        addToAppHistory(cmd);
      }
      currentLineRef.current = "";
      setInputBuffer("");
    } else if (data === "\x7f") {
      if (currentLineRef.current.length > 0) {
        currentLineRef.current = currentLineRef.current.slice(0, -1);
        setInputBuffer(currentLineRef.current);
      }
    } else if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) {
      currentLineRef.current += data;
      setInputBuffer(currentLineRef.current);
    }
    sendRawData(data);
  }, [sendRawData, addToHistory, addToAppHistory, hostId]);

  const handleCompletion = useCallback((item: SuggestionItem) => {
    const term = xtermRef.current;
    if (!term) return;
    const remaining = item.command.slice(currentLineRef.current.length);
    if (remaining) {
      for (const char of remaining) {
        currentLineRef.current += char;
        sendRawData(char);
      }
      setInputBuffer(currentLineRef.current);
    }
    setSuggestions([]);
    setSelectedIndex(0);
    setTimeout(() => term.focus(), 10);
  }, [sendRawData]);

  const handleInputRef = useRef(handleInput);
  handleInputRef.current = handleInput;

  const handleCompletionRef = useRef(handleCompletion);
  handleCompletionRef.current = handleCompletion;

  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (!fitAddonRef.current || !xtermRef.current || !terminalRef.current) return;
      if (terminalRef.current.clientWidth === 0 || terminalRef.current.clientHeight === 0) return;

      try {
        fitAddonRef.current.fit();
        const cols = xtermRef.current.cols;
        const rows = xtermRef.current.rows;

        if (!cols || !rows || cols <= 2 || rows <= 2) return;

        if (
          !lastDimensionsRef.current ||
          lastDimensionsRef.current.cols !== cols ||
          lastDimensionsRef.current.rows !== rows
        ) {
          resize(cols, rows);
          lastDimensionsRef.current = { cols, rows };
        }
      } catch (e) {
        console.warn("Terminal fit/resize failed:", e);
      }
    }, 100);
  }, [resize]);

  // Update theme dynamically when it changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = XTERM_THEMES[theme === 'dark' ? 'dark' : 'light'];
    }
  }, [theme]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.cursorStyle = settings.cursorStyle;
    }
  }, [settings.cursorStyle]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: settings.cursorStyle,
      fontSize: settings.fontSize,
      lineHeight: 1.2,
      fontFamily: settings.fontFamily,
      scrollback: settings.scrollback,
      theme: XTERM_THEMES[theme === 'dark' ? 'dark' : 'light'],
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Initial fit must be synchronous before connection to prevent Zsh '%' artifact
    // caused by spawning at 80x24 and instantly resizing to actual dimensions.
    try {
      // Ensure element is visible before fitting
      if (terminalRef.current.clientWidth > 0) {
        fitAddon.fit();
      }
    } catch (e) {
      // ignore
    }

    if (isFocused) term.focus();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => handleInputRef.current(data));

    // Custom key handler for suggestions
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      if (suggestionsRef.current.length > 0) {
        if (e.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % (suggestionsRef.current.length + 1));
          return false;
        }
        if (e.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + (suggestionsRef.current.length + 1)) % (suggestionsRef.current.length + 1));
          return false;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          if (selectedIndexRef.current > 0) {
            handleCompletionRef.current(suggestionsRef.current[selectedIndexRef.current - 1]);
            return false;
          }
        }
        if (e.key === "Escape") {
          setSuggestions([]);
          return false;
        }
      }
      return true;
    });

    let reconnectInterval: ReturnType<typeof setInterval> | null = null;

    const initConnection = async () => {
      // Wait for a small delay to allow UI layout to settle
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        // Ensure we have an accurate initial fit before connecting
        if (fitAddonRef.current && terminalRef.current && terminalRef.current.clientWidth > 0) {
          try {
            fitAddonRef.current.fit();
          } catch (e) {
            console.warn("Initial fit failed:", e);
          }
        }

        const host = getHost(hostId);
        const cols = xtermRef.current?.cols || 80;
        const rows = xtermRef.current?.rows || 24;

        term.writeln(`\x1b[1;34mOpening terminal for ${host?.name || "Local"} (${host?.address || "localhost"})...\x1b[0m`);

        await connect(
          terminalSessionId,
          cols,
          rows,
          (data) => {
            term.write(data);
          },
          (status, message) => {
            if (status === "error") {
              term.writeln(`\r\n\x1b[1;31m[Error] ${message || "Connection failed"}\x1b[0m`);
            } else if (status === "closed") {
              term.writeln(`\r\n\x1b[1;33m[Session Closed] ${message || "Terminal exited"}\x1b[0m`);
            }

            const isNormalExit = status === "closed" && message === "exited";

            if ((status === "error" || (status === "closed" && !isNormalExit)) && settings.autoReconnect) {
              let countdown = 3;
              term.writeln(`\r\n\x1b[1;36m[Auto Reconnect] Retrying in ${countdown} seconds...\x1b[0m`);

              if (reconnectInterval) clearInterval(reconnectInterval);

              reconnectInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                  term.write(`\r\x1b[K\x1b[1;36m[Auto Reconnect] Retrying in ${countdown} seconds...\x1b[0m`);
                } else {
                  if (reconnectInterval) clearInterval(reconnectInterval);
                  term.writeln(`\r\x1b[K\x1b[1;32m[Auto Reconnect] Reconnecting now...\x1b[0m`);
                  initConnection();
                }
              }, 1000);
            }
          },
        );
      } catch (err) {
        term.writeln(`\x1b[1;31mTerminal Error: ${err}\x1b[0m`);
        term.writeln("\x1b[1;33mPlease check your host configuration and network.\x1b[0m");
      }
    };

    initConnection();

    // Use ResizeObserver instead of window.resize to catch DOM layout changes (e.g. Broadcast bar)
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        handleResize();
      });
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      if (reconnectInterval) clearInterval(reconnectInterval);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      disconnect();
    };
  }, [hostId, id, connect, disconnect, handleResize]); // Removed theme and getHost to prevent unnecessary reconnections

  useEffect(() => {
    if (isFocused && xtermRef.current) {
      xtermRef.current.focus();
      setTimeout(() => {
        handleResize();
      }, 50);
    }
  }, [isFocused, handleResize]);

  useEffect(() => {
    const trimmed = inputBuffer.trim();
    if (!trimmed || settings.autocomplete === 'disabled') {
      setSuggestions([]);
      setSelectedIndex(0);
      return;
    }
    const results: SuggestionItem[] = [];
    snippets.forEach((s) => {
      if (s.command.toLowerCase().startsWith(trimmed.toLowerCase()))
        results.push({ type: "snippet", command: s.command, label: s.name });
    });
    appHistory.forEach((h) => {
      if (h.toLowerCase().startsWith(trimmed.toLowerCase()) && !results.some((r) => r.command === h))
        results.push({ type: "history", command: h });
    });
    if (settings.importShellHistory) {
      systemHistory.forEach((h) => {
        if (h.toLowerCase().startsWith(trimmed.toLowerCase()) && !results.some((r) => r.command === h))
          results.push({ type: "history", command: h });
      });
    }
    setSuggestions(results.slice(0, MAX_SUGGESTIONS));
    setSelectedIndex(0);
  }, [inputBuffer, appHistory, systemHistory, snippets, settings.importShellHistory, settings.autocomplete]);

  return (
    <div
      className={`relative flex-1 flex flex-col bg-terminal overflow-hidden ${isFocused ? "ring-1 ring-inset ring-accent/50" : ""}`}
      onClick={() => onClick?.(id)}
    >
      <SuggestionPopup
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        inputBuffer={inputBuffer}
        isFocused={isFocused}
        xtermRef={xtermRef}
        terminalRef={terminalRef}
        onSelect={handleCompletion}
      />
      <TerminalToolbar
        isFocused={isFocused}
        hostId={hostId}
        xtermRef={xtermRef}
        onClose={onClose ? () => onClose(id) : undefined}
      />
      <div className="flex-1 w-full h-full pl-3 pt-2 pr-0.5 overflow-hidden">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
}));

TerminalPane.displayName = "TerminalPane";
