import {
  Accessibility,
  Activity,
  Box,
  Database,
  GitBranch,
  Globe,
  Package,
  Rocket,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Dimension } from "@/lib/mock-data";

export const DIM_ICON: Record<Dimension, LucideIcon> = {
  security: Shield,
  performance: Zap,
  reliability: Activity,
  data_safety: Database,
  business_logic: GitBranch,
  deploy_readiness: Rocket,
  ai_surface: Sparkles,
  accessibility: Accessibility,
  dependencies: Package,
  seo: Globe,
};

export function DimIcon({
  dim,
  className,
}: {
  dim: Dimension;
  className?: string;
}) {
  const Icon = DIM_ICON[dim];
  return <Icon className={className} strokeWidth={1.5} />;
}
