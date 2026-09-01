import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company";
import { hasPermission, type PermissionKey, type PermissionMap } from "@/lib/permissions";
import { PERMISSION_FEATURE, usePlanFeatures } from "@/lib/use-plan-features";

export function usePermissions() {
  const { isSuperAdmin, memberships, loading } = useAuth();
  const { activeCompany } = useCompany();
  const plan = usePlanFeatures();

  return useMemo(() => {
    const membership = memberships.find((m) => m.companyId === activeCompany?.id) ?? null;
    const role = isSuperAdmin ? "super_admin" : membership?.role ?? null;
    const permissions: PermissionMap = membership?.permissions ?? {};

    const can = (key: PermissionKey) => {
      if (!hasPermission(role, permissions, key)) return false;
      if (isSuperAdmin) return true;
      const feature = PERMISSION_FEATURE[key];
      return !feature || plan.hasFeature(feature);
    };

    return {
      loading: loading || plan.loading,
      role,
      membership,
      permissions,
      planCode: plan.planCode,
      planFeatures: plan.features,
      maxUsers: plan.maxUsers,
      hasFeature: plan.hasFeature,
      isAdmin: role === "super_admin" || role === "company_admin",
      isReceptionist: role === "receptionist",
      isProfessional: role === "staff",
      can,
    };
  }, [isSuperAdmin, memberships, activeCompany?.id, loading, plan.loading, plan.planCode, plan.features, plan.maxUsers]);
}
