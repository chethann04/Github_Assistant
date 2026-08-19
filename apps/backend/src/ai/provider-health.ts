import { config } from '../config/env.js';

export interface ProviderHealthState {
  available: boolean;
  cooldownUntil: number | null;
  lastFailureReason?: string;
  lastFailureStatus?: number;
  lastFailureTimestamp?: number;
}

export type SupportedProviderId = 'openrouter' | 'nvidia' | 'gemini' | 'openai' | string;

/**
 * ProviderHealthManager — Centralized singleton managing provider health,
 * rate limit and 402 cooldown timers, concurrency-safe cooldown tracking, and automatic recovery.
 */
export class ProviderHealthManager {
  private static states: Map<string, ProviderHealthState> = new Map([
    ['openrouter', { available: true, cooldownUntil: null }],
    ['nvidia', { available: true, cooldownUntil: null }],
    ['gemini', { available: true, cooldownUntil: null }],
    ['openai', { available: true, cooldownUntil: null }],
  ]);

  private static getDefaultCooldown(providerId: string): number {
    const id = providerId.toLowerCase();
    if (id === 'openrouter') return config.openrouterCooldownMs || 60000;
    if (id === 'nvidia') return config.nvidiaCooldownMs || 60000;
    if (id === 'gemini') return config.geminiCooldownMs || 60000;
    return 60000;
  }

  private static getOrCreateState(providerId: string): ProviderHealthState {
    const id = providerId.toLowerCase();
    let state = this.states.get(id);
    if (!state) {
      state = { available: true, cooldownUntil: null };
      this.states.set(id, state);
    }
    return state;
  }

  /**
   * Check if a specific provider is currently in active cooldown.
   */
  public static isProviderInCooldown(providerId: string): boolean {
    const state = this.getOrCreateState(providerId);
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
      return true;
    }
    return false;
  }

  /**
   * Get remaining cooldown time in milliseconds for a provider.
   */
  public static getCooldownRemainingMs(providerId: string): number {
    const state = this.getOrCreateState(providerId);
    if (state.cooldownUntil) {
      const remaining = state.cooldownUntil - Date.now();
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  }

  /**
   * Mark a provider as temporarily unavailable / rate-limited with a cooldown.
   * Concurrency-safe: if already in cooldown, preserves the current active cooldown window.
   */
  public static markProviderUnavailable(
    providerId: string,
    reason: string = 'RATE_LIMIT',
    status?: number,
    durationMs?: number
  ): {
    activated: boolean;
    cooldownUntil: number;
    durationMs: number;
  } {
    const id = providerId.toLowerCase();
    const state = this.getOrCreateState(id);
    const now = Date.now();
    const effectiveDuration =
      typeof durationMs === 'number' && durationMs > 0
        ? durationMs
        : this.getDefaultCooldown(id);

    // Concurrency safety: if cooldown is already active and unexpired, do not keep bumping the timer
    if (state.cooldownUntil && now < state.cooldownUntil) {
      return {
        activated: false,
        cooldownUntil: state.cooldownUntil,
        durationMs: state.cooldownUntil - now,
      };
    }

    const cooldownUntil = now + effectiveDuration;
    state.available = false;
    state.cooldownUntil = cooldownUntil;
    state.lastFailureReason = reason;
    state.lastFailureStatus = status;
    state.lastFailureTimestamp = now;

    return {
      activated: true,
      cooldownUntil,
      durationMs: effectiveDuration,
    };
  }

  /**
   * Checks whether any provider cooldowns have expired and automatically restores them.
   * Logs restoration cleanly.
   */
  public static checkAndRestoreProviders(): string[] {
    const now = Date.now();
    const restored: string[] = [];

    for (const [id, state] of this.states.entries()) {
      if (state.cooldownUntil && now >= state.cooldownUntil) {
        state.available = true;
        state.cooldownUntil = null;
        restored.push(id);

        if (id === 'openrouter') {
          console.log('[AI] OpenRouter cooldown expired');
          console.log('[AI] Restoring OpenRouter as highest-priority provider');
        } else if (id === 'nvidia') {
          console.log('[AI] NVIDIA NIM cooldown expired');
          console.log('[AI] Restoring NVIDIA NIM provider');
        } else if (id === 'gemini') {
          console.log('[AI] Google Gemini cooldown expired');
          console.log('[AI] Restoring Google Gemini provider');
        } else {
          console.log(`[AI] ${id} cooldown expired and provider restored`);
        }
      }
    }

    return restored;
  }

  /**
   * Get current health state of a provider.
   */
  public static getProviderState(providerId: string): Readonly<ProviderHealthState> {
    return { ...this.getOrCreateState(providerId) };
  }

  /**
   * Set cooldown expiration timestamp directly (for testing cooldown expiration & recovery).
   */
  public static setProviderCooldownUntilForTesting(providerId: string, timestamp: number | null): void {
    const state = this.getOrCreateState(providerId);
    state.cooldownUntil = timestamp;
    if (timestamp === null || (timestamp && Date.now() >= timestamp)) {
      state.available = true;
    } else {
      state.available = false;
    }
  }

  // Backward compatibility helpers
  public static isNvidiaInCooldown(): boolean {
    return this.isProviderInCooldown('nvidia');
  }

  public static getNvidiaCooldownRemainingMs(): number {
    return this.getCooldownRemainingMs('nvidia');
  }

  public static markNvidiaRateLimited(durationMs?: number) {
    return this.markProviderUnavailable('nvidia', '429 RATE_LIMIT', 429, durationMs);
  }

  public static checkAndRestoreNvidia(): boolean {
    const restored = this.checkAndRestoreProviders();
    return restored.includes('nvidia');
  }

  public static setNvidiaCooldownUntilForTesting(timestamp: number | null): void {
    this.setProviderCooldownUntilForTesting('nvidia', timestamp);
  }

  /**
   * Reset all provider states (for testing / manual refresh).
   */
  public static reset(): void {
    this.states = new Map([
      ['openrouter', { available: true, cooldownUntil: null }],
      ['nvidia', { available: true, cooldownUntil: null }],
      ['gemini', { available: true, cooldownUntil: null }],
      ['openai', { available: true, cooldownUntil: null }],
    ]);
  }
}
