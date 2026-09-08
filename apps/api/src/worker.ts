import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import { env as cloudflareEnv, waitUntil } from "cloudflare:workers";
import { configureCloudflareRuntime } from "./config/runtime";

type CloudflareEnv = {
  HYPERDRIVE?: { connectionString: string };
  ATTACHMENTS?: import("./config/runtime").R2BucketLike;
  NODE_ENV?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RELAY_ENABLED?: string;
};

const bindings = cloudflareEnv as unknown as CloudflareEnv;

function configure(): void {
  if (!bindings.HYPERDRIVE?.connectionString) {
    throw new Error("HYPERDRIVE binding is required for the Cloudflare API Worker");
  }
  if (!bindings.ATTACHMENTS) {
    throw new Error("ATTACHMENTS R2 binding is required for the Cloudflare API Worker");
  }
  configureCloudflareRuntime({
    values: {
      NODE_ENV: bindings.NODE_ENV ?? "production",
      DATABASE_URL: bindings.HYPERDRIVE?.connectionString ?? "",
      BETTER_AUTH_URL: bindings.BETTER_AUTH_URL ?? "",
      BETTER_AUTH_SECRET: bindings.BETTER_AUTH_SECRET ?? "",
      FRONTEND_URL: bindings.FRONTEND_URL ?? "",
      GOOGLE_CLIENT_ID: bindings.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: bindings.GOOGLE_CLIENT_SECRET ?? "",
      RELAY_ENABLED: bindings.RELAY_ENABLED ?? "true",
    },
    attachments: bindings.ATTACHMENTS,
    waitUntil,
  });
}

let appPromise: Promise<import("express").Express> | undefined;
function loadApp(): Promise<import("express").Express> {
  configure();
  appPromise ??= import("./app").then(async ({ createApp }) => {
    const { assertEnv } = await import("./config/env");
    assertEnv();
    return createApp();
  });
  return appPromise;
}

const server = createServer((request, response) => {
  void loadApp()
    .then((app) => app(request, response))
    .catch((error: unknown) => {
      console.error("Worker application bootstrap failed", error);
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain" });
      response.end("Internal server error");
    });
});

server.listen(8000);

export default {
  fetch(request: Request): Promise<Response> {
    return handleAsNodeRequest(8000, request);
  },
  async scheduled(): Promise<void> {
    await loadApp();
    const { drainRelayOnce } = await import("./workers/relay");
    await drainRelayOnce();
  },
};
