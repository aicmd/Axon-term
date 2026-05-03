import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ConnectionState } from "../../types";
import { OpenTerminalResponse, TerminalOutputEvent, SessionStateEvent } from "./types";

/**
 * Custom hook to encapsulate terminal interaction logic.
 */
export const useTerminal = (hostId: string, termType: string, onStatusChange?: (state: ConnectionState) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>("idle");
  const sessionIdRef = useRef<string | null>(null);
  const isListenersReadyRef = useRef(false);

  // Track listeners to ensure cleanup
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenStateRef = useRef<(() => void) | null>(null);
  const onDataRef = useRef<((data: string) => void) | null>(null);
  const onStateChangeRef = useRef<((status: string, message?: string) => void) | null>(null);

  // Setup listeners once per component lifecycle
  useEffect(() => {
    let isCancelled = false;
    let localUnlistenOutput: (() => void) | null = null;
    let localUnlistenState: (() => void) | null = null;

    const setupListeners = async () => {
      if (isCancelled) return;

      const uo = await listen<TerminalOutputEvent>("terminal-output", (event) => {
        if (event.payload.sessionId === sessionIdRef.current) {
          onDataRef.current?.(event.payload.data);
        }
      });

      if (isCancelled) {
        uo();
      } else {
        localUnlistenOutput = uo;
        unlistenOutputRef.current = uo;
      }

      if (isCancelled) return;

      const us = await listen<SessionStateEvent>("session-state-changed", (event) => {
        if (event.payload.sessionId === sessionIdRef.current) {
          setSessionStatus(event.payload.status);
          onStateChangeRef.current?.(event.payload.status, event.payload.message);

          if (event.payload.status === "active") {
            setIsConnected(true);
            onStatusChange?.(ConnectionState.CONNECTED);
          } else if (event.payload.status === "connecting") {
            onStatusChange?.(ConnectionState.CONNECTING);
          } else if (event.payload.status === "closed") {
            setIsConnected(false);
            const isErrorExit = event.payload.message?.includes("Exited with code 255") ||
              event.payload.message?.includes("Connection refused");
            onStatusChange?.(isErrorExit ? ConnectionState.ERROR : ConnectionState.DISCONNECTED);
          } else if (event.payload.status === "error") {
            setIsConnected(false);
            onStatusChange?.(ConnectionState.ERROR);
          }
        }
      });

      if (isCancelled) {
        us();
      } else {
        localUnlistenState = us;
        unlistenStateRef.current = us;
        isListenersReadyRef.current = true;
      }
    };

    setupListeners();

    return () => {
      isCancelled = true;
      if (localUnlistenOutput) localUnlistenOutput();
      if (localUnlistenState) localUnlistenState();
      unlistenOutputRef.current = null;
      unlistenStateRef.current = null;
    };
  }, [onStatusChange]);

  const connect = useCallback(async (
    terminalSessionId: string,
    cols: number,
    rows: number,
    onData: (data: string) => void,
    onStateChange?: (status: string, message?: string) => void,
  ) => {
    try {
      onDataRef.current = onData;
      onStateChangeRef.current = onStateChange || null;
      sessionIdRef.current = terminalSessionId;

      const response = await invoke<OpenTerminalResponse>("open_terminal", {
        sessionId: terminalSessionId,
        cols,
        rows,
        hostId: hostId || null,
        termType,
      });

      setIsConnected(true);
      setSessionStatus(response.status);
      return response.sessionId;
    } catch (err) {
      console.error("Terminal connect error:", err);
      throw err;
    }
  }, [hostId, termType]);

  const write = useCallback(async (input: string) => {
    if (!sessionIdRef.current) return;
    try {
      await invoke("write_terminal", {
        sessionId: sessionIdRef.current,
        input,
      });
    } catch (err) {
      console.error("Terminal write error:", err);
    }
  }, []);

  const resize = useCallback(async (cols: number, rows: number) => {
    if (!sessionIdRef.current || !isListenersReadyRef.current) return;
    try {
      await invoke("resize_terminal", {
        sessionId: sessionIdRef.current,
        cols,
        rows,
      });
    } catch (err) {
      console.error("Terminal resize error:", err);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await invoke("close_terminal", { sessionId: sessionIdRef.current }).catch(() => { });
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
    setIsConnected(false);
    setSessionStatus("closed");
  }, []);

  return { isConnected, sessionStatus, connect, write, resize, disconnect };
};
