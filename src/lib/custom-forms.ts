import type { Section } from "@/lib/anamnesis-core";

export type ConsentTerm = {
  id: string;
  label: string;
  text: string;
  required: boolean;
};

export type AnamnesisTemplate = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  service_ids: string[];
  sections: Section[];
  terms: ConsentTerm[];
  require_signature: boolean;
  allow_before_photos: boolean;
  allow_after_photos: boolean;
  validity_months: number;
  active: boolean;
};

export const DEFAULT_TERMS: ConsentTerm[] = [
  {
    id: "truth",
    label: "Declaração de veracidade",
    text: "Declaro que todas as informações prestadas são verdadeiras.",
    required: true,
  },
  {
    id: "procedure",
    label: "Autorização do procedimento",
    text: "Estou ciente dos riscos informados e autorizo a realização do procedimento.",
    required: true,
  },
  {
    id: "lgpd",
    label: "Tratamento de dados pessoais",
    text: "Autorizo o tratamento dos dados desta ficha para segurança e personalização do atendimento, conforme a LGPD.",
    required: true,
  },
];

export function templateMatchesServices(template: AnamnesisTemplate, serviceIds: string[]) {
  return !template.service_ids.length || template.service_ids.some((id) => serviceIds.includes(id));
}

export type AppointmentTemplateRecord = {
  appointment_id?: string | null;
  template_id?: string | null;
};

export function completedTemplateIdsForAppointment(
  records: AppointmentTemplateRecord[],
  appointmentId?: string,
) {
  if (!appointmentId) return new Set<string>();
  return new Set(
    records
      .filter((record) => record.appointment_id === appointmentId && record.template_id)
      .map((record) => record.template_id as string),
  );
}

export function pendingServiceIdsForAppointment(
  templates: AnamnesisTemplate[],
  records: AppointmentTemplateRecord[],
  appointmentId: string | undefined,
  serviceIds: string[],
) {
  const completedTemplateIds = completedTemplateIdsForAppointment(records, appointmentId);
  const completedServiceIds = new Set(
    templates
      .filter((template) => completedTemplateIds.has(template.id))
      .flatMap((template) => template.service_ids),
  );
  return serviceIds.filter((serviceId) => !completedServiceIds.has(serviceId));
}
