import { createFileRoute } from "@tanstack/react-router";
import { MarketingStudio } from "@/components/marketing/MarketingStudio";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: () => <MarketingStudio scope="saas" />,
  head: () => ({
    meta: [
      { title: "Marketing e publicidade | Admin Master" },
      { name: "description", content: "Estúdio de campanhas do SeuAgendamento." },
    ],
  }),
});
