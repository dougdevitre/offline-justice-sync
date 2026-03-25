/**
 * @module ConnectionMonitor
 * @description Monitors network connectivity and quality. Detects online/offline
 * transitions, measures latency and bandwidth, and emits events for adaptive
 * behavior. Works in both browser and Node.js environments.
 */

import type { ConnectionQuality, ConnectionMonitorConfig, ConnectionStatus } from '../types';

/**
 * Default monitor configuration
 */
const DEFAULT_CONFIG: Required<ConnectionMonitorConfig> = {
  checkIntervalMs: 5000,
  pingUrl: 'https://api.justice-os.org/ping',
  degradedThreshold: 50,
};

/**
 * ConnectionMonitor detects network state changes and measures
 * connection quality for adaptive sync behavior.
 *
 * @example
 * ```typescript
 * const monitor = new ConnectionMonitor({ checkIntervalMs: 3000 });
 * monitor.on('online', (quality) => console.log('Online!', quality));
 * monitor.on('offline', () => console.log('Offline'));
 * monitor.on('degraded', (quality) => console.log('Slow connection', quality));
 * monitor.start();
 * ```
 */
export class ConnectionMonitor {
  private config: Required<ConnectionMonitorConfig>;
  private currentStatus: ConnectionStatus = 'offline';
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
  private lastQuality: ConnectionQuality | null = null;

  /**
   * Create a new ConnectionMonitor.
   * @param config - Monitor configuration
   */
  constructor(config: Partial<ConnectionMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring the connection.
   */
  start(): void {
    if (this.intervalId) return;

    // Initial check
    this.check();

    // Periodic checks
    this.intervalId = setInterval(() => this.check(), this.config.checkIntervalMs);

    // Browser online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.check());
      window.addEventListener('offline', () => this.handleStatusChange('offline'));
    }
  }

  /**
   * Stop monitoring.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Perform a connection quality check.
   * @returns Current connection quality
   */
  async check(): Promise<ConnectionQuality> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.config.pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      const latencyMs = Date.now() - startTime;
      const quality = this.calculateQuality(latencyMs);

      const connectionQuality: ConnectionQuality = {
        online: true,
        status: quality >= this.config.degradedThreshold ? 'online' : 'degraded',
        quality,
        latencyMs,
        bandwidthKbps: this.estimateBandwidth(latencyMs),
        measuredAt: new Date(),
      };

      this.lastQuality = connectionQuality;
      this.handleStatusChange(connectionQuality.status, connectionQuality);

      return connectionQuality;
    } catch {
      const offlineQuality: ConnectionQuality = {
        online: false,
        status: 'offline',
        quality: 0,
        latencyMs: 0,
        bandwidthKbps: 0,
        measuredAt: new Date(),
      };

      this.lastQuality = offlineQuality;
      this.handleStatusChange('offline');

      return offlineQuality;
    }
  }

  /**
   * Get the current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Get the last measured connection quality.
   */
  getQuality(): ConnectionQuality | null {
    return this.lastQuality;
  }

  /**
   * Check if currently online.
   */
  isOnline(): boolean {
    return this.currentStatus === 'online' || this.currentStatus === 'degraded';
  }

  /**
   * Register an event listener.
   * @param event - Event name ('online', 'offline', 'degraded')
   * @param callback - Callback function
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove an event listener.
   * @param event - Event name
   * @param callback - Callback to remove
   */
  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter((cb) => cb !== callback));
    }
  }

  /**
   * Handle a status change and emit events.
   */
  private handleStatusChange(newStatus: ConnectionStatus, quality?: ConnectionQuality): void {
    const previousStatus = this.currentStatus;
    this.currentStatus = newStatus;

    if (previousStatus !== newStatus) {
      this.emit(newStatus, quality);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  /**
   * Calculate quality score from latency.
   */
  private calculateQuality(latencyMs: number): number {
    if (latencyMs <= 100) return 100;
    if (latencyMs <= 300) return 80;
    if (latencyMs <= 1000) return 60;
    if (latencyMs <= 3000) return 30;
    return 10;
  }

  /**
   * Estimate bandwidth from ping latency (rough approximation).
   */
  private estimateBandwidth(latencyMs: number): number {
    // Very rough estimate — real implementation would measure actual throughput
    if (latencyMs <= 50) return 10000; // ~10 Mbps
    if (latencyMs <= 200) return 5000;
    if (latencyMs <= 500) return 1000;
    if (latencyMs <= 1000) return 500;
    return 100; // Very slow
  }
}
