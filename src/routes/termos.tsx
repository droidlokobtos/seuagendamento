import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso e Contratação — BeautySaaS" },
      { name: "description", content: "Termos de uso e contrato de prestação de serviços SaaS para empresas contratantes da plataforma BeautySaaS." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← Voltar</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Termos de Uso e Contratação</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-sm dark:prose-invert mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold">1. Objeto</h2>
            <p>
              Este documento regula a contratação e uso da plataforma <b>BeautySaaS</b> ("Plataforma"),
              software como serviço (SaaS) destinado à gestão de agendamentos, clientes, equipe,
              finanças e comunicação para empresas do segmento de beleza, estética e bem-estar
              ("Contratante").
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Cadastro e conta</h2>
            <p>
              O Contratante declara que as informações fornecidas no cadastro são verdadeiras e se
              responsabiliza pela guarda das credenciais de acesso. É proibido compartilhar login,
              revender acessos ou utilizar a Plataforma para fins ilícitos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Mensalidade e forma de pagamento</h2>
            <p>
              O uso da Plataforma está condicionado ao pagamento da mensalidade contratada, cujo
              valor é apresentado no ato da contratação. O pagamento é realizado via <b>PIX</b>, com
              vencimento mensal. A confirmação do pagamento é feita manualmente pela equipe da
              Plataforma, que emitirá <b>comprovante digital</b> ao Contratante.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Inadimplência</h2>
            <p>
              Em caso de atraso superior a 5 (cinco) dias, a Plataforma poderá suspender o acesso
              até a regularização. A não regularização por período superior a 30 dias autoriza a
              rescisão automática e a exclusão dos dados após aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Responsabilidades do Contratante</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manter dados de clientes, agenda e financeiro corretos e atualizados;</li>
              <li>Cumprir a LGPD (Lei 13.709/2018) no tratamento dos dados de seus clientes;</li>
              <li>Não utilizar a Plataforma para spam ou envio de conteúdo indevido;</li>
              <li>Zelar pelo uso adequado da marca personalizada exibida ao público.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Responsabilidades da Plataforma</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manter a Plataforma disponível 24/7, salvo janelas de manutenção comunicadas;</li>
              <li>Armazenar os dados com criptografia em trânsito e em repouso;</li>
              <li>Prestar suporte técnico via canais oficiais;</li>
              <li>Emitir comprovante para cada pagamento confirmado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Proteção de dados (LGPD)</h2>
            <p>
              A Plataforma atua como operadora dos dados inseridos pelo Contratante, que é o
              controlador. Os dados são utilizados exclusivamente para prestação do serviço
              contratado e não são compartilhados com terceiros sem autorização legal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Propriedade intelectual</h2>
            <p>
              Todo o software, marca, layout e código-fonte da Plataforma são de propriedade
              exclusiva de seus desenvolvedores. O Contratante recebe apenas licença de uso
              não-exclusiva e intransferível durante a vigência do contrato.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Rescisão</h2>
            <p>
              A contratação pode ser encerrada a qualquer momento por qualquer das partes, mediante
              aviso prévio de 30 dias. Não haverá reembolso proporcional de mensalidade já paga.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Foro</h2>
            <p>
              Fica eleito o foro do domicílio do Contratante para dirimir quaisquer controvérsias
              oriundas deste contrato.
            </p>
          </section>

          <p className="pt-6 text-muted-foreground text-xs">
            Ao criar sua conta ou contratar a Plataforma, o Contratante declara ter lido e aceito
            integralmente os termos acima.
          </p>
        </div>
      </div>
    </div>
  );
}
