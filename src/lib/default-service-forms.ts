import type { Section } from "@/lib/anamnesis-core";

const healthQuestions: Section = {
  key: "saude",
  label: "Saúde e segurança",
  emoji: "🛡️",
  description: "Informações importantes para realizar o atendimento com segurança.",
  questions: [
    {
      key: "alergias",
      label: "Possui alergias?",
      type: "boolean",
      detail: "alergias_detalhes",
      detailLabel: "Descreva as alergias",
      alertWhen: "yes",
      alertLabel: "Alergia declarada",
      required: true,
    },
    {
      key: "medicamentos",
      label: "Usa medicamentos contínuos?",
      type: "boolean",
      detail: "medicamentos_detalhes",
      detailLabel: "Informe os medicamentos",
      alertWhen: "yes",
      alertLabel: "Uso contínuo de medicamentos",
      required: false,
    },
    {
      key: "condicoes_saude",
      label: "Possui alguma condição de saúde relevante para o atendimento?",
      type: "text",
      required: false,
    },
  ],
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function defaultSectionsForService(name: string, category?: string | null): Section[] {
  const text = normalized(`${name} ${category ?? ""}`);

  if (/(color|luzes|morena|progress|permanent|alis|descolor|mecha|quimic|soltura)/.test(text)) {
    return [
      healthQuestions,
      {
        key: "quimica_capilar",
        label: "Avaliação química e capilar",
        emoji: "🧪",
        questions: [
          {
            key: "gestante_lactante",
            label: "Está gestante ou amamentando?",
            type: "boolean",
            required: true,
          },
          {
            key: "quimicas_anteriores",
            label: "Quais químicas foram realizadas anteriormente e quando?",
            type: "text",
            required: true,
          },
          {
            key: "sensibilidade_couro",
            label: "Apresenta sensibilidade, feridas ou irritação no couro cabeludo?",
            type: "boolean",
            required: true,
            alertWhen: "yes",
            alertLabel: "Sensibilidade ou lesão no couro cabeludo",
          },
          {
            key: "teste_mecha",
            label: "O teste de mecha foi realizado e aprovado?",
            type: "boolean",
            required: true,
          },
          {
            key: "objetivo_resultado",
            label: "Qual resultado o cliente deseja alcançar?",
            type: "text",
            required: true,
          },
        ],
      },
    ];
  }

  if (/(capilar|couro|tratamento|detox|hidrata|reconstru|fio)/.test(text)) {
    return [
      healthQuestions,
      {
        key: "avaliacao_capilar",
        label: "Avaliação capilar",
        emoji: "🔎",
        questions: [
          {
            key: "sintomas",
            label: "Há queda, coceira, descamação, dor ou oleosidade excessiva? Descreva.",
            type: "text",
            required: true,
          },
          {
            key: "tratamento_medico",
            label: "Realiza tratamento médico ou dermatológico?",
            type: "boolean",
            required: true,
          },
          {
            key: "lesoes_couro",
            label: "Existem feridas, inflamações ou lesões no couro cabeludo?",
            type: "boolean",
            required: true,
            alertWhen: "yes",
            alertLabel: "Lesão ou inflamação no couro cabeludo",
          },
          {
            key: "historico_quimico",
            label: "Informe o histórico recente de químicas ou procedimentos nos fios.",
            type: "text",
            required: false,
          },
          {
            key: "objetivo_tratamento",
            label: "Qual é o principal objetivo deste tratamento?",
            type: "text",
            required: true,
          },
        ],
      },
    ];
  }

  if (/(corte|barba|bigode)/.test(text)) {
    return [
      healthQuestions,
      {
        key: "preferencias_corte",
        label: "Preferências do serviço",
        emoji: "✂️",
        questions: [
          {
            key: "referencia_visual",
            label: "Qual estilo ou resultado foi combinado com o cliente?",
            type: "text",
            required: true,
          },
          {
            key: "restricoes",
            label: "Existe alguma área sensível, lesão, pinta ou restrição?",
            type: "text",
            required: true,
          },
          {
            key: "uso_maquina_lamina",
            label: "Autoriza o uso de máquina e/ou lâmina quando necessário?",
            type: "boolean",
            required: true,
          },
          {
            key: "observacoes_tecnicas",
            label: "Observações técnicas e acabamento combinado.",
            type: "text",
            required: false,
          },
        ],
      },
    ];
  }

  if (/(sobrancel|micropig|henna|maquiagem|facial|pele)/.test(text)) {
    return [
      healthQuestions,
      {
        key: "avaliacao_estetica",
        label: "Avaliação estética",
        emoji: "✨",
        questions: [
          {
            key: "sensibilidade_pele",
            label: "Possui pele sensível, dermatite, lesões ou irritações?",
            type: "boolean",
            required: true,
            alertWhen: "yes",
            alertLabel: "Condição ou sensibilidade de pele",
          },
          {
            key: "procedimento_recente",
            label: "Realizou procedimento estético ou usou ácidos recentemente?",
            type: "boolean",
            required: true,
          },
          {
            key: "resultado_desejado",
            label: "Qual formato, efeito ou resultado foi combinado?",
            type: "text",
            required: true,
          },
          {
            key: "teste_alergico",
            label: "Quando aplicável, o teste alérgico foi realizado?",
            type: "boolean",
            required: false,
          },
        ],
      },
    ];
  }

  if (/(unha|manicure|pedicure|gel|fibra|alongamento)/.test(text)) {
    return [
      healthQuestions,
      {
        key: "avaliacao_unhas",
        label: "Avaliação das unhas",
        emoji: "💅",
        questions: [
          {
            key: "alergia_produtos",
            label: "Possui alergia a esmaltes, gel, acrílico ou outros produtos?",
            type: "boolean",
            required: true,
            alertWhen: "yes",
            alertLabel: "Alergia a produtos para unhas",
          },
          {
            key: "alteracoes_unhas",
            label: "Há micose, inflamação, ferida ou alteração nas unhas?",
            type: "boolean",
            required: true,
            alertWhen: "yes",
            alertLabel: "Alteração identificada nas unhas",
          },
          {
            key: "procedimento_anterior",
            label: "Existe alongamento ou produto anterior a ser removido?",
            type: "boolean",
            required: true,
          },
          {
            key: "resultado_desejado",
            label: "Descreva o formato, tamanho e resultado desejado.",
            type: "text",
            required: true,
          },
        ],
      },
    ];
  }

  return [
    healthQuestions,
    {
      key: "avaliacao_servico",
      label: "Avaliação do serviço",
      emoji: "📋",
      questions: [
        {
          key: "objetivo",
          label: `Qual é o objetivo do serviço “${name}”?`,
          type: "text",
          required: true,
        },
        {
          key: "procedimento_anterior",
          label: "Já realizou este procedimento anteriormente?",
          type: "boolean",
          required: true,
        },
        {
          key: "reacao_anterior",
          label: "Teve alguma reação ou intercorrência em atendimentos anteriores?",
          type: "boolean",
          required: true,
        },
        {
          key: "observacoes",
          label: "Observações e recomendações específicas.",
          type: "text",
          required: false,
        },
      ],
    },
  ];
}
