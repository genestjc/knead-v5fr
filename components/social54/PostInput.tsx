'use client';

/**
 * One post, as paste or screenshot.
 *
 * Both at once is normal and encouraged: a screenshot carries the image and
 * the reply thread, a paste carries the caption in text the model does not
 * have to read out of pixels. Given both, the judge uses the picture for what
 * only the picture shows and the text for the words.
 *
 * Screenshots are read in the browser and sent as base64 in the request. They
 * are never stored — see supabase/migrations/013_social_judge.sql for why.
 */
import { useRef, useState } from 'react';
import { platformLabel, type SocialPlatform } from '@/lib/social/types';

/** Matches the router's per-image cap, checked here so the error is immediate. */
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_IMAGES = 4;

export interface PostDraft {
  handle: string;
  text: string;
  comments: string;
  url: string;
  /** data: URLs. The route strips the prefix before sending to the provider. */
  images: string[];
}

export const EMPTY_DRAFT: PostDraft = { handle: '', text: '', comments: '', url: '', images: [] };

export function PostInput({
  label,
  platform,
  draft,
  onChange,
  onRemove,
  disabled,
  showComments = true,
  accent,
}: {
  label: string;
  platform: SocialPlatform;
  draft: PostDraft;
  onChange: (next: PostDraft) => void;
  onRemove?: () => void;
  disabled?: boolean;
  showComments?: boolean;
  accent?: boolean;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setImageError(null);

    const accepted: string[] = [];
    for (const file of Array.from(files)) {
      if (draft.images.length + accepted.length >= MAX_IMAGES) {
        setImageError(`At most ${MAX_IMAGES} screenshots per post.`);
        break;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        // Caught here rather than at the provider: a rejection there loses the
        // whole run with an opaque message.
        setImageError(
          `${file.name} is ${(file.size / 1_000_000).toFixed(1)}MB, over the 5MB limit. Crop it or take the screenshot at a lower resolution.`,
        );
        continue;
      }
      try {
        accepted.push(await readAsDataUrl(file));
      } catch {
        setImageError(`${file.name} could not be read.`);
      }
    }

    if (accepted.length) onChange({ ...draft, images: [...draft.images, ...accepted] });
    if (fileRef.current) fileRef.current.value = '';
  }

  /**
   * Paste-to-attach. Screenshotting and pasting straight in is the fastest
   * path there is, and on macOS it is what Cmd+Shift+4 already puts on the
   * clipboard — making people save a file first would be a step for nothing.
   */
  function onPaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) return;
    event.preventDefault();

    const list = new DataTransfer();
    files.forEach((file) => list.items.add(file));
    addFiles(list.files);
  }

  return (
    <div className={`border rounded-md p-4 space-y-3 ${accent ? 'border-gray-900' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-medium">
          {label}
        </span>
        <input
          value={draft.handle}
          onChange={(e) => onChange({ ...draft, handle: e.target.value })}
          disabled={disabled}
          placeholder="handle (optional)"
          className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono w-40 disabled:opacity-50"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={disabled}
            className="ml-auto text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-red-600 disabled:opacity-40"
          >
            Remove
          </button>
        )}
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => onChange({ ...draft, text: e.target.value })}
        onPaste={onPaste}
        disabled={disabled}
        rows={4}
        placeholder={`Paste the ${platformLabel(platform)} caption — or paste a screenshot straight in`}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
      />

      {showComments && (
        <textarea
          value={draft.comments}
          onChange={(e) => onChange({ ...draft, comments: e.target.value })}
          onPaste={onPaste}
          disabled={disabled}
          rows={3}
          placeholder="Replies, if you have them — pasted, or visible in a screenshot. Leave empty to skip the sentiment read."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          disabled={disabled}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
          id={`file-${label.replace(/\s+/g, '-')}`}
        />
        <label
          htmlFor={`file-${label.replace(/\s+/g, '-')}`}
          className={`text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 border border-gray-300 rounded-md ${
            disabled ? 'opacity-40' : 'cursor-pointer hover:border-gray-900'
          }`}
        >
          Attach screenshot
        </label>
        <span className="font-georgia-pro text-[13px] text-gray-400">
          or press ⌘V anywhere above
        </span>
      </div>

      {imageError && <p className="font-georgia-pro text-[13px] text-red-700">{imageError}</p>}

      {draft.images.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {draft.images.map((image, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a base64 screenshot never leaves the browser; the optimizer has nothing to fetch */}
              <img
                src={image}
                alt={`Screenshot ${i + 1}`}
                className="h-20 w-20 object-cover rounded border border-gray-200"
              />
              <button
                onClick={() =>
                  onChange({ ...draft, images: draft.images.filter((_, index) => index !== i) })
                }
                disabled={disabled}
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full w-5 h-5 text-[11px] leading-none text-gray-500 hover:text-red-600 disabled:opacity-40"
                aria-label={`Remove screenshot ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Strip empties so the route never receives a post with nothing in it. */
export function draftToPayload(draft: PostDraft) {
  return {
    handle: draft.handle.trim() || undefined,
    text: draft.text.trim(),
    comments: draft.comments.trim(),
    url: draft.url.trim() || undefined,
    source: draft.images.length > 0 ? ('screenshot' as const) : ('paste' as const),
    images: draft.images,
  };
}

export function draftIsEmpty(draft: PostDraft): boolean {
  return !draft.text.trim() && draft.images.length === 0;
}
