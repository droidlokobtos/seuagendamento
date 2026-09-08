import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProfessionalDashboard } from "@/components/app/ProfessionalDashboard";
import { usePermissions } from "@/lib/use-permissions";

export const Route = createFileRoute("/_authenticated/app/professional")({
  validateSearch: z.object({ staff: z.string().uuid().optional() }),
  component: ProfessionalPanel,
});

function ProfessionalPanel() {
  const { staff } = Route.useSearch();
  const { isAdmin } = usePermissions();
  return <ProfessionalDashboard requestedStaffId={staff} preview={isAdmin} />;
}
