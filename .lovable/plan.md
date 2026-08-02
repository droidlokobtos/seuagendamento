# Calculadora de Procedimentos — Refinamento Completo

Transformar o módulo atual (cadastro simples de insumos + custo) no motor de custos da plataforma: conversão de unidades, formação automática de preço, simulador, versionamento, indicadores e alertas.

## O que existe hoje (verificado)

- Tabelas `procedures`, `procedure_items`, `procedure_costs` e `procedure_audit_log`, com acesso restrito a administradores da empresa (leitura para membros).
- `procedures` guarda: nome, categoria, serviço vinculado, duração única, preço sugerido/mínimo/ideal/praticado, valor-hora, comissão e "outros custos".
- `procedure_items` guarda produto, quantidade, unidade e custo unitário — sem conversão de unidade: a baixa automática no estoque ao concluir o atendimento usa a quantidade crua, então "2 ml de um frasco de 240 ml" hoje dá baixa de 2 unidades do frasco.
- Produtos já têm unidade, custo médio, último custo, estoque, lote e validade — a calculadora hoje não importa lote/validade nem valida se o produto existe no Estoque de Atendimento.

## Etapas

### 1. Base de dados
- `procedures`: adicionar subcategoria, tempo mínimo/máximo, preço promocional, imagem, margem desejada, política de bloqueio de venda abaixo do custo, e flag de rateio de custos operacionais da empresa.
- `procedure_items`: adicionar unidade de consumo separada da unidade de compra, fator de conversão calculado e quantidade convertida para a unidade de estoque.
- Nova tabela de **conversões de unidade** por empresa (padrões: litro/ml, kg/g, m/cm, caixa/un, frasco/ml, ampola/ml, sachê/g, tubo/ml) + conversões personalizadas ("1 caixa = 100 luvas").
- Nova tabela de **custos operacionais da empresa** (energia, água, internet, aluguel, contabilidade, limpeza, lavanderia, descartáveis, esterilização, depreciação, manutenção, taxas, impostos, outros), com escolha de quais entram no rateio e base de rateio (por hora ou por atendimento).
- Nova tabela de **preço por profissional** (opcional) por procedimento.
- Nova tabela de **versões do procedimento**: snapshot completo (dados, insumos, custos, valores calculados) a cada alteração, com usuário/data — nunca apagada.
- Atualizar o gatilho de baixa automática para usar a quantidade já convertida e registrar o custo do atendimento.

### 2. Motor de cálculo (`src/lib/procedures.ts`)
- Reescrever com precisão decimal em centavos/frações, expondo: custo de produtos (com conversão), mão de obra, comissão, custo operacional rateado, custo total, lucro bruto, lucro líquido, % de lucro e % de custo.
- Sugestão automática de preço mínimo, ideal e premium a partir do custo + margem desejada.
- Mesma função reutilizada na validação de servidor ao salvar (integridade garantida no backend).

### 3. Interface do módulo
- Editor em abas: Informações, Valores, Composição, Custos operacionais, Simulador, Histórico.
- **Composição**: seleção obrigatória a partir do Estoque de Atendimento, importando custo pago/médio, unidade, saldo, lote e validade; escolha da unidade de consumo com conversão automática exibida ("2 ml de 240 ml = R$ 0,42").
- **Valores**: preços sugerido/mínimo/padrão/promocional e por profissional, com painel de resultado em tempo real e bloqueio de salvamento abaixo do custo quando a regra estiver ativa.
- **Simulador**: alterar quantidades, custos, comissão, tempo e margem sem gravar; botão para aplicar oficialmente.
- **Histórico**: lista de versões com comparação antes/depois.
- Configuração de custos operacionais da empresa em tela própria dentro do módulo.

### 4. Alertas e inteligência
- Alertas por procedimento: produto sem custo, sem estoque, vencido/a vencer, unidade ausente, conversão inválida, margem baixa, prejuízo.
- Painel de indicadores: mais/menos lucrativos, produtos mais consumidos e de maior custo, custo médio por atendimento, margem média, consumo mensal e anual.

### 5. Relatórios e integrações
- Relatórios exportáveis em CSV/Excel e PDF: custo por procedimento, custo por profissional, consumo de produtos, lucro e margem, comparativo custo × preço, histórico de alterações, procedimentos mais executados.
- Integrações: preço/serviço da Agenda, baixa no Estoque de Atendimento, lançamento de custo no Financeiro/Fluxo de Caixa, comissões, planos e pacotes e Painel Inteligente.

### 6. Segurança e desempenho
- Criação e alterações restritas a administradores da empresa; funcionários apenas leitura (políticas já vigentes, estendidas às novas tabelas).
- Consultas agregadas e índices por empresa/procedimento; cálculo instantâneo no frontend com validação no servidor.

## Notas técnicas

- Cálculos monetários em inteiros (centavos) e quantidades em numérico de 3–4 casas para evitar erro de arredondamento por ml/g.
- Migrações compatíveis com os dados atuais: itens existentes recebem fator de conversão 1 e unidade de consumo igual à unidade atual.
- Nenhuma alteração em módulos existentes além dos pontos de integração citados.
