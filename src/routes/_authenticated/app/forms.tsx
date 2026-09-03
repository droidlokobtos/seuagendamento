import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, FileSignature, Plus, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { DEFAULT_TERMS, type AnamnesisTemplate, type ConsentTerm } from "@/lib/custom-forms";
import type { Question, QuestionType, Section } from "@/lib/anamnesis-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AnamnesisTab } from "@/components/app/AnamnesisTab";
import { defaultSectionsForService } from "@/lib/default-service-forms";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/forms")({
  validateSearch: z.object({ service: z.string().uuid().optional() }),
  component: CustomFormsPage,
});

type Draft = Omit<AnamnesisTemplate, "id" | "company_id"> & { id?: string };
const blank = (): Draft => ({
  name: "",
  description: "",
  service_ids: [],
  sections: [{ key: "personalizado", label: "Perguntas", emoji: "📋", questions: [] }],
  terms: DEFAULT_TERMS.map((term) => ({ ...term })),
  require_signature: true,
  allow_before_photos: false,
  allow_after_photos: false,
  validity_months: 6,
  active: true,
});

const editableSections = (sections: Section[]): Section[] => [
  {
    key: "personalizado",
    label: "Perguntas",
    emoji: "📋",
    questions: sections.flatMap((section) => section.questions),
  },
];

const keyFor = (label: string, index: number) =>
  `${
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "pergunta"
  }_${index + 1}`;

