/**
 * Demeter's conversation persistence, for the reader-facing bubble.
 *
 * Why this exists: a reader who arrives from an Instagram story link never
 * leaves that in-app WebView, and the WebView is remounted constantly —
 * opening the share sheet, backgrounding the app, tapping a link inside the
 * story. React state alone dies with each of those, so the thread reset to
 * empty and a follow-up like "what was her name again?" had nothing to resolve
 * against; Demeter would answer by explaining that it can't remember.
 *
 * Two layers, because in-app WebViews partition storage and can throw on the
 * mere act of touching it:
 *   1. localStorage — carries the thread across reloads and navigations.
 *   2. A module-level map — carries it across remounts within the same page
 *      when storage is unavailable or write-blocked.
 *
 * Every storage access is guarded. A blocked or corrupt read must degrade to
 * "no thread yet", never to a broken panel.
 */

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

const THREAD_KEY_PREFIX = 'demeter_thread_';

/** Stale threads shouldn't resurface days later as if the reader never left. */
export const THREAD_TTL_MS = 6 * 60 * 60 * 1000;

/** Matches the server's history cap (MAX_HISTORY_TURNS in lib/ai/router.ts) with room to spare. */
export const MAX_STORED_MESSAGES = 24;

const memoryThreads = new Map<string, ThreadMessage[]>();

export function threadKey(slug?: string): string {
  return `${THREAD_KEY_PREFIX}${slug || 'global'}`;
}

function isMessage(value: any): value is ThreadMessage {
  return (
    value &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string'
  );
}

/** Storage access itself can throw in a partitioned WebView, so never touch it bare. */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadThread(slug?: string): ThreadMessage[] {
  const key = threadKey(slug);

  // The in-memory copy is same-page and always current, so it wins.
  const remembered = memoryThreads.get(key);
  if (remembered?.length) return remembered;

  try {
    const raw = storage()?.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed?.savedAt ?? 0) > THREAD_TTL_MS) {
      storage()?.removeItem(key);
      return [];
    }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages.filter(isMessage) : [];
    if (messages.length) memoryThreads.set(key, messages);
    return messages;
  } catch {
    // Storage blocked, partitioned, or holding junk — no thread, not a crash.
    return [];
  }
}

export function saveThread(slug: string | undefined, messages: ThreadMessage[]): void {
  const key = threadKey(slug);
  const trimmed = messages.slice(-MAX_STORED_MESSAGES);
  memoryThreads.set(key, trimmed);
  try {
    storage()?.setItem(key, JSON.stringify({ savedAt: Date.now(), messages: trimmed }));
  } catch {
    // Quota, private mode, or a partitioned WebView. The memory copy stands.
  }
}

/** Test seam — the in-memory layer is module state and would leak between cases. */
export function __clearThreadMemory(): void {
  memoryThreads.clear();
}
