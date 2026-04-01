type ApiErrorPayload = {
  error?: string;
  message?: string;
  detail?: string;
};

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(status: number, payload: ApiErrorPayload | null, fallbackMessage?: string) {
    super(payload?.message || payload?.detail || fallbackMessage || `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type ApiFetchOptions = {
  headers?: HeadersInit;
  next?: NextFetchRequestConfig;
  cache?: RequestCache;
};

async function buildServerRequest(path: string, init: RequestInit, options: ApiFetchOptions) {
  const [{ headers: nextHeaders, cookies }] = await Promise.all([import('next/headers')]);
  const headerStore = await nextHeaders();
  const cookieStore = await cookies();
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') || 'http';
  const baseUrl =
    host !== null
      ? `${protocol}://${host}`
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const forwardedHeaders = new Headers(options.headers || init.headers || {});
  const cookieHeader = cookieStore.toString();
  if (cookieHeader.length > 0 && !forwardedHeaders.has('cookie')) {
    forwardedHeaders.set('cookie', cookieHeader);
  }

  return {
    url: `${baseUrl}${path}`,
    init: {
      ...init,
      headers: forwardedHeaders,
      cache: options.cache ?? init.cache,
      next: options.next ?? init.next,
    } satisfies RequestInit,
  };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}): Promise<T> {
  const requestPath = path.startsWith('/') ? path : `/${path}`;

  const request =
    typeof window === 'undefined'
      ? await buildServerRequest(requestPath, init, options)
      : {
          url: requestPath,
          init: {
            ...init,
            headers: new Headers(options.headers || init.headers || {}),
            credentials: 'include' as const,
            cache: options.cache ?? init.cache,
          } satisfies RequestInit,
        };

  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }
    throw new ApiError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers || init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return apiFetch<T>(
    path,
    {
      ...init,
      method: init.method || 'POST',
      headers,
      body: JSON.stringify(body),
    },
    options
  );
}
