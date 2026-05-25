"use client";
/**
 * DashboardBackground — calmer fixed backdrop for the post-login surfaces.
 *
 * Built deliberately quieter than PageBackground:
 *   - no central halo (would compete with dashboard cards)
 *   - one soft amber glow anchored to the top-right corner
 *   - one cool tint anchored to the bottom-left
 *   - faint dot grid masked to a horizon ellipse
 *   - very sparse sparkles
 *   - heavy edge vignette so content reads as the focal point
 */
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Sparkles } from "@/components/spectrum-ui/sparkles";

export function DashboardBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Faint dot grid — masked to centre */}
      <DotPattern
        width={32}
        height={32}
        cr={1}
        className="opacity-30 [mask-image:radial-gradient(ellipse_at_50%_30%,white_15%,transparent_75%)]"
      />

      {/* Soft amber glow — top right corner */}
      <div
        className="absolute -right-40 -top-40 h-[700px] w-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 182, 39, 0.10), transparent 65%)",
        }}
      />

      {/* Cool tint — bottom left */}
      <div
        className="absolute -bottom-32 -left-32 h-[560px] w-[560px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(107, 174, 214, 0.08), transparent 65%)",
        }}
      />

      {/* Sparkles — very sparse, small */}
      <Sparkles count={16} maxSize={2} />

      {/* Edge vignette — heavy so content area stays the focus */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 45%, transparent 45%, rgba(10, 14, 20, 0.6) 90%, rgba(10, 14, 20, 0.85) 100%)",
        }}
      />
    </div>
  );
}