function CustomFormsPage() {
  const { service: requestedServiceId } = Route.useSearch();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? "";
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(blank);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const initializedServiceId = useRef("");

  const { data: templates = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["anamnesis-templates", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("anamnesis_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as AnamnesisTemplate[];
    },
  });
  const { data: services = [] } = useQuery({
    enabled: !!companyId,
    queryKey: ["form-services", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id,name,category,active")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });
  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    enabled: !!companyId,
    queryKey: ["form-appointments", companyId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id,starts_at,status,customer_id,customers(id,name,phone),appointment_services(service_id,services(id,name,active))",
        )
        .eq("company_id", companyId)
        .gte("starts_at", since.toISOString())
        .not("customer_id", "is", null)
        .in("status", ["scheduled", "confirmed", "in_progress", "completed", "reminder_sent"])
        .order("starts_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).sort((left, right) => {
        const leftTime = new Date(left.starts_at).getTime();
        const rightTime = new Date(right.starts_at).getTime();
        const leftIsFuture = leftTime >= now;
        const rightIsFuture = rightTime >= now;
        if (leftIsFuture !== rightIsFuture) return leftIsFuture ? -1 : 1;
        return leftIsFuture ? leftTime - rightTime : rightTime - leftTime;
      });
    },
  });

  const selectedAppointment = appointments.find(
    (appointment: any) => appointment.id === selectedAppointmentId,
  ) as any;

  useEffect(() => {
    if (!selectedAppointment) {
      setSelectedServiceIds([]);
      return;
    }
    setSelectedServiceIds(
      (selectedAppointment.appointment_services ?? [])
        .map((item: any) => item.service_id ?? item.services?.id)
        .filter(Boolean),
    );
  }, [selectedAppointment]);

  useEffect(() => {
    setDraft(blank());
    initializedServiceId.current = "";
  }, [companyId]);

  useEffect(() => {
    if (!requestedServiceId || initializedServiceId.current === requestedServiceId) return;
    const service = services.find((item) => item.id === requestedServiceId);
    if (!service) return;
    initializedServiceId.current = requestedServiceId;
    setDraft({
      ...blank(),
      name: `Ficha de ${service.name}`,
      description: `Ficha de avaliação, segurança e consentimento para o serviço ${service.name}.`,
      service_ids: [service.id],
      sections: editableSections(defaultSectionsForService(service.name, service.category)),
    });
    document.getElementById("form-template-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    toast.info("Complete e salve a ficha obrigatória do novo serviço.");
  }, [requestedServiceId, services]);
  const section = draft.sections[0];
  const updateQuestions = (questions: Question[]) =>
    setDraft((d) => ({ ...d, sections: [{ ...d.sections[0], questions }] }));

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Selecione uma empresa.");
      if (!draft.name.trim()) throw new Error("Informe o nome do formulário.");
      if (!draft.sections.some((item) => item.questions.length))
        throw new Error("Adicione pelo menos uma pergunta.");
      const sections = draft.sections.map((s) => ({
        ...s,
        questions: s.questions.map((q, i) => ({ ...q, key: q.key || keyFor(q.label, i) })),
      }));
      const payload = { ...draft, company_id: companyId, sections };
      const query = (supabase as any).from("anamnesis_templates");
      const { error } = draft.id
        ? await query.update(payload).eq("id", draft.id).eq("company_id", companyId)
        : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formulário salvo e pronto para os serviços selecionados.");
      setDraft(blank());
      void qc.invalidateQueries({ queryKey: ["anamnesis-templates", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = async (id: string) => {
    if (!confirm("Excluir este modelo? As fichas já assinadas continuarão preservadas.")) return;
    const { error } = await (supabase as any)
      .from("anamnesis_templates")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) return toast.error(error.message);
    if (draft.id === id) setDraft(blank());
    toast.success("Modelo excluído.");
    void qc.invalidateQueries({ queryKey: ["anamnesis-templates", companyId] });
  };

  if (!activeCompany)
    return <p className="p-6 text-sm text-muted-foreground">Selecione uma empresa.</p>;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileSignature className="h-6 w-6" /> Formulários e consentimentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Crie fichas específicas por serviço com assinatura, termos e registro fotográfico.
        </p>
      </div>

      <Card className="overflow-hidden border-primary/20 shadow-sm">
        <CardHeader className="border-b bg-primary/[0.035]">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5 text-primary" /> Preencher para um atendimento
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione o cliente agendado e confirme os serviços antes de preencher e assinar.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 p-4 md:p-6">
          <div className="space-y-2">
            <Label>Cliente agendado *</Label>
            <Select value={selectedAppointmentId} onValueChange={setSelectedAppointmentId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingAppointments ? "Carregando agendamentos…" : "Selecione um atendimento"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {appointments.map((appointment: any) => (
                  <SelectItem key={appointment.id} value={appointment.id}>
                    {formatAppointment(appointment.starts_at)} ·{" "}
                    {appointment.customers?.name ?? "Cliente"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingAppointments && !appointments.length && (
              <p className="text-xs text-muted-foreground">
                Nenhum cliente agendado nos últimos 30 dias ou em datas futuras.
              </p>
            )}
          </div>

          {selectedAppointment && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/25 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{selectedAppointment.customers?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAppointment(selectedAppointment.starts_at)}
                    {selectedAppointment.customers?.phone
                      ? ` · ${selectedAppointment.customers.phone}`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline">Cliente agendado</Badge>
              </div>

              <div className="space-y-2">
                <Label>Serviços deste formulário *</Label>
                <p className="text-xs text-muted-foreground">
                  Os serviços do agendamento já vêm marcados. Ajuste se necessário.
                </p>
                <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <label key={service.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedServiceIds.includes(service.id)}
                        onCheckedChange={(checked) =>
                          setSelectedServiceIds((current) =>
                            checked
                              ? Array.from(new Set([...current, service.id]))
                              : current.filter((id) => id !== service.id),
                          )
                        }
                      />
                      {service.name}
                    </label>
                  ))}
                </div>
              </div>

              {selectedServiceIds.length ? (
                <AnamnesisTab
                  key={`${selectedAppointment.id}:${selectedServiceIds.join(",")}`}
                  companyId={companyId}
                  customerId={selectedAppointment.customer_id}
                  customerName={selectedAppointment.customers?.name ?? "Cliente"}
                  appointmentId={selectedAppointment.id}
                  serviceIds={selectedServiceIds}
                  serviceNames={services
                    .filter((service) => selectedServiceIds.includes(service.id))
                    .map((service) => service.name)}
                />
              ) : (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Selecione ao menos um serviço para continuar.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Modelos e serviços vinculados</h2>
        <p className="text-sm text-muted-foreground">
          Defina quais formulários devem ser usados em cada serviço cadastrado.
        </p>
      </div>

      {!!templates.length && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={draft.id === template.id ? "border-primary" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.sections.flatMap((s) => s.questions).length} perguntas · validade{" "}
                      {template.validity_months} meses
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      Serviços: {serviceNamesForTemplate(template, services)}
                    </p>
                  </div>
                  <Badge variant={template.active ? "default" : "secondary"}>
                    {template.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...template,
                        terms: template.terms?.length ? template.terms : DEFAULT_TERMS,
                        sections: editableSections(template.sections),
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void remove(template.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card id="form-template-editor">
        <CardHeader>
          <CardTitle>{draft.id ? "Editar formulário" : "Novo formulário"}</CardTitle>
          {requestedServiceId && draft.service_ids.includes(requestedServiceId) && (
            <p className="text-sm font-medium text-primary">
              Serviço novo: revise as perguntas e salve esta ficha antes de utilizá-lo.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: Consentimento para micropigmentação"
              />
            </div>
            <div className="space-y-2">
              <Label>Validade da ficha (meses)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={draft.validity_months}
                onChange={(e) =>
                  setDraft({ ...draft, validity_months: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Orientação ao cliente</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Explique a finalidade desta ficha."
            />
          </div>

          <div className="space-y-2">
            <Label>Serviços vinculados</Label>
            <p className="text-xs text-muted-foreground">
              Sem seleção, o modelo será geral. Com seleção, aparecerá apenas quando um desses
              serviços for agendado.
            </p>
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.service_ids.includes(service.id)}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        service_ids: checked
                          ? [...draft.service_ids, service.id]
                          : draft.service_ids.filter((id) => id !== service.id),
                      })
                    }
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Perguntas personalizadas</Label>
                <p className="text-xs text-muted-foreground">
                  Defina tipo, obrigatoriedade e opções.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateQuestions([
                    ...section.questions,
                    { key: "", label: "", type: "text", required: false },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Pergunta
              </Button>
            </div>
            {section.questions.map((question, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_180px_auto]"
              >
                <div className="space-y-2">
                  <Label>Pergunta</Label>
                  <Input
                    value={question.label}
                    onChange={(e) =>
                      updateQuestions(
                        section.questions.map((q, i) =>
                          i === index ? { ...q, label: e.target.value } : q,
                        ),
                      )
                    }
                    placeholder="Digite a pergunta"
                  />
                  {(question.type === "select" || question.type === "multi") && (
                    <Input
                      value={(question.options ?? []).join(", ")}
                      onChange={(e) =>
                        updateQuestions(
                          section.questions.map((q, i) =>
                            i === index
                              ? {
                                  ...q,
                                  options: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                }
                              : q,
                          ),
                        )
                      }
                      placeholder="Opções separadas por vírgula"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={question.type}
                    onValueChange={(type: QuestionType) =>
                      updateQuestions(
                        section.questions.map((q, i) => (i === index ? { ...q, type } : q)),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="boolean">Sim ou não</SelectItem>
                      <SelectItem value="select">Lista</SelectItem>
                      <SelectItem value="multi">Múltipla escolha</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={question.required}
                      onCheckedChange={(required) =>
                        updateQuestions(
                          section.questions.map((q, i) =>
                            i === index ? { ...q, required: !!required } : q,
                          ),
                        )
                      }
                    />{" "}
                    Obrigatória
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-center"
                  onClick={() => updateQuestions(section.questions.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Label>Termos e consentimentos</Label>
            {draft.terms.map((term: ConsentTerm, index) => (
              <div key={term.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Input
                    className="max-w-sm"
                    value={term.label}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        terms: draft.terms.map((t, i) =>
                          i === index ? { ...t, label: e.target.value } : t,
                        ),
                      })
                    }
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={term.required}
                      onCheckedChange={(required) =>
                        setDraft({
                          ...draft,
                          terms: draft.terms.map((t, i) =>
                            i === index ? { ...t, required: !!required } : t,
                          ),
                        })
                      }
                    />{" "}
                    Obrigatório
                  </label>
                </div>
                <Textarea
                  value={term.text}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      terms: draft.terms.map((t, i) =>
                        i === index ? { ...t, text: e.target.value } : t,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={draft.require_signature}
                onCheckedChange={(v) => setDraft({ ...draft, require_signature: !!v })}
              />{" "}
              Assinatura obrigatória
            </label>
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={draft.allow_before_photos}
                onCheckedChange={(v) => setDraft({ ...draft, allow_before_photos: !!v })}
              />{" "}
              Fotos antes
            </label>
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={draft.allow_after_photos}
                onCheckedChange={(v) => setDraft({ ...draft, allow_after_photos: !!v })}
              />{" "}
              Fotos depois
            </label>
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: !!v })}
              />{" "}
              Modelo ativo
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Salvando…" : "Salvar formulário"}
            </Button>
            {draft.id && (
              <Button variant="outline" onClick={() => setDraft(blank())}>
                Cancelar edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatAppointment(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function serviceNamesForTemplate(
  template: AnamnesisTemplate,
  services: Array<{ id: string; name: string }>,
) {
  if (!template.service_ids.length) return "todos os serviços";
  const names = services
    .filter((service) => template.service_ids.includes(service.id))
    .map((service) => service.name);
  return names.length ? names.join(", ") : "serviços anteriormente vinculados";
}
