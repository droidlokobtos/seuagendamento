export type QuestionType = "boolean" | "text" | "select" | "multi";

export type Question = {
  key: string;
  label: string;
  type: QuestionType;
  options?: string[];
  showIf?: string;
  detail?: string;
  detailLabel?: string;
  alertWhen?: "yes" | "any";
  alertLabel?: string;
  required?: boolean;
};

export type Section = {
  key: string;
  label: string;
  emoji: string;
  description?: string;
  questions: Question[];
};

export const BASE_SECTION: Section = {
  key: "geral",
  label: "Dados gerais de saúde",
  emoji: "🩺",
  description: "Informações obrigatórias para qualquer atendimento.",
  questions: [
    {
      key: "alergias",
      label: "Possui alguma alergia (cosméticos, medicamentos, látex, níquel)?",
      type: "boolean",
      detail: "alergias_detalhe",
      detailLabel: "Quais alergias?",
      alertWhen: "yes",
      alertLabel: "Alergia declarada",
      required: true,
    },
    {
      key: "medicamentos",
      label: "Faz uso contínuo de medicamentos?",
      type: "boolean",
      detail: "medicamentos_detalhe",
      detailLabel: "Quais medicamentos?",
      alertWhen: "yes",
      alertLabel: "Uso contínuo de medicamentos",
    },
    {
      key: "doencas",
      label: "Possui alguma doença crônica (diabetes, hipertensão, tireoide, etc.)?",
      type: "boolean",
      detail: "doencas_detalhe",
      detailLabel: "Quais condições?",
      alertWhen: "yes",
      alertLabel: "Doença crônica",
    },
    { key: "gestante", label: "Está gestante ou amamentando?", type: "boolean", alertWhen: "yes", alertLabel: "Gestante/lactante" },
    {
      key: "cirurgia_recente",
      label: "Passou por cirurgia nos últimos 6 meses?",
      type: "boolean",
      detail: "cirurgia_detalhe",
      detailLabel: "Qual procedimento?",
      alertWhen: "yes",
      alertLabel: "Cirurgia recente",
    },
    {
      key: "problema_pele",
      label: "Possui problema de pele ou couro cabeludo (dermatite, psoríase, feridas)?",
      type: "boolean",
      detail: "problema_pele_detalhe",
      detailLabel: "Descreva",
      alertWhen: "yes",
      alertLabel: "Condição de pele",
    },
    { key: "observacoes", label: "Observações adicionais que devemos saber", type: "text" },
  ],
};

export const SECTIONS: Record<string, Section> = {
  barbearia: {
    key: "barbearia",
    label: "Barbearia",
    emoji: "💈",
    questions: [
      { key: "barba_sensivel", label: "Sente irritação ao fazer a barba?", type: "boolean", alertWhen: "yes", alertLabel: "Pele sensível à navalha" },
      { key: "pelos_encravados", label: "Costuma ter pelos encravados?", type: "boolean" },
      { key: "foliculite", label: "Já teve foliculite?", type: "boolean", alertWhen: "yes", alertLabel: "Histórico de foliculite" },
      { key: "produto_barba", label: "Prefere algum produto específico?", type: "text" },
      { key: "corte_preferido", label: "Corte/máquina de preferência", type: "text" },
    ],
  },
  salao: {
    key: "salao",
    label: "Salão / Cabelo",
    emoji: "💇",
    questions: [
      { key: "quimica_recente", label: "Fez química nos últimos 6 meses (alisamento, coloração, descoloração)?", type: "boolean", detail: "quimica_detalhe", detailLabel: "Qual química e quando?", alertWhen: "yes", alertLabel: "Química recente" },
      { key: "progressiva", label: "Já fez progressiva com formol?", type: "boolean", alertWhen: "yes", alertLabel: "Formol prévio" },
      { key: "queda_capilar", label: "Apresenta queda capilar acentuada?", type: "boolean", alertWhen: "yes", alertLabel: "Queda capilar" },
      { key: "couro_sensivel", label: "Couro cabeludo sensível ou com coceira?", type: "boolean" },
      { key: "tipo_cabelo", label: "Tipo de cabelo", type: "select", options: ["Liso", "Ondulado", "Cacheado", "Crespo"] },
    ],
  },
  maquiagem: {
    key: "maquiagem",
    label: "Maquiagem",
    emoji: "💄",
    questions: [
      { key: "pele_tipo", label: "Tipo de pele", type: "select", options: ["Seca", "Normal", "Mista", "Oleosa", "Sensível"] },
      { key: "alergia_cosmetico", label: "Já teve reação a maquiagem ou cosmético?", type: "boolean", detail: "alergia_cosmetico_detalhe", detailLabel: "Qual produto?", alertWhen: "yes", alertLabel: "Reação a cosmético" },
      { key: "lentes", label: "Usa lentes de contato?", type: "boolean" },
      { key: "cilios", label: "Possui extensão de cílios?", type: "boolean" },
      { key: "acne", label: "Está com acne ativa?", type: "boolean", alertWhen: "yes", alertLabel: "Acne ativa" },
    ],
  },
  estetica: {
    key: "estetica",
    label: "Estética / Procedimentos",
    emoji: "✨",
    questions: [
      { key: "procedimento_recente", label: "Realizou procedimento estético nos últimos 30 dias?", type: "boolean", detail: "procedimento_detalhe", detailLabel: "Qual procedimento?", alertWhen: "yes", alertLabel: "Procedimento recente" },
      { key: "acido", label: "Usa ácidos ou retinoides na pele?", type: "boolean", alertWhen: "yes", alertLabel: "Uso de ácidos" },
      { key: "isotretinoina", label: "Usou isotretinoína (Roacutan) no último ano?", type: "boolean", alertWhen: "yes", alertLabel: "Isotretinoína recente" },
      { key: "marcapasso", label: "Possui marcapasso, prótese ou implante metálico?", type: "boolean", alertWhen: "yes", alertLabel: "Implante/marcapasso" },
      { key: "cicatrizacao", label: "Tem dificuldade de cicatrização ou queloide?", type: "boolean", alertWhen: "yes", alertLabel: "Cicatrização difícil" },
      { key: "exposicao_solar", label: "Teve exposição solar intensa nos últimos 7 dias?", type: "boolean", alertWhen: "yes", alertLabel: "Exposição solar recente" },
    ],
  },
};

