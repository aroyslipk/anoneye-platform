"use client";

export interface ApiFailure {
  code: string;
  message?: string;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export type ApiOutcome<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: ApiFailure };

function parseFailure(status: number, payload: unknown): ApiFailure {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (error && typeof error === "object") {
      const entries = error as Record<string, unknown>;
      const code = typeof entries.code === "string" ? entries.code : "internal_error";
      return {
        code,
        message: typeof entries.message === "string" ? entries.message : undefined,
        retryAfterSeconds: typeof entries.retryAfterSeconds === "number" ? entries.retryAfterSeconds : undefined,
        details: entries.details && typeof entries.details === "object" ? (entries.details as Record<string, unknown>) : undefined,
      };
    }
  }
  return { code: status === 0 ? "network_error" : "internal_error" };
}

async function request<T>(url: string, init: RequestInit): Promise<ApiOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: { code: "network_error" } };
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) return { ok: false, status: response.status, error: parseFailure(response.status, payload) };
  return { ok: true, data: payload as T, status: response.status };
}

export function postJson<T = unknown>(url: string, body: unknown): Promise<ApiOutcome<T>> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T = unknown>(url: string, body: unknown): Promise<ApiOutcome<T>> {
  return request<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteJson<T = unknown>(url: string, body: unknown = {}): Promise<ApiOutcome<T>> {
  return request<T>(url, { method: "DELETE", body: JSON.stringify(body) });
}

export function getJson<T = unknown>(url: string): Promise<ApiOutcome<T>> {
  return request<T>(url, { method: "GET" });
}
