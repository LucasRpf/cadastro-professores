import { createHmac, timingSafeEqual } from "node:crypto";

const tokenMaxAgeMs = 1000 * 60 * 60 * 8;

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSecret() {
  return process.env.ADMIN_SECRET || getAdminPassword();
}

function sign(value) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Date.now() + tokenMaxAgeMs
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function safeEqual(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return jsonResponse({ error: "ADMIN_PASSWORD não configurada no Netlify" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  if (!safeEqual(String(body.password || ""), adminPassword)) {
    return jsonResponse({ error: "Senha inválida" }, 401);
  }

  return jsonResponse({ ok: true, token: createToken() });
}
