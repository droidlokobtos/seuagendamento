/**
 * Bridge WhatsApp Web — serviço desacoplado (Node 20+).
 *
 * Mantém uma sessão autenticada por QR Code por empresa (multi-tenant),
 * persistida em disco (LocalAuth), sobrevivendo a reinicializações.
 *
 * Contrato HTTP consumido pelo app (não altere as rotas):
 *   POST /session/start   { session }            -> { session, connected, qr, device_name, phone }
 *   GET  /session/status  ?session=<id>          -> { session, connected, qr, device_name, phone, status }
 *   POST /session/stop    { session }            -> { ok: true }
 *   POST /messages/send   { session, to, text }  -> { ok: true, id }
 *
 * Todas as rotas exigem: Authorization: Bearer <BRIDGE_TOKEN>
 *
 * Deploy (VPS / Railway / Fly.io / Render — precisa de disco persistente):
 *   npm i express whatsapp-web.js qrcode
 *   BRIDGE_TOKEN=umtokenforte node server.js
 *
 * Depois, no app: Integrações → WhatsApp → provedor "Bridge WhatsApp Web",
 * informe a URL pública do bridge e o mesmo BRIDGE_TOKEN, salve e clique em
 * "Conectar WhatsApp" para ler o QR Code.
 */
import express from "express";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const PORT = process.env.PORT || 8787;
const TOKEN = process.env.BRIDGE_TOKEN;
const DATA_PATH = process.env.SESSIONS_PATH || "./.wwebjs_auth";

if (!TOKEN) {
  console.error("Defina BRIDGE_TOKEN antes de iniciar o bridge.");
  process.exit(1);
}

/** @type {Map<string, { client: any, qr: string|null, connected: boolean, info: any }>} */
const sessions = new Map();

function getOrCreate(sessionId) {
  let s = sessions.get(sessionId);
  if (s) return s;

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId, dataPath: DATA_PATH }),
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  s = { client, qr: null, connected: false, info: null };
  sessions.set(sessionId, s);

  client.on("qr", async (raw) => {
    s.qr = await qrcode.toDataURL(raw);
    s.connected = false;
  });
  client.on("ready", () => {
    s.qr = null;
    s.connected = true;
    s.info = client.info;
  });
  client.on("authenticated", () => {
    s.qr = null;
  });
  client.on("disconnected", () => {
    s.connected = false;
    s.info = null;
    sessions.delete(sessionId);
  });

  client.initialize().catch((e) => {
    console.error(`[${sessionId}] init falhou:`, e.message);
    sessions.delete(sessionId);
  });

  return s;
}

function snapshot(sessionId, s) {
  return {
    session: sessionId,
    connected: s.connected,
    status: s.connected ? "connected" : s.qr ? "pending_qr" : "starting",
    qr: s.qr,
    device_name: s.info?.pushname ?? null,
    phone: s.info?.wid?.user ? `+${s.info.wid.user}` : null,
  };
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: "Token inválido" });
  }
  next();
});

app.post("/session/start", (req, res) => {
  const id = String(req.body?.session || "");
  if (!id) return res.status(400).json({ error: "session é obrigatório" });
  res.json(snapshot(id, getOrCreate(id)));
});

app.get("/session/status", (req, res) => {
  const id = String(req.query.session || "");
  const s = sessions.get(id);
  if (!s) return res.json({ session: id, connected: false, status: "disconnected", qr: null });
  res.json(snapshot(id, s));
});

app.post("/session/stop", async (req, res) => {
  const id = String(req.body?.session || "");
  const s = sessions.get(id);
  if (s) {
    try {
      await s.client.logout();
    } catch {}
    try {
      await s.client.destroy();
    } catch {}
    sessions.delete(id);
  }
  res.json({ ok: true });
});

app.post("/messages/send", async (req, res) => {
  const { session, to, text } = req.body ?? {};
  const s = sessions.get(String(session || ""));
  if (!s?.connected) return res.status(409).json({ error: "Sessão não conectada" });
  const digits = String(to || "").replace(/\D/g, "");
  if (!digits) return res.status(400).json({ error: "Número inválido" });
  try {
    const msg = await s.client.sendMessage(`${digits}@c.us`, String(text ?? ""));
    res.json({ ok: true, id: msg.id?._serialized ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Retoma sessões já autenticadas em disco após reinicialização do servidor.
for (const id of (process.env.RESUME_SESSIONS || "").split(",").filter(Boolean)) {
  getOrCreate(id.trim());
}

app.listen(PORT, () => console.log(`WhatsApp bridge ouvindo em :${PORT}`));
