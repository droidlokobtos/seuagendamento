import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, BookOpen, Rocket, Calendar, Users, Scissors, Wallet, Package, UserCog, Link2, MessageCircle, Sparkles, Settings, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/help")({ component: HelpCenter });

type Guide = { title: string; summary: string; steps: string[]; tip?: string; to?: string };
type Section = { title: string; description: string; icon: any; guides: Guide[] };

const SECTIONS: Section[] = [
  { title: "Primeiros passos", description: "Configure a empresa corretamente antes de começar a receber agendamentos.", icon: Rocket, guides: [
    { title: "1. Configure os dados da empresa", summary: "Cadastre nome, telefone, endereço, horários e demais informações usadas na operação.", steps: ["Abra Configurações.", "Revise os dados da empresa e os horários de funcionamento.", "Salve as alterações antes de seguir para os próximos passos."], to: "/app/settings" },
    { title: "2. Cadastre seus serviços", summary: "Crie os serviços que poderão ser usados na agenda e no link público.", steps: ["Acesse Serviços e categorias.", "Crie ou organize as categorias.", "Cadastre nome, duração e preço de cada serviço.", "Ative a opção de exibir no link de agendamento somente para os serviços que o cliente poderá escolher online."], to: "/app/services" },
    { title: "3. Cadastre a equipe", summary: "Adicione os profissionais e deixe a agenda pronta para distribuir atendimentos.", steps: ["Abra Funcionários.", "Cadastre cada profissional com os dados corretos.", "Revise permissões e acesso quando o profissional também utilizar o sistema."], to: "/app/staff" },
    { title: "4. Prepare o link de agendamento", summary: "Confira a página que seus clientes usarão para marcar horários.", steps: ["Abra Link exclusivo para localizar o endereço público da empresa.", "Use Personalizar página para ajustar a apresentação.", "Faça um agendamento de teste como se fosse um cliente antes de divulgar o link."], tip: "Sempre faça um teste completo após alterar serviços, profissionais ou horários.", to: "/app/link" },
  ]},
  { title: "Agenda e agendamentos", description: "Aprenda a criar, organizar e controlar os horários do dia a dia.", icon: Calendar, guides: [
    { title: "Criar um agendamento manual", summary: "Use quando o cliente marcar presencialmente, por telefone ou por mensagem.", steps: ["Abra Agenda e escolha Novo agendamento.", "Selecione ou cadastre o cliente.", "Escolha profissional, serviço, data e horário.", "Revise as informações e confirme."], to: "/app/agenda" },
    { title: "Bloquear horários", summary: "Evite que horários indisponíveis sejam ocupados por novos agendamentos.", steps: ["Acesse Bloqueios de horários.", "Informe o período que ficará indisponível.", "Confirme o bloqueio e confira a agenda."], to: "/app/blocks" },
    { title: "Confirmação e comparecimento", summary: "Acompanhe confirmações, faltas e presença dos clientes.", steps: ["Use Confirmações automáticas para acompanhar a rotina de confirmação.", "Após o horário, registre corretamente o comparecimento ou a falta.", "Manter esses dados atualizados melhora relatórios e análises da IA."], to: "/app/attendance" },
  ]},
  { title: "Clientes", description: "Centralize histórico, relacionamento e informações importantes de cada cliente.", icon: Users, guides: [
    { title: "Cadastrar e localizar clientes", summary: "Mantenha uma ficha única para evitar cadastros duplicados.", steps: ["Abra Clientes e fichas.", "Pesquise pelo cliente antes de criar um novo cadastro.", "Preencha os dados de contato corretamente.", "Consulte a ficha sempre que precisar verificar histórico e informações registradas."], to: "/app/customers" },
    { title: "Fidelidade, recompensas e avaliações", summary: "Use os recursos de relacionamento para estimular retorno e acompanhar satisfação.", steps: ["Defina sua estratégia de fidelidade.", "Configure recompensas compatíveis com a operação.", "Acompanhe avaliações e use os comentários para identificar pontos de melhoria."], to: "/app/loyalty" },
  ]},
  { title: "Serviços e procedimentos", description: "Organize o catálogo e acompanhe melhor o custo dos atendimentos.", icon: Scissors, guides: [
    { title: "Organizar serviços e categorias", summary: "Uma estrutura simples facilita tanto a agenda quanto a experiência do cliente.", steps: ["Agrupe serviços semelhantes em categorias.", "Use nomes claros e fáceis de entender.", "Revise duração e preço sempre que houver mudança na operação."], to: "/app/services" },
    { title: "Calculadora de procedimentos", summary: "Registre insumos para entender melhor o custo real de cada procedimento.", steps: ["Abra Calculadora de Procedimentos.", "Cadastre os itens utilizados e seus custos.", "Informe as quantidades consumidas no procedimento.", "Revise o custo calculado antes de definir ou reajustar preços."], tip: "Preço de venda e custo do procedimento são informações diferentes. Mantenha os custos atualizados.", to: "/app/procedures" },
  ]},
  { title: "Financeiro e vendas", description: "Registre movimentações corretamente para que os números do dashboard façam sentido.", icon: Wallet, guides: [
    { title: "Registrar pagamentos", summary: "Mantenha os recebimentos vinculados à operação.", steps: ["Abra Pagamentos.", "Localize o atendimento ou lançamento correspondente.", "Informe valor e forma de pagamento.", "Confira o saldo quando houver sinal antecipado."], to: "/app/payments" },
    { title: "Acompanhar o financeiro", summary: "Use o dashboard financeiro para acompanhar a situação da empresa.", steps: ["Registre os movimentos antes de analisar os resultados.", "Compare períodos em vez de olhar apenas um dia isolado.", "Investigue diferenças entre faturamento esperado e valores registrados."], to: "/app/finances" },
    { title: "Comissões e vendas", summary: "Registre vendas e acompanhe valores destinados aos profissionais.", steps: ["Cadastre corretamente os profissionais.", "Registre as vendas e atendimentos no fluxo correto.", "Confira Comissões antes de realizar o fechamento do período."], to: "/app/commissions" },
  ]},
  { title: "Estoque", description: "Evite divergências mantendo entradas, saídas e produtos atualizados.", icon: Package, guides: [
    { title: "Controlar produtos e movimentações", summary: "Toda entrada ou saída deve ser registrada para o saldo permanecer confiável.", steps: ["Cadastre o produto com unidade e informações corretas.", "Registre entradas quando houver reposição.", "Registre saídas conforme uso ou venda.", "Faça conferências físicas periódicas e corrija divergências identificadas."], to: "/app/products" },
  ]},
  { title: "Equipe e acessos", description: "Dê acesso à equipe sem compartilhar a conta principal da empresa.", icon: UserCog, guides: [
    { title: "Criar usuários e permissões", summary: "Cada pessoa deve utilizar seu próprio acesso e somente as áreas necessárias.", steps: ["Abra Usuários.", "Cadastre ou vincule o colaborador.", "Defina as permissões de acordo com a função exercida.", "Revise acessos quando alguém mudar de função ou sair da empresa."], tip: "Evite compartilhar a senha do administrador entre funcionários.", to: "/app/users" },
  ]},
  { title: "Link e página pública", description: "Entenda o que o cliente vê antes de divulgar seu endereço de agendamento.", icon: Link2, guides: [
    { title: "Divulgar o link corretamente", summary: "O link exclusivo é a porta de entrada para o autoagendamento.", steps: ["Abra Link exclusivo.", "Copie o endereço da empresa.", "Teste em uma janela anônima ou outro aparelho.", "Confirme serviços, profissionais e horários disponíveis.", "Só então divulgue o link aos clientes."], to: "/app/link" },
  ]},
  { title: "WhatsApp e comunicação", description: "Use a área de comunicação para organizar mensagens relacionadas aos atendimentos.", icon: MessageCircle, guides: [
    { title: "Usar a área de WhatsApp", summary: "Acompanhe mensagens e lembretes disponíveis no sistema.", steps: ["Abra WhatsApp.", "Revise a fila e as informações do cliente antes do envio.", "Confirme telefone, data e horário do atendimento.", "Evite mensagens duplicadas para o mesmo cliente."], to: "/app/whatsapp" },
  ]},
  { title: "Inteligência e relatórios", description: "Transforme os dados registrados no sistema em decisões melhores.", icon: Sparkles, guides: [
    { title: "Como aproveitar a IA", summary: "A qualidade da análise depende da qualidade dos dados registrados.", steps: ["Mantenha atendimentos, faltas, clientes e financeiro atualizados.", "Abra Assistente IA para consultar o cenário da empresa.", "Observe alertas do radar e clientes em risco.", "Use previsões como apoio à decisão, não como valor garantido."], to: "/app/ai" },
    { title: "Ler relatórios corretamente", summary: "Analise tendências e compare períodos antes de tomar decisões.", steps: ["Escolha o relatório relacionado à sua dúvida.", "Confira o período analisado.", "Compare o resultado com períodos anteriores.", "Use os dados para investigar causas antes de alterar preços, equipe ou horários."], to: "/app/reports" },
  ]},
  { title: "Soluções rápidas", description: "Antes de procurar suporte, confira estas causas comuns.", icon: AlertCircle, guides: [
    { title: "Um horário não aparece para o cliente", summary: "Verifique disponibilidade, bloqueios e configuração antes de considerar um erro.", steps: ["Confirme se o serviço está habilitado para o link de agendamento.", "Confira se existe profissional disponível para aquele período.", "Verifique bloqueios de horários.", "Confirme os horários de funcionamento.", "Teste novamente no link público." ] },
    { title: "Um número do dashboard parece errado", summary: "Dashboards dependem dos registros feitos nas áreas operacionais.", steps: ["Confira o período exibido.", "Verifique se atendimentos foram finalizados com o status correto.", "Confira pagamentos, vendas e demais lançamentos relacionados.", "Atualize a página após corrigir os registros." ] },
    { title: "Um funcionário não consegue acessar uma área", summary: "Na maioria dos casos, a causa é a permissão do usuário.", steps: ["Abra Usuários.", "Localize o colaborador.", "Revise as permissões atribuídas.", "Salve e peça para o usuário entrar novamente se necessário."], to: "/app/users" },
  ]},
];

