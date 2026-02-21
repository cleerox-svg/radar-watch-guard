/**
 * useIdleTimeout.ts — Detects user inactivity and triggers a warning
 * modal before auto-logout. Configurable timeout per user profile.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface UseIdleTimeoutOptions {
  /** Idle threshold in minutes before warning appears */
  timeoutMinutes: number;
  /** Seconds to show the warning before auto-logout */
  warningSeconds?: number;
  /** Callback when auto-logout fires */
  onTimeout: () => void;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export function useIdleTimeout({
  timeoutMinutes,
  warningSeconds = 60,
  onTimeout,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    idleTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const startIdleTimer = useCallback(() => {
    clearTimers();
    if (!enabled || timeoutMinutes <= 0) return;

    const idleMs = timeoutMinutes * 60 * 1000;
    idleTimerRef.current = setTimeout(() => {
      // Idle threshold hit — show warning
      setShowWarning(true);
      setSecondsRemaining(warningSeconds);

      let remaining = warningSeconds;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          clearTimers();
          setShowWarning(false);
          onTimeoutRef.current();
        }
      }, 1000);
    }, idleMs);
  }, [enabled, timeoutMinutes, warningSeconds, clearTimers]);

  /** User clicked "Stay Signed In" — reset everything */
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    setSecondsRemaining(warningSeconds);
    startIdleTimer();
  }, [warningSeconds, startIdleTimer]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];

    const resetOnActivity = () => {
      if (!showWarning) {
        startIdleTimer();
      }
    };

    activityEvents.forEach((evt) => document.addEventListener(evt, resetOnActivity, { passive: true }));
    startIdleTimer();

    return () => {
      activityEvents.forEach((evt) => document.removeEventListener(evt, resetOnActivity));
      clearTimers();
    };
  }, [enabled, startIdleTimer, clearTimers, showWarning]);

  return { showWarning, secondsRemaining, dismissWarning };
}
