import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppShareDialog } from "@/components/app/WhatsAppShareDialog";
import { WA_EVENTS, type WaEvent } from "@/lib/whatsapp";
import {
  buildWaVars,
  renderWaMessage,
  resolveReviewLink,
  sendWaLink,
  useWaTemplates,
} from "@/lib/wa-client";

const DEFAULT_ACTIONS: WaEvent[] = [
  "appointment_confirmed",
  "reminder",
  "deposit_required",
  "review_request",
  "custom",
];

/**
 * Botões de WhatsApp de um atendimento: monta a mensagem pelo modelo da
 * empresa e abre o link oficial (wa.me) com o texto preenchido.
 */
export function WhatsAppActions({
  company,
  appointment,
  actions = DEFAULT_ACTIONS,
  size = "sm",
  variant = "ghost",
  label,
}: {
  company: any;
  appointment: any;
  actions?: WaEvent[];
  size?: "sm" | "icon" | "default";
  variant?: "ghost" | "outline" | "default" | "secondary";
  label?: string;
}) {
  const qc = useQueryClient();
  const { data: templates } = useWaTemplates(company?.id);
  const [dialog, setDialog] = useState<{
    open: boolean; message: string; phone: string; title: string; event: WaEvent;
  }>({ open: false, message: "", phone: "", title: "", event: "custom" });

  const phone =
    appointment?.customers?.whatsapp || appointment?.customers?.phone || "";

  const openEvent = async (event: WaEvent) => {
    if (!phone) toast.warning("Cliente sem telefone — informe o número no envio.");
    const reviewLink =
      event === "review_request"
        ? await resolveReviewLink(appointment?.id, company?.slug)
        : null;
    const vars = buildWaVars({ company, appointment: appointment, reviewLink });
    const message = renderWaMessage(templates, event, vars);
    const meta = WA_EVENTS.find((e) => e.id === event);
    setDialog({
      open: true,
      event,
      message,
      phone,
      title: `${meta?.emoji ?? "📲"} ${meta?.label ?? "WhatsApp"}`,
    });
  };

  const handleSend = async (finalPhone: string, finalMessage: string) => {
    await sendWaLink({
      companyId: company.id,
      event: dialog.event,
      content: finalMessage,
      phone: finalPhone,
      appointmentId: appointment?.id ?? null,
      customerId: appointment?.customer_id ?? null,
      queryClient: qc,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant} title="WhatsApp">
            <MessageCircle className="h-4 w-4" />
            {label ? <span className="ml-2">{label}</span> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((id) => {
            const meta = WA_EVENTS.find((e) => e.id === id);
            return (
              <DropdownMenuItem key={id} onSelect={() => void openEvent(id)}>
                📲 {meta?.label ?? id}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <WhatsAppShareDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((s) => ({ ...s, open: v }))}
        title={dialog.title}
        message={dialog.message}
        phone={dialog.phone}
        onSend={handleSend}
      />
    </>
  );
}