export const SECTION_OPTIONS = Object.values(SECTIONS);

const KEYWORDS: { section: string; words: string[] }[] = [
  { section: "barbearia", words: ["barba", "barbear", "navalha", "bigode", "corte masculino", "degrade", "degradê"] },
  { section: "salao", words: ["cabelo", "corte", "escova", "coloraç", "tintura", "luzes", "mecha", "progressiva", "alisamento", "hidrataç", "botox capilar"] },
  { section: "maquiagem", words: ["maquiagem", "make", "noiva", "cílio", "cilio", "sobrancelha", "design"] },
  { section: "estetica", words: ["estética", "estetica", "limpeza de pele", "peeling", "depilaç", "massagem", "drenagem", "micro", "laser", "botox", "preenchimento", "unha", "manicure", "pedicure"] },
];

export function sectionForService(svc: { name?: string | null; category?: string | null; anamnesis_section?: string | null }): string | null {
  if (svc.anamnesis_section && SECTIONS[svc.anamnesis_section]) return svc.anamnesis_section;
  if (svc.anamnesis_section === "none") return null;
  const hay = `${svc.name ?? ""} ${svc.category ?? ""}`.toLowerCase();
  for (const k of KEYWORDS) {
    if (k.words.some((w) => hay.includes(w))) return k.section;
  }
  return null;
}

export function sectionsForServices(services: { name?: string | null; category?: string | null; anamnesis_section?: string | null }[]) {
  const set = new Set<string>();
  for (const s of services) {
    const k = sectionForService(s);
    if (k) set.add(k);
  }
  return [...set];
}

export function buildQuestionnaire(sectionKeys: string[]): Section[] {
  return [BASE_SECTION, ...sectionKeys.map((k) => SECTIONS[k]).filter(Boolean)];
}

export const VALIDITY_MONTHS = 6;

export function isExpired(filledAt: string | null | undefined) {
  if (!filledAt) return true;
  const limit = new Date(filledAt);
  limit.setMonth(limit.getMonth() + VALIDITY_MONTHS);
  return limit.getTime() < Date.now();
}

export function daysUntilExpiry(filledAt: string) {
  const limit = new Date(filledAt);
  limit.setMonth(limit.getMonth() + VALIDITY_MONTHS);
  return Math.ceil((limit.getTime() - Date.now()) / 86400000);
}

export function extractAlerts(sections: Section[], answers: Record<string, any>): string[] {
  const out: string[] = [];
  for (const sec of sections) {
    for (const q of sec.questions) {
      if (!q.alertWhen) continue;
      const v = answers[q.key];
      const hit = q.alertWhen === "yes" ? v === true || v === "sim" : !!v;
      if (!hit) continue;
      const detail = q.detail ? String(answers[q.detail] ?? "").trim() : "";
      out.push(detail ? `${q.alertLabel}: ${detail}` : (q.alertLabel ?? q.label));
    }
  }
  return out;
}

export function missingRequired(sections: Section[], answers: Record<string, any>): string[] {
  const out: string[] = [];
  for (const sec of sections) {
    for (const q of sec.questions) {
      if (!q.required) continue;
      const v = answers[q.key];
      if (v === undefined || v === null || v === "") out.push(q.label);
    }
  }
  return out;
}

export const LGPD_TEXT =
  "Autorizo o tratamento dos meus dados de saúde informados nesta ficha exclusivamente para fins de segurança e personalização do atendimento, conforme a Lei Geral de Proteção de Dados (LGPD nº 13.709/2018). Posso solicitar a exclusão dos meus dados a qualquer momento.";