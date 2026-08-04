import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company";
import { hasPermission, type PermissionKey, type PermissionMap } from "@/lib/permissions";

export function usePermissions() {
  const { isSuperAdmin, memberships, loading } = useAuth();
  const { activeCompany } = useCompany();

  return useMemo(() => {
    const membership = memberships.find((m) => m.companyId === activeCompany?.id) ?? null;
    const role = isSuperAdmin ? "super_admin" : membership?.role ?? null;
    const permissions: PermissionMap = membership?.permissions ?? {};
    return {
      loading,
      role,
      membership,
      permissions,
      isAdmin: role === "super_admin" || role === "company_admin",
      isReceptionist: role === "receptionist",
      isProfessional: role === "staff",
      can: (key: PermissionKey) => hasPermission(role, permissions, key),
    };
  }, [isSuperAdmin, memberships, activeCompany?.id, loading]);
}
