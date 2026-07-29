# Bridge WhatsApp Web (sessão por QR Code)

A sessão do WhatsApp Web precisa de um processo Node **persistente 24/7** (navegador headless + socket sempre aberto). O backend deste app roda em ambiente serverless, que não mantém esse processo vivo — por isso a sessão fica em um serviço bridge separado, e o app fala com ele por HTTP.

O restante do sistema não muda: as regras de negócio, modelos de mensagem, fila e histórico já são agnósticos de provedor. Trocar o bridge pela **WhatsApp Business Cloud API** depois é só mudar o provedor na tela de Integrações.

## 1. Suba o bridge

Precisa de uma hospedagem com processo contínuo e disco persistente (VPS, Fly.io, Railway, Render).

```bash
cd docs/whatsapp-bridge
npm install
BRIDGE_TOKEN="um-token-bem-forte" node server.js
```

Variáveis:

| Variável | Descrição |
| --- | --- |
| `BRIDGE_TOKEN` | Obrigatório. Token compartilhado com o app (`Authorization: Bearer`). |
| `PORT` | Porta HTTP (padrão `8787`). |
| `SESSIONS_PATH` | Pasta persistente das sessões (padrão `./.wwebjs_auth`). Use um volume. |
| `RESUME_SESSIONS` | IDs de empresa separados por vírgula para religar sessões no boot. |

## 2. Conecte no app

1. Entre em **Integrações → WhatsApp → Conexão**.
2. Provedor: **Bridge WhatsApp Web (sessão por QR Code)**.
3. Informe a URL pública do bridge (ex.: `https://wa.suaempresa.com`) e o `BRIDGE_TOKEN`.
4. Salve e clique em **Conectar WhatsApp**.
5. Leia o QR Code no app oficial do WhatsApp (Aparelhos conectados). A tela faz polling a cada 5s e muda para **Conectado** sozinha.

Cada empresa usa `session = company_id`, então as sessões são totalmente isoladas. A sessão fica salva em disco e volta após reinicializações; se expirar, o status muda para pendente e um novo QR Code é gerado.

## 3. Envio automático

Com a sessão conectada e **envio automático** ligado, a fila despacha sozinha os eventos: agendamento criado, confirmação, lembretes (offsets configuráveis), cancelamento, reagendamento, sinal pendente/aprovado/rejeitado, atendimento concluído e link de avaliação — todos usando os modelos editáveis com variáveis dinâmicas. Falhas ficam no histórico e são reenviadas conforme o número máximo de tentativas.

## Contrato HTTP

Qualquer outro serviço (Baileys, Evolution, Z-API com adaptador) pode substituir o bridge desde que exponha:

```
POST /session/start   { session }            -> { connected, qr, device_name, phone }
GET  /session/status  ?session=<id>          -> { connected, qr, status, device_name, phone }
POST /session/stop    { session }            -> { ok: true }
POST /messages/send   { session, to, text }  -> { ok: true, id }
```
