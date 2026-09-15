'use client';

/**
 * One post under audit — as screenshots, as a screen recording, or as text.
 *
 * All three at once is normal and encouraged. A screenshot carries the image
 * and the reply thread. A recording carries a Story sequence or a scroll
 * through a grid, which no single screenshot can. A paste carries the caption
 * in text the model does not have to read out of pixels. Given several, the
 * judge uses each for what only it shows.
 *
 * Screenshots are read in the browser and sent as base64 with the audit
 * request. Recordings go straight from here to Mux and never touch our server
 * — that difference is the whole reason a sixty-second recording is possible
 * and four large screenshots are not.
 */
import { useRef, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import { platformLabel, type SocialPlatform } from '@/lib/eval/types';
import { uploadRecording, type SocialPostDraft } from './api';

/** Matches the router's per-image cap, checked here so the error is immediate. */
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_IMAGES = 4;
/**
 * Mux takes far larger files than this. The cap is about the person's time and
 * their upload speed: past a couple of minutes of screen recording the frames
 * get sampled so far apart that the sequence stops being a sequence.
 */
const MAX_VIDEO_BYTES = 500_000_000;

export function SocialPostInput({
  account,
  label,
  platform,
  draft,
  isOurs,
  onChange,
  onRemove,
  disabled,
  accent,
}: {
  account: Account | null;
  label: string;
  platform: SocialPlatform;
  draft: SocialPostDraft;
  isOurs: boolean;
  onChange: (next: SocialPostDraft) => void;
  onRemove?: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const inputId = label.replace(/\s+/g, '-').toLowerCase();

  const busy = disabled || draft.uploadStatus === 'uploading' || draft.uploadStatus === 'waiting';

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setImageError(null);

    const accepted: string[] = [];
    for (const file of Array.from(files)) {
      if (draft.images.length + accepted.length >= MAX_IMAGES) {
        setImageError(`At most ${MAX_IMAGES} screenshots per post — record the screen for more.`);
        break;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        // Caught here rather than at the provider: a rejection there loses the
        // whole run with an opaque message.
        setImageError(
          `${file.name} is ${(file.size / 1_000_000).toFixed(1)}MB, over the 5MB limit. Crop it, or record the screen instead.`,
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

  async function addRecording(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setImageError(null);

    if (file.size > MAX_VIDEO_BYTES) {
      setImageError(
        `${file.name} is ${(file.size / 1_000_000).toFixed(0)}MB. Keep recordings under ${MAX_VIDEO_BYTES / 1_000_000}MB — a minute of screen capture is plenty.`,
      );
      return;
    }

    onChange({ ...draft, uploadStatus: 'uploading', uploadError: null });
    try {
      const media = await uploadRecording(
        account,
        file,
        { label: draft.label || label, platform, isOurs },
        (status) => onChange({ ...draft, uploadStatus: status, uploadError: null }),
      );
      onChange({
        ...draft,
        uploadId: media.muxUploadId,
        playbackId: media.muxPlaybackId,
        durationSeconds: media.durationSeconds,
        uploadStatus: 'ready',
        uploadError: null,
      });
    } catch (err: any) {
      onChange({ ...draft, uploadStatus: 'errored', uploadError: err.message });
    } finally {
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  /**
   * Paste-to-attach. Screenshotting and pasting straight in is the fastest path
   * there is, and on macOS Cmd+Shift+4 already puts the image on the clipboard
   * — making people save a file first would be a step for nothing.
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
    <div
      className={`border rounded-md p-4 space-y-3 ${accent ? 'border-gray-900' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-medium">
          {label}
        </span>
        {!isOurs && (
          <input
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            disabled={busy}
            placeholder="who (e.g. Hyperallergic)"
            className="border border-gray-300 rounded-md px-2 py-1 text-xs w-48 disabled:opacity-50"
          />
        )}
        <input
          value={draft.handle}
          onChange={(e) => onChange({ ...draft, handle: e.target.value })}
          disabled={busy}
          placeholder="handle (optional)"
          className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono w-40 disabled:opacity-50"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={busy}
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
        disabled={busy}
        rows={3}
        placeholder={`Paste the ${platformLabel(platform)} caption if you have it — or paste a screenshot straight in`}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
      />

      <textarea
        value={draft.comments}
        onChange={(e) => onChange({ ...draft, comments: e.target.value })}
        onPaste={onPaste}
        disabled={busy}
        rows={2}
        placeholder="Replies, if you have them as text. The judge also reads them out of screenshots and recordings."
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          disabled={busy}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
          id={`img-${inputId}`}
        />
        <label
          htmlFor={`img-${inputId}`}
          className={`text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 border border-gray-300 rounded-md ${
            busy ? 'opacity-40' : 'cursor-pointer hover:border-gray-900'
          }`}
        >
          Attach screenshot
        </label>

        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => addRecording(e.target.files)}
          className="hidden"
          id={`vid-${inputId}`}
        />
        <label
          htmlFor={`vid-${inputId}`}
          className={`text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 border border-gray-300 rounded-md ${
            busy ? 'opacity-40' : 'cursor-pointer hover:border-gray-900'
          }`}
        >
          {draft.uploadId ? 'Replace recording' : 'Upload recording'}
        </label>

        <span className="font-georgia-pro text-[13px] text-gray-400">or press ⌘V above</span>
      </div>

      {(draft.uploadStatus === 'uploading' || draft.uploadStatus === 'waiting') && (
        <p className="font-georgia-pro text-[13px] text-gray-600 flex items-center gap-2">
          <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700" />
          {draft.uploadStatus === 'uploading'
            ? 'Uploading to Mux…'
            : 'Mux is processing the recording — this usually takes a few seconds.'}
        </p>
      )}

      {draft.uploadStatus === 'ready' && draft.uploadId && (
        <p className="font-georgia-pro text-[13px] text-emerald-800">
          Recording ready
          {draft.durationSeconds ? ` — ${draft.durationSeconds.toFixed(1)}s` : ''}. Frames are
          sampled across it when the audit runs.
        </p>
      )}

      {draft.uploadError && (
        <p className="font-georgia-pro text-[13px] text-red-700">{draft.uploadError}</p>
      )}
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
                disabled={busy}
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
export function draftToPayload(draft: SocialPostDraft) {
  return {
    label: draft.label.trim() || undefined,
    handle: draft.handle.trim() || undefined,
    url: draft.url.trim() || undefined,
    text: draft.text.trim(),
    comments: draft.comments.trim(),
    images: draft.images,
    uploadId: draft.uploadStatus === 'ready' ? draft.uploadId ?? undefined : undefined,
  };
}
