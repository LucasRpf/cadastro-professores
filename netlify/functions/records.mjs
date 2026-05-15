import { getStore } from "@netlify/blobs";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const store = getStore("cadastro-professores");
const key = "dados-professores";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSecret() {
  return process.env.ADMIN_SECRET || getAdminPassword();
}

function sign(value) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isAdmin(request) {
  const secret = getSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const first = Buffer.from(signature);
  const second = Buffer.from(expected);
  if (first.length !== second.length || !timingSafeEqual(first, second)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return data.role === "admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

async function readRecords() {
  const records = await store.get(key, { type: "json" });
  return Array.isArray(records) ? records : [];
}

async function writeRecords(records) {
  await store.setJSON(key, records);
}

export default async function handler(request) {
  if (request.method === "GET") {
    if (!isAdmin(request)) {
      return jsonResponse({ error: "Acesso restrito ao admin" }, 401);
    }
    return jsonResponse(await readRecords());
  }

  if (request.method === "POST") {
    let record;
    try {
      record = await request.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400);
    }

    if (!record || typeof record !== "object" || !record.name) {
      return jsonResponse({ error: "Registro inválido" }, 400);
    }

    const records = await readRecords();
    const normalizedName = normalizeName(record.name);
    const existingIndex = records.findIndex((item) => normalizeName(item.name) === normalizedName);
    const savedRecord = {
      ...record,
      id: existingIndex >= 0 ? records[existingIndex].id : (record.id || randomUUID()),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      records[existingIndex] = savedRecord;
    } else {
      records.unshift(savedRecord);
    }

    await writeRecords(records);
    return jsonResponse({ ok: true });
  }

  if (request.method === "PUT") {
    if (!isAdmin(request)) {
      return jsonResponse({ error: "Acesso restrito ao admin" }, 401);
    }

    let records;
    try {
      records = await request.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400);
    }

    if (!Array.isArray(records)) {
      return jsonResponse({ error: "Os dados precisam ser uma lista" }, 400);
    }

    await writeRecords(records);
    return jsonResponse({ ok: true, total: records.length });
  }

  if (request.method === "DELETE") {
    if (!isAdmin(request)) {
      return jsonResponse({ error: "Acesso restrito ao admin" }, 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return jsonResponse({ error: "ID não informado" }, 400);
    }

    const records = await readRecords();
    const updatedRecords = records.filter((record) => String(record.id) !== id);
    await writeRecords(updatedRecords);
    return jsonResponse({ ok: true, records: updatedRecords, total: updatedRecords.length });
  }

  return jsonResponse({ error: "Método não permitido" }, 405);
}
