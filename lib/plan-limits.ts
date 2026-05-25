/**
 * Plan-tier limits + enforcement helpers.
 *
 * The schema enum is: 'free' | 'builder' | 'pro' | 'agency'.
 * Limits are advisory until billing is fully wired — checked at action time,
 * not enforced at the database layer.
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";
import type { Plan } from "./mock-data";

export type PlanLimits = {
  repos: number;             // -1 = unlimited
  scansPerMonth: number;     // -1 = unlimited
  scanFrequency: "weekly" | "daily" | "realtime";
  fixPromptsPerMonth: number;
  customRules: boolean;
  runtimeProbes: boolean;
  slackDigest: boolean;
  whiteLabel: boolean;
  clientWorkspaces: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    repos: 1,
    scansPerMonth: 4,
    scanFrequency: "weekly",
    fixPromptsPerMonth: 10,
    customRules: false,
    runtimeProbes: false,
    slackDigest: false,
    whiteLabel: false,
    clientWorkspaces: false,
  },
  builder: {
    repos: 5,
    scansPerMonth: 150,
    scanFrequency: "daily",
    fixPromptsPerMonth: 200,
    customRules: false,
    runtimeProbes: false,
    slackDigest: true,
    whiteLabel: false,
    clientWorkspaces: false,
  },
  pro: {
    repos: -1,
    scansPerMonth: -1,
    scanFrequency: "realtime",
    fixPromptsPerMonth: -1,
    customRules: true,
    runtimeProbes: true,
    slackDigest: true,
    whiteLabel: false,
    clientWorkspaces: false,
  },
  agency: {
    repos: -1,
    scansPerMonth: -1,
    scanFrequency: "realtime",
    fixPromptsPerMonth: -1,
    customRules: true,
    runtimeProbes: true,
    slackDigest: true,
    whiteLabel: true,
    clientWorkspaces: true,
  },
};

/** Find the active plan for an org. Treats `trialing` as the plan they signed up for. */
export async function getOrgPlan(orgId: string): Promise<Plan> {
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .maybeSingle();
  type O = { plan: Plan };
  return ((org as O | null)?.plan ?? "free") as Plan;
}

export type LimitCheck = {
  allowed: boolean;
  reason?: string;
  limit?: number;
  used?: number;
  plan: Plan;
};

/**
 * Can this org connect another repo?
 */
export async function canConnectRepo(orgId: string): Promise<LimitCheck> {
  const plan = await getOrgPlan(orgId);
  const limits = PLAN_LIMITS[plan];
  if (limits.repos === -1) return { allowed: true, plan };

  const admin = getSupabaseAdmin();
  const { count } = await admin
    .from("repositories")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("archived_at", null);
  const used = count ?? 0;
  if (used >= limits.repos) {
    return {
      allowed: false,
      plan,
      limit: limits.repos,
      used,
      reason: `${plan} plan allows ${limits.repos} repo${limits.repos === 1 ? "" : "s"}; you have ${used}. Upgrade for more.`,
    };
  }
  return { allowed: true, plan, limit: limits.repos, used };
}

/**
 * Can this org run another scan this month?
 */
export async function canRunScan(orgId: string): Promise<LimitCheck> {
  const plan = await getOrgPlan(orgId);
  const limits = PLAN_LIMITS[plan];
  if (limits.scansPerMonth === -1) return { allowed: true, plan };

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const admin = getSupabaseAdmin();
  const { count } = await admin
    .from("scans")
    .select("id, repositories!inner(org_id)", { count: "exact", head: true })
    .eq("repositories.org_id", orgId)
    .gte("created_at", monthAgo);
  const used = count ?? 0;
  if (used >= limits.scansPerMonth) {
    return {
      allowed: false,
      plan,
      limit: limits.scansPerMonth,
      used,
      reason: `${plan} plan allows ${limits.scansPerMonth} scans/mo; you've used ${used}.`,
    };
  }
  return { allowed: true, plan, limit: limits.scansPerMonth, used };
}

/**
 * Is a paid feature available on this plan?
 */
export async function requiresPlan(
  orgId: string,
  feature: keyof Pick<
    PlanLimits,
    "customRules" | "runtimeProbes" | "slackDigest" | "whiteLabel" | "clientWorkspaces"
  >,
): Promise<LimitCheck> {
  const plan = await getOrgPlan(orgId);
  const limits = PLAN_LIMITS[plan];
  if (limits[feature]) return { allowed: true, plan };
  return {
    allowed: false,
    plan,
    reason: `${feature} requires a paid plan. You're on ${plan}.`,
  };
}
