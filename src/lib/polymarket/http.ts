/* ── fetchWithRetry: retry on 429 / 5xx with exponential backoff + jitter ── */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeoutMs = 10_000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) return res;

      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const base = Math.pow(2, attempt) * 500;
        const jitter = Math.random() * 300;
        console.log(
          `[http] ${res.status} on ${url} — retry ${attempt + 1}/${retries} in ${Math.round(base + jitter)}ms`
        );
        await sleep(base + jitter);
        continue;
      }

      throw new Error(
        `HTTP ${res.status} ${res.statusText} — ${url}`
      );
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === "AbortError") {
        lastError = new Error(`Timeout after ${timeoutMs}ms — ${url}`);
      }

      if (attempt < retries) {
        const base = Math.pow(2, attempt) * 500;
        const jitter = Math.random() * 300;
        console.log(
          `[http] Error on ${url}: ${lastError.message} — retry ${attempt + 1}/${retries}`
        );
        await sleep(base + jitter);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry failed — ${url}`);
}

export async function fetchJson<T = unknown>(
  url: string,
  options?: RequestInit,
  retries?: number,
  timeoutMs?: number
): Promise<T> {
  const res = await fetchWithRetry(url, options, retries, timeoutMs);
  return res.json() as Promise<T>;
}
