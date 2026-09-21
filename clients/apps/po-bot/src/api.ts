/**
 * The browser's view of the server. Every read and write goes through a route
 * handler under `/api`; nothing on the client touches Drizzle or Void directly.
 */

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init?.headers }
      : init?.headers,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `${init?.method ?? 'GET'} ${path} failed`)
  }
  return response.json() as Promise<T>
}

export const get = <T>(path: string) => request<T>(path)

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })
