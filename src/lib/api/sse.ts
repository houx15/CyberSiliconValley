export type SseEvent = {
  event: string;
  data: Record<string, unknown>;
};

type StreamOptions = {
  signal?: AbortSignal;
  onEvent: (event: SseEvent) => void;
};

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; detail?: string; error?: string };
    return payload.message || payload.detail || payload.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function parseSseChunk(chunk: string): SseEvent | null {
  let event = '';
  let data = '';

  for (const line of chunk.split('\n')) {
    if (line.startsWith('event: ')) {
      event = line.slice('event: '.length).trim();
    } else if (line.startsWith('data: ')) {
      data += line.slice('data: '.length);
    }
  }

  if (!event || !data) {
    return null;
  }

  return {
    event,
    data: JSON.parse(data) as Record<string, unknown>,
  };
}

export async function postSseJson(
  path: string,
  body: unknown,
  { signal, onEvent }: StreamOptions
): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const event = parseSseChunk(chunk.trim());
      if (event) {
        onEvent(event);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const event = parseSseChunk(buffer.trim());
    if (event) {
      onEvent(event);
    }
  }
}
