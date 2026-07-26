"use client";

export const TERRAQURA_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "/api/terraqura"
    : "http://localhost:4000")
).replace(/\/+$/, "");

export class TerraQuraApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TerraQuraApiError";
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?:
    | string
    | {
        code?: string;
        message?: string;
      };
  [key: string]: unknown;
}

function errorMessage(
  body: ApiEnvelope<unknown> | null,
  status: number,
): string {
  if (typeof body?.error === "string") {
    return body.error;
  }
  if (body?.error && typeof body.error === "object" && body.error.message) {
    return body.error.message;
  }
  return `TerraQura API request failed (${status})`;
}

export async function terraquraApi<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(`${TERRAQURA_API_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    throw new TerraQuraApiError(
      errorMessage(body, response.status),
      response.status,
      body,
    );
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "data")) {
    return body.data as T;
  }

  return body as T;
}

export function getOperatorToken(address: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(
    `terraqura:operator-token:${address.toLowerCase()}`,
  );
}

export function setOperatorToken(address: string, token: string): void {
  window.sessionStorage.setItem(
    `terraqura:operator-token:${address.toLowerCase()}`,
    token,
  );
}

export function clearOperatorToken(address?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (address) {
    window.sessionStorage.removeItem(
      `terraqura:operator-token:${address.toLowerCase()}`,
    );
    return;
  }

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith("terraqura:operator-token:")) {
      window.sessionStorage.removeItem(key);
    }
  }
}
