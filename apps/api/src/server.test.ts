import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestServer } from "../test/helpers.js";

describe("API documentation", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server?.close();
  });

  it("serves Swagger UI and its static assets", async () => {
    const page = await server.inject({
      method: "GET",
      url: "/docs/",
    });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("Swagger UI");

    const stylesheet = await server.inject({
      method: "GET",
      url: "/docs/static/swagger-ui.css",
    });
    expect(stylesheet.statusCode).toBe(200);
    expect(stylesheet.headers["content-type"]).toContain("text/css");
  });
});
