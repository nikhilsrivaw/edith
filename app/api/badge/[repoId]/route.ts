/**
 * Public EDITH score badge.
 *
 * Returns an SVG you can embed in your README:
 *   ![EDITH](https://edith.expert/api/badge/<repoId>)
 *
 * Uses mock data when EDITH_USE_FIXTURES=1; otherwise reads from the DB.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getRepo, getLatestScan } from "@/lib/mock-data";

export const runtime = "nodejs";

function badgeSvg(score: number | null, label = "edith") {
  const value = score === null ? "—" : `${score}/100`;
  const tone =
    score === null
      ? "#7A8896"
      : score >= 85
        ? "#4ADE80"
        : score >= 65
          ? "#FFB627"
          : "#F87171";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#0A0E14"/>
    <stop offset="1" stop-color="#0F141C"/>
  </linearGradient>
  <rect rx="3" width="120" height="20" fill="url(#s)"/>
  <rect rx="3" x="55" width="65" height="20" fill="${tone}" fill-opacity="0.18"/>
  <text x="28" y="14" fill="#E6EDF5" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="11" text-anchor="middle">${label}</text>
  <text x="87" y="14" fill="${tone}" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="11" font-weight="600" text-anchor="middle">${value}</text>
</svg>`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await ctx.params;

  let score: number | null = null;
  if (env.USE_FIXTURES) {
    const repo = getRepo(repoId);
    const scan = repo ? getLatestScan(repo.id) : undefined;
    score = scan?.scoreEdith ?? null;
  } else {
    // TODO: select latest scan from supabase
  }

  return new NextResponse(badgeSvg(score), {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
