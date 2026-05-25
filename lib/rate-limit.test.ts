import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(`test-allow-${Date.now()}-x`, 5);
      expect(r.ok).toBe(true);
    }
  });

  it("blocks after exceeding the limit", () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3);
    const fourth = rateLimit(key, 3);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("resets after the window", () => {
    const key = `test-window-${Date.now()}`;
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it("returns correct remaining count", () => {
    const key = `test-remain-${Date.now()}`;
    const a = rateLimit(key, 10);
    const b = rateLimit(key, 10);
    expect(a.remaining).toBe(9);
    expect(b.remaining).toBe(8);
  });
});
