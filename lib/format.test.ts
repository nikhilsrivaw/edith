import { describe, it, expect } from "vitest";
import { formatDuration, scoreColor, scoreTone, timeAgo } from "./format";

describe("formatDuration", () => {
  it("ms under 1s", () => {
    expect(formatDuration(500)).toBe("500ms");
  });
  it("seconds under 60", () => {
    expect(formatDuration(5500)).toBe("5.5s");
  });
  it("minutes + seconds", () => {
    expect(formatDuration(125_000)).toBe("2m 5s");
  });
});

describe("scoreTone / scoreColor", () => {
  it("good ≥ 85", () => {
    expect(scoreTone(85)).toBe("good");
    expect(scoreTone(100)).toBe("good");
    expect(scoreColor(90)).toBe("var(--success)");
  });
  it("warn 65..84", () => {
    expect(scoreTone(65)).toBe("warn");
    expect(scoreTone(84)).toBe("warn");
    expect(scoreColor(70)).toBe("var(--accent)");
  });
  it("bad < 65", () => {
    expect(scoreTone(64)).toBe("bad");
    expect(scoreTone(0)).toBe("bad");
    expect(scoreColor(30)).toBe("var(--danger)");
  });
});

describe("timeAgo", () => {
  it("seconds", () => {
    const t = new Date(Date.now() - 5000).toISOString();
    expect(timeAgo(t)).toMatch(/^[0-9]+s ago$/);
  });
  it("minutes", () => {
    const t = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(t)).toMatch(/^[0-9]+m ago$/);
  });
  it("hours", () => {
    const t = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(timeAgo(t)).toMatch(/^[0-9]+h ago$/);
  });
});
