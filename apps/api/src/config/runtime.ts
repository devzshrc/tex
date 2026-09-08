export interface R2ObjectLike {
  body?: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

interface RuntimeConfig {
  values: Record<string, string>;
  attachments?: R2BucketLike;
  waitUntil?: (promise: Promise<unknown>) => void;
}

let runtime: RuntimeConfig | undefined;

export function configureCloudflareRuntime(config: RuntimeConfig): void {
  runtime = config;
}

export function runtimeValue(name: string): string | undefined {
  return runtime?.values[name];
}

export function attachmentsBucket(): R2BucketLike | undefined {
  return runtime?.attachments;
}

export function scheduleRuntime(promise: Promise<unknown>): void {
  if (runtime?.waitUntil) runtime.waitUntil(promise);
  else void promise;
}

export function isCloudflareRuntime(): boolean {
  return runtime !== undefined;
}
