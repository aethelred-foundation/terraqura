import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "idempotency-key",
  "x-sensor-api-key",
] as const;
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  "www-authenticate",
  "x-request-id",
] as const;

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

function unavailable(message: string, status = 503) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: status === 504 ? "API_TIMEOUT" : "API_UNAVAILABLE",
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function getUpstreamOrigin(): URL | null {
  const configuredOrigin = process.env.TERRAQURA_API_ORIGIN?.trim();
  const rawOrigin =
    configuredOrigin ||
    (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "");

  if (!rawOrigin) {
    return null;
  }

  const origin = new URL(rawOrigin);
  const allowPlaintext =
    process.env.NODE_ENV !== "production" ||
    process.env.TERRAQURA_ALLOW_INSECURE_UPSTREAM === "true";
  if (
    origin.protocol !== "https:" &&
    !(allowPlaintext && origin.protocol === "http:")
  ) {
    throw new Error("TerraQura API origin must use HTTPS in production");
  }

  origin.pathname = "/";
  origin.search = "";
  origin.hash = "";
  return origin;
}

function createUpstreamUrl(
  origin: URL,
  pathSegments: string[],
  requestUrl: URL,
): URL {
  const encodedPath = pathSegments.map(encodeURIComponent).join("/");
  const upstreamUrl = new URL(encodedPath, origin);
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  let origin: URL | null;
  try {
    origin = getUpstreamOrigin();
  } catch {
    return unavailable("TerraQura API production configuration is invalid");
  }

  if (!origin) {
    return unavailable(
      "TerraQura API has not been configured for this deployment",
    );
  }

  const { path } = await context.params;
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.some((segment) => !segment)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_PATH", message: "API path is invalid" },
      },
      { status: 400 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Request body exceeds the 2 MB proxy limit",
        },
      },
      { status: 413 },
    );
  }

  const headers = new Headers();
  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body exceeds the 2 MB proxy limit",
          },
        },
        { status: 413 },
      );
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(
      createUpstreamUrl(origin, path, request.nextUrl),
      {
        method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      },
    );

    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
    });
    for (const headerName of FORWARDED_RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return unavailable("TerraQura API did not respond in time", 504);
    }
    return unavailable("TerraQura API is temporarily unreachable");
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
