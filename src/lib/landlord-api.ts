// Calls a landlord-only Route Handler with the signed-in landlord's Firebase ID token.
// Throws with the server's message when the call fails.
import { auth } from "@/lib/firebase";

export async function landlordFetch<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || `Request failed (${res.status})`);
  return result as T;
}

export const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;
