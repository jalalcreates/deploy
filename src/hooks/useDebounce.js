"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Professional debounce hook
 * Delays execution until user stops typing for the specified delay
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {any} - Debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce callback hook
 * Returns a debounced version of the callback function
 * @param {Function} callback - The function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Function} - Debounced callback
 */
export function useDebouncedCallback(callback, delay = 300) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Throttle hook
 * Limits execution to once per specified interval
 * @param {Function} callback - The function to throttle
 * @param {number} limit - Time limit in milliseconds (default: 300ms)
 * @returns {Function} - Throttled callback
 */
export function useThrottle(callback, limit = 300) {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= limit) {
        // Enough time has passed, execute immediately
        callbackRef.current(...args);
        lastRun.current = now;
      } else {
        // Not enough time has passed, schedule for later
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(
          () => {
            callbackRef.current(...args);
            lastRun.current = Date.now();
          },
          limit - timeSinceLastRun
        );
      }
    },
    [limit]
  );
}

/**
 * Combined debounce + throttle hook
 * Provides both immediate feedback (throttle) and final value (debounce)
 * @param {any} value - The value to process
 * @param {object} options - Configuration options
 * @returns {object} - Both throttled and debounced values
 */
export function useDebouncedThrottle(value, options = {}) {
  const { debounceDelay = 500, throttleDelay = 150 } = options;

  const [throttledValue, setThrottledValue] = useState(value);
  const [debouncedValue, setDebouncedValue] = useState(value);

  const lastUpdateRef = useRef(Date.now());
  const debounceTimeoutRef = useRef(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Throttle: Update immediately if enough time has passed
    if (timeSinceLastUpdate >= throttleDelay) {
      setThrottledValue(value);
      lastUpdateRef.current = now;
    }

    // Debounce: Always clear and reset the debounce timer
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      setThrottledValue(value); // Ensure final value is consistent
    }, debounceDelay);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [value, debounceDelay, throttleDelay]);

  return {
    throttledValue, // For immediate UI feedback
    debouncedValue, // For expensive operations like API calls
    isDebouncing: throttledValue !== debouncedValue,
  };
}
