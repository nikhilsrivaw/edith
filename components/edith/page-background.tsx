"use client";
/**
 * PageBackground — fixed, viewport-pinned ambient backdrop used across every
 * marketing page (landing, pricing, docs, changelog).
 *
 * Eight layers stacked from base to top:
 *   1. Animated grid pattern — squares fade in and out across a grid
 *   2. Static dot grid — fills negative space
 *   3-5. Three colour halos (amber centre · cool blue top-left · warm bottom-right)
 *   6. Ground glow under the centre
 *   7. Sparkles — drifting motion
 *   8. Edge vignette — frames the content
 */
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Sparkles } from "@/components/spectrum-ui/sparkles";

export function PageBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <AnimatedGridPattern
        width={54}
        height={54}
        numSquares={38}
        maxOpacity={0.32}
        duration={3}
        className="[mask-image:radial-gradient(ellipse_at_50%_40%,white_25%,transparent_85%)]"
      />
      <DotPattern
        width={28}
        height={28}
        cr={1.2}
        className="opacity-50 [mask-image:radial-gradient(ellipse_at_50%_40%,white_30%,transparent_80%)]"
      />

      {/* Primary halo — amber, centre */}
      <div
        className="absolute left-1/2 top-[34%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 182, 39, 0.22), transparent 60%)",
        }}
      />
      {/* Secondary halo — cool blue, top-left */}
      <div
        className="absolute -left-32 -top-32 h-[560px] w-[560px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(107, 174, 214, 0.18), transparent 65%)",
        }}
      />
      {/* Tertiary halo — warm red, bottom-right */}
      <div
        className="absolute -bottom-40 -right-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(248, 113, 113, 0.12), transparent 65%)",
        }}
      />
      {/* Ground glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-[380px]"
        style={{
          background:
            "linear-gradient(to top, rgba(255, 182, 39, 0.14), transparent 85%)",
        }}
      />

      <Sparkles count={44} maxSize={3} />

      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, transparent 55%, rgba(10, 14, 20, 0.45) 92%, rgba(10, 14, 20, 0.75) 100%)",
        }}
      />
    </div>
  );
}
