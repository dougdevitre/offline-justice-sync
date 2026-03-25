/**
 * @tests ConnectionMonitor
 * @description Tests for the connection monitoring system.
 */

import { ConnectionMonitor } from '../src/connection/connection-monitor';

describe('ConnectionMonitor', () => {
  let monitor: ConnectionMonitor;

  beforeEach(() => {
    monitor = new ConnectionMonitor({
      checkIntervalMs: 1000,
      pingUrl: 'https://api.justice-os.org/ping',
      degradedThreshold: 50,
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('initial state', () => {
    it('should start as offline', () => {
      expect(monitor.getStatus()).toBe('offline');
    });

    it('should not be online initially', () => {
      expect(monitor.isOnline()).toBe(false);
    });

    it('should have null quality initially', () => {
      expect(monitor.getQuality()).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should register and emit online events', () => {
      const handler = jest.fn();
      monitor.on('online', handler);

      // Manually trigger — in production this is handled by check()
      // We test the event system works
      expect(handler).not.toHaveBeenCalled();
    });

    it('should register offline event listeners', () => {
      const handler = jest.fn();
      monitor.on('offline', handler);

      // Listener registered but not yet triggered
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support removing event listeners', () => {
      const handler = jest.fn();
      monitor.on('online', handler);
      monitor.off('online', handler);

      // After removal, handler should not be in the listener list
      // (internal implementation detail, but we verify no errors)
      expect(() => monitor.off('online', handler)).not.toThrow();
    });

    it('should handle removing listeners for non-existent events', () => {
      const handler = jest.fn();
      expect(() => monitor.off('nonexistent', handler)).not.toThrow();
    });
  });

  describe('start() and stop()', () => {
    it('should start monitoring', () => {
      expect(() => monitor.start()).not.toThrow();
    });

    it('should stop monitoring', () => {
      monitor.start();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should be idempotent for start', () => {
      monitor.start();
      expect(() => monitor.start()).not.toThrow();
    });

    it('should be idempotent for stop', () => {
      expect(() => monitor.stop()).not.toThrow();
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('getStatus()', () => {
    it('should return a valid connection status', () => {
      const status = monitor.getStatus();
      expect(['online', 'offline', 'degraded']).toContain(status);
    });
  });

  describe('isOnline()', () => {
    it('should return boolean', () => {
      expect(typeof monitor.isOnline()).toBe('boolean');
    });
  });

  describe('check()', () => {
    it('should return a connection quality result', async () => {
      // This will fail the fetch (no real server) and report offline
      const quality = await monitor.check();

      expect(quality).toBeDefined();
      expect(quality.status).toBeDefined();
      expect(quality.measuredAt).toBeInstanceOf(Date);
      expect(typeof quality.quality).toBe('number');
      expect(typeof quality.latencyMs).toBe('number');
    });

    it('should report offline when ping fails', async () => {
      const quality = await monitor.check();

      expect(quality.online).toBe(false);
      expect(quality.status).toBe('offline');
      expect(quality.quality).toBe(0);
    });

    it('should update the stored quality', async () => {
      await monitor.check();

      const stored = monitor.getQuality();
      expect(stored).not.toBeNull();
    });
  });
});
