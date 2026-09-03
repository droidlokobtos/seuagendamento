-- Every service that exists when this migration runs receives a ready-to-use,
-- service-specific form. Existing linked templates are deliberately preserved.
WITH service_forms AS (
  SELECT
    s.id,
    s.company_id,
    s.name,
    lower(coalesce(s.name, '') || ' ' || coalesce(s.category, '')) AS search_text
  FROM public.services s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.anamnesis_templates template
    WHERE template.company_id = s.company_id
      AND template.service_ids @> ARRAY[s.id]::uuid[]
  )
), prepared AS (
  SELECT
    service_forms.*,
    jsonb_build_object(
      'key', 'saude',
      'label', 'Saúde e segurança',
      'emoji', '🛡️',
      'description', 'Informações importantes para realizar o atendimento com segurança.',
      'questions', jsonb_build_array(
        jsonb_build_object('key', 'alergias', 'label', 'Possui alergias?', 'type', 'boolean', 'detail', 'alergias_detalhes', 'detailLabel', 'Descreva as alergias', 'alertWhen', 'yes', 'alertLabel', 'Alergia declarada', 'required', true),
        jsonb_build_object('key', 'medicamentos', 'label', 'Usa medicamentos contínuos?', 'type', 'boolean', 'detail', 'medicamentos_detalhes', 'detailLabel', 'Informe os medicamentos', 'alertWhen', 'yes', 'alertLabel', 'Uso contínuo de medicamentos', 'required', false),
        jsonb_build_object('key', 'condicoes_saude', 'label', 'Possui alguma condição de saúde relevante para o atendimento?', 'type', 'text', 'required', false)
      )
    ) AS health_section
  FROM service_forms
), classified AS (
  SELECT
    prepared.*,
    CASE
      WHEN search_text ~ '(color|luzes|morena|progress|permanent|alis|descolor|mecha|químic|quimic|soltura)' THEN
        jsonb_build_object(
          'key', 'quimica_capilar', 'label', 'Avaliação química e capilar', 'emoji', '🧪',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'gestante_lactante', 'label', 'Está gestante ou amamentando?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'quimicas_anteriores', 'label', 'Quais químicas foram realizadas anteriormente e quando?', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'sensibilidade_couro', 'label', 'Apresenta sensibilidade, feridas ou irritação no couro cabeludo?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Sensibilidade ou lesão no couro cabeludo', 'required', true),
            jsonb_build_object('key', 'teste_mecha', 'label', 'O teste de mecha foi realizado e aprovado?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'objetivo_resultado', 'label', 'Qual resultado o cliente deseja alcançar?', 'type', 'text', 'required', true)
          )
        )
      WHEN search_text ~ '(capilar|couro|tratamento|detox|hidrata|reconstru|fio)' THEN
        jsonb_build_object(
          'key', 'avaliacao_capilar', 'label', 'Avaliação capilar', 'emoji', '🔎',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'sintomas', 'label', 'Há queda, coceira, descamação, dor ou oleosidade excessiva? Descreva.', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'tratamento_medico', 'label', 'Realiza tratamento médico ou dermatológico?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'lesoes_couro', 'label', 'Existem feridas, inflamações ou lesões no couro cabeludo?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Lesão ou inflamação no couro cabeludo', 'required', true),
            jsonb_build_object('key', 'historico_quimico', 'label', 'Informe o histórico recente de químicas ou procedimentos nos fios.', 'type', 'text', 'required', false),
            jsonb_build_object('key', 'objetivo_tratamento', 'label', 'Qual é o principal objetivo deste tratamento?', 'type', 'text', 'required', true)
          )
        )
      WHEN search_text ~ '(corte|barba|bigode)' THEN
        jsonb_build_object(
          'key', 'preferencias_corte', 'label', 'Preferências do serviço', 'emoji', '✂️',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'referencia_visual', 'label', 'Qual estilo ou resultado foi combinado com o cliente?', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'restricoes', 'label', 'Existe alguma área sensível, lesão, pinta ou restrição?', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'uso_maquina_lamina', 'label', 'Autoriza o uso de máquina e/ou lâmina quando necessário?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'observacoes_tecnicas', 'label', 'Observações técnicas e acabamento combinado.', 'type', 'text', 'required', false)
          )
        )
      WHEN search_text ~ '(sobrancel|micropig|henna|maquiagem|facial|pele)' THEN
        jsonb_build_object(
          'key', 'avaliacao_estetica', 'label', 'Avaliação estética', 'emoji', '✨',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'sensibilidade_pele', 'label', 'Possui pele sensível, dermatite, lesões ou irritações?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Condição ou sensibilidade de pele', 'required', true),
            jsonb_build_object('key', 'procedimento_recente', 'label', 'Realizou procedimento estético ou usou ácidos recentemente?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'resultado_desejado', 'label', 'Qual formato, efeito ou resultado foi combinado?', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'teste_alergico', 'label', 'Quando aplicável, o teste alérgico foi realizado?', 'type', 'boolean', 'required', false)
          )
        )
      WHEN search_text ~ '(unha|manicure|pedicure|gel|fibra|alongamento)' THEN
        jsonb_build_object(
          'key', 'avaliacao_unhas', 'label', 'Avaliação das unhas', 'emoji', '💅',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'alergia_produtos', 'label', 'Possui alergia a esmaltes, gel, acrílico ou outros produtos?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Alergia a produtos para unhas', 'required', true),
            jsonb_build_object('key', 'alteracoes_unhas', 'label', 'Há micose, inflamação, ferida ou alteração nas unhas?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Alteração identificada nas unhas', 'required', true),
            jsonb_build_object('key', 'procedimento_anterior', 'label', 'Existe alongamento ou produto anterior a ser removido?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'resultado_desejado', 'label', 'Descreva o formato, tamanho e resultado desejado.', 'type', 'text', 'required', true)
          )
        )
      ELSE
        jsonb_build_object(
          'key', 'avaliacao_servico', 'label', 'Avaliação do serviço', 'emoji', '📋',
          'questions', jsonb_build_array(
            jsonb_build_object('key', 'objetivo', 'label', 'Qual é o objetivo deste serviço?', 'type', 'text', 'required', true),
            jsonb_build_object('key', 'procedimento_anterior', 'label', 'Já realizou este procedimento anteriormente?', 'type', 'boolean', 'required', true),
            jsonb_build_object('key', 'reacao_anterior', 'label', 'Teve alguma reação ou intercorrência em atendimentos anteriores?', 'type', 'boolean', 'alertWhen', 'yes', 'alertLabel', 'Reação em atendimento anterior', 'required', true),
            jsonb_build_object('key', 'observacoes', 'label', 'Observações e recomendações específicas.', 'type', 'text', 'required', false)
          )
        )
    END AS service_section
  FROM prepared
)
INSERT INTO public.anamnesis_templates (
  company_id,
  name,
  description,
  service_ids,
  sections,
  terms,
  require_signature,
  allow_before_photos,
  allow_after_photos,
  validity_months,
  active
)
SELECT
  company_id,
  'Ficha de ' || name,
  'Ficha profissional de avaliação, segurança e consentimento para o serviço ' || name || '.',
  ARRAY[id]::uuid[],
  jsonb_build_array(health_section, service_section),
  jsonb_build_array(
    jsonb_build_object('id', 'veracidade', 'label', 'Veracidade das informações', 'text', 'Declaro que as informações fornecidas nesta ficha são verdadeiras e completas.', 'required', true),
    jsonb_build_object('id', 'procedimento', 'label', 'Ciência e autorização', 'text', 'Declaro que recebi as orientações necessárias e autorizo a realização do serviço ' || name || '.', 'required', true),
    jsonb_build_object('id', 'lgpd', 'label', 'Privacidade e dados', 'text', 'Autorizo o tratamento destes dados exclusivamente para segurança, registro e acompanhamento do atendimento.', 'required', true)
  ),
  true,
  true,
  true,
  6,
  true
FROM classified;