function HelpCenter() {
  const [query, setQuery] = useState("");
  const [openGuide, setOpenGuide] = useState<string | null>("1. Configure os dados da empresa");
  const normalized = query.trim().toLowerCase();
  const sections = useMemo(() => !normalized ? SECTIONS : SECTIONS.map((section) => ({ ...section, guides: section.guides.filter((g) => [section.title, section.description, g.title, g.summary, ...g.steps].join(" ").toLowerCase().includes(normalized)) })).filter((section) => section.guides.length), [normalized]);

  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <div className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
      <div className="flex items-start gap-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpen className="h-6 w-6" /></div><div><h1 className="text-2xl font-semibold tracking-tight">Central de Ajuda</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Aprenda a configurar e usar o sistema no dia a dia. Pesquise sua dúvida ou siga os guias passo a passo antes de precisar falar com o suporte.</p></div></div>
      <div className="relative mt-6"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 pl-10" placeholder="Ex.: como cadastrar serviço, bloquear horário, registrar pagamento..." /></div>
    </div>

    {!normalized && <Card><CardContent className="p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Está começando agora?</p><p className="mt-1 text-sm text-muted-foreground">Siga a seção <b>Primeiros passos</b> na ordem. Ela prepara empresa, serviços, equipe e link de agendamento para o uso correto.</p></div></div></CardContent></Card>}

    {sections.length === 0 ? <Card><CardContent className="p-10 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 font-medium">Nenhum guia encontrado</p><p className="mt-1 text-sm text-muted-foreground">Tente pesquisar com palavras mais simples, como “agenda”, “serviço”, “cliente”, “pagamento” ou “funcionário”.</p></CardContent></Card> : <div className="grid gap-5 lg:grid-cols-2">{sections.map((section) => <Card key={section.title} className="overflow-hidden"><CardContent className="p-0"><div className="border-b bg-muted/20 p-5"><div className="flex items-center gap-3"><div className="rounded-lg border bg-background p-2"><section.icon className="h-4 w-4" /></div><div><h2 className="font-semibold">{section.title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p></div></div></div><div className="divide-y">{section.guides.map((guide) => { const key = `${section.title}:${guide.title}`; const opened = openGuide === key || openGuide === guide.title; return <div key={guide.title}><button type="button" className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30" onClick={() => setOpenGuide(opened ? null : key)}><div className="min-w-0 flex-1"><p className="text-sm font-medium">{guide.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{guide.summary}</p></div><ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition-transform ${opened ? "rotate-180" : ""}`} /></button>{opened && <div className="px-4 pb-5"><div className="rounded-xl border bg-muted/15 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passo a passo</p><ol className="space-y-2">{guide.steps.map((step, i) => <li key={step} className="flex gap-3 text-sm leading-relaxed"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span><span>{step}</span></li>)}</ol>{guide.tip && <div className="mt-4 rounded-lg border bg-background p-3 text-xs leading-relaxed"><b>Dica:</b> {guide.tip}</div>}{guide.to && <Button asChild size="sm" className="mt-4"><Link to={guide.to}>Ir para esta área</Link></Button>}</div></div>}</div>})}</div></CardContent></Card>)}</div>}
  </div>;
}
