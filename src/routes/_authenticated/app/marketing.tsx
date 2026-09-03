import { createFileRoute } from "@tanstack/react-router";
import { MarketingStudio } from "@/components/marketing/MarketingStudio";
import { useCompany } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/app/marketing")({
  component: CompanyMarketing,
  head: () => ({
    meta: [
      { title: "Marketing e publicidade" },
      { name: "description", content: "Estúdio de campanhas profissionais da empresa." },
    ],
  }),
});

function CompanyMarketing() {
  const { activeCompany } = useCompany();
  if (!activeCompany) return null;
  return <MarketingStudio key={activeCompany.id} scope="company" companyId={activeCompany.id} brandName={activeCompany.name} primaryColor={activeCompany.primary_color} secondaryColor={activeCompany.secondary_color} />;
}
