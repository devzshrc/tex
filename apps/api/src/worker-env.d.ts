declare module "cloudflare:node" {
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
  export const waitUntil: (promise: Promise<unknown>) => void;
}
