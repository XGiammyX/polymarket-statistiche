/** Advice model configuration — NO ML, pure statistical log-odds */

// Log-odds model weights
export const K_POS = 0.8;    // Weight for net position pressure signal
export const K_FLOW = 1.2;   // Weight for recent flow pressure signal

// Time decay
export const HALF_LIFE_HOURS = 48;   // Half-life for trade recency weighting
export const WINDOW_HOURS = 72;      // Look-back window for flow calculation

// Numerical stability
export const EPS = 1e-9;

// Confidence defaults
export const DEFAULT_CONFIDENCE_NO_DATA = 10;

// Batch size for cron
export const BATCH_SIZE = 50;

// Cron lock key
export const LOCK_KEY = 9004;
