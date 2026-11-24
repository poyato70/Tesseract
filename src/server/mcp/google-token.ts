/**
 * Token OAuth 2.0 do Google a partir de uma conta de serviço (JWT bearer,
 * RFC 7523). A chave privada nunca sai do processo; o token fica em cache
 * até 60 s antes de expirar.
 */
import { createSign } from "node:crypto";
import { AppError } from "../errors.js";
import { fetchBound } from "../security/endpoint-policy.js";

export type ServiceAccount = { client_email: string; private_key: string; token_uri?: string; project_id?: string };

export function parseServiceAccount(text: string): ServiceAccount {
  let v: any;
  try {
    v = JSON.parse(text);
  } catch {
    throw new AppError("invalid_request", "Cole o JSON completo da chave da conta de serviço.");
  }
  if (v?.type !== "service_account" || typeof v.client_email !== "string" || typeof v.private_key !== "string" || !v.private_key.includes("PRIVATE KEY"))
    throw new AppError("invalid_request", "O JSON não é uma chave de conta de serviço do Google (type=service_account, client_email, private_key).");
  if (v.token_uri && v.token_uri !== "https://oauth2.googleapis.com/token")
    throw new AppError("invalid_request", "token_uri inesperado na chave; somente https://oauth2.googleapis.com/token é aceito.");
  return v;
}

const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function signedAssertion(sa: ServiceAccount, scope: string, now = Math.floor(Date.now() / 1000)) {
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${b64(signer.sign(sa.private_key))}`;
}

const cache = new Map<string, { token: string; until: number }>();

export async function googleAccessToken(cacheKey: string, saText: string, scope: string, signal?: AbortSignal) {
  const hit = cache.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.token;
  const sa = parseServiceAccount(saText);
  const response = await fetchBound("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedAssertion(sa, scope) }).toString(),
    signal,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string")
    throw new AppError("auth_configuration", `O Google recusou a conta de serviço (HTTP ${response.status}${data.error ? ` · ${data.error}` : ""}). Confira se a chave está ativa e se a conta tem MCP Tool User e acesso ao BigQuery.`, 401);
  cache.set(cacheKey, { token: data.access_token, until: Date.now() + Math.max(60, (Number(data.expires_in) || 3600) - 60) * 1000 });
  return data.access_token as string;
}

export function forgetGoogleToken(cacheKey: string) {
  cache.delete(cacheKey);
}
