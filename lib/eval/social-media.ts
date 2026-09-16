/**
 * Screen recordings for the social audit, via Mux.
 *
 * WHY VIDEO AT ALL. The judge reads images, and for a single post a screenshot
 * is the whole story. A Story sequence is not a single post — it is eight cards
 * you tap through — and neither is a scroll down somebody's grid. Screenshotting
 * those one at a time is the kind of chore that gets done once and then never
 * again, which makes it the same as not having the feature. Filming the screen
 * takes fifteen seconds and captures the pacing as well as the frames.
 *
 * WHY MUX AND NOT DAILY. Daily.co is WebRTC — it is for live calls between
 * people, and it has no concept of an uploaded file to pull stills out of. Mux
 * is already wired into this codebase for article video (app/api/admin/mux/*),
 * already has credentials in the environment, and gives us the one thing this
 * actually needs: a still at an arbitrary timestamp, on a plain URL, with no
 * ffmpeg, no temp files, and no work on our side. A Vercel function cannot
 * transcode video; it does not have to.
 *
 * WHY WE DON'T KEEP THE FILE. Only the Mux IDs are stored. Mux holds the
 * recording, and the frames the judge reads are pulled from image.mux.com on
 * demand. Keeping our own copy would duplicate a large asset to save a URL.
 *
 * ON PLAYBACK POLICY. Assets are created `public`, matching the existing Mux
 * integration, which means anyone holding the playback ID can watch the
 * recording. The IDs are unguessable and the material is somebody's public
 * Instagram grid, so this is a reasonable trade — but it is a trade, and
 * switching to signed playback is a two-line change here plus the Mux signing
 * key in the environment.
 */
import Mux from '@mux/mux-node';
import { MAX_IMAGES_PER_REQUEST, type ImageInput } from '@/lib/ai/router';

/** How many stills to pull from one recording when the caller doesn't say. */
export const DEFAULT_FRAME_COUNT = 8;

/**
 * Thumbnail width, in pixels.
 *
 * 720 is wide enough to read an Instagram caption out of a phone recording and
 * small enough that eight frames are a fraction of one screenshot. Asking for
 * the full resolution would spend the image budget on pixels no one reads.
 */
const FRAME_WIDTH = 720;

export type MediaStatus = 'waiting' | 'ready' | 'errored';

export interface SocialMedia {
  id: string;
  runId: string | null;
  isOurs: boolean;
  label: string;
  platform: string | null;
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  durationSeconds: number | null;
  status: MediaStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapMedia(row: any): SocialMedia {
  return {
    id: row.id,
    runId: row.run_id ?? null,
    isOurs: row.is_ours ?? true,
    label: row.label ?? '',
    platform: row.platform ?? null,
    muxUploadId: row.mux_upload_id ?? null,
    muxAssetId: row.mux_asset_id ?? null,
    muxPlaybackId: row.mux_playback_id ?? null,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    status: row.status ?? 'waiting',
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function muxClient(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error(
      'Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET to upload screen recordings — ' +
        'screenshots work without it.',
    );
  }
  return new Mux({ tokenId, tokenSecret });
}

export function muxConfigured(): boolean {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

/** A direct-upload URL the browser PUTs the file straight to. */
export async function createUpload(): Promise<{ uploadId: string; uploadUrl: string }> {
  const upload = await muxClient().video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || '*',
    new_asset_settings: {
      playback_policy: ['public'],
      encoding_tier: 'smart',
    },
  });
  return { uploadId: upload.id, uploadUrl: upload.url };
}

export interface AssetState {
  status: MediaStatus;
  assetId: string | null;
  playbackId: string | null;
  durationSeconds: number | null;
  error: string | null;
}

/**
 * Where an upload has got to.
 *
 * Polled rather than webhooked. A webhook would be tidier, but it needs a
 * publicly reachable endpoint, a signature check and somewhere to put the
 * result, and the person who just filmed their screen is sitting there watching
 * a spinner either way. Transcoding a fifteen-second recording takes seconds.
 */
export async function resolveAsset(uploadId: string): Promise<AssetState> {
  const empty: AssetState = {
    status: 'waiting',
    assetId: null,
    playbackId: null,
    durationSeconds: null,
    error: null,
  };

  const mux = muxClient();
  const upload = await mux.video.uploads.retrieve(uploadId);

  if (upload.status === 'errored') {
    return { ...empty, status: 'errored', error: 'Mux rejected the upload.' };
  }
  if (upload.status !== 'asset_created' || !upload.asset_id) {
    return empty;
  }

  const asset = await mux.video.assets.retrieve(upload.asset_id);

  if (asset.status === 'errored') {
    return {
      ...empty,
      status: 'errored',
      assetId: asset.id,
      error: asset.errors?.messages?.join(' ') || 'Mux could not process the recording.',
    };
  }
  if (asset.status !== 'ready') {
    return { ...empty, assetId: asset.id };
  }

  const playbackId = asset.playback_ids?.[0]?.id ?? null;
  if (!playbackId) {
    // Ready with no playback ID means the asset was created without a policy.
    // Reported rather than retried: nothing about polling again fixes it.
    return {
      ...empty,
      status: 'errored',
      assetId: asset.id,
      error: 'The recording processed but has no playback ID, so no frames can be pulled from it.',
    };
  }

  return {
    status: 'ready',
    assetId: asset.id,
    playbackId,
    durationSeconds: typeof asset.duration === 'number' ? asset.duration : null,
    error: null,
  };
}

/**
 * Timestamps to sample, spread across the recording.
 *
 * Deliberately not from 0 to duration. The first moments of a screen recording
 * are a thumb reaching for the record button and the last are it reaching back,
 * so both ends are sampled inside the edges — the frames that carry the post
 * are in the middle.
 */
export function frameTimestamps(durationSeconds: number, count: number): number[] {
  const n = Math.max(1, Math.min(count, MAX_IMAGES_PER_REQUEST));
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [0];
  if (n === 1) return [Number((durationSeconds / 2).toFixed(2))];

  const inset = Math.min(0.5, durationSeconds * 0.05);
  const start = inset;
  const end = Math.max(start, durationSeconds - inset);
  const step = (end - start) / (n - 1);

  return Array.from({ length: n }, (_, i) => Number((start + step * i).toFixed(2)));
}

export function frameUrl(playbackId: string, time: number): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${FRAME_WIDTH}&fit_mode=preserve`;
}

export interface FrameSet {
  images: ImageInput[];
  /** The timestamp behind each image, so the judge can be told the order. */
  timestamps: number[];
  /** Frames that could not be fetched. Non-fatal — the rest still grade. */
  warnings: string[];
}

/**
 * Pull stills out of a ready asset.
 *
 * Fetched in parallel and kept in timestamp order, because the order is part of
 * the evidence: a Story sequence read out of order is a different sequence. A
 * frame that fails to fetch is dropped with a warning rather than failing the
 * run — seven frames of eight still says what the eighth would have.
 */
export async function extractFrames(opts: {
  playbackId: string;
  durationSeconds: number | null;
  count?: number;
}): Promise<FrameSet> {
  const { playbackId } = opts;
  const count = Math.max(1, Math.min(opts.count ?? DEFAULT_FRAME_COUNT, MAX_IMAGES_PER_REQUEST));

  // Mux reports duration on the asset. Without it there is nothing to spread
  // frames across, so take one still from the opening seconds and say so.
  const duration = opts.durationSeconds;
  const times =
    duration && duration > 0 ? frameTimestamps(duration, count) : [0];

  const warnings: string[] = [];
  if (!duration || duration <= 0) {
    warnings.push(
      'Mux reported no duration for this recording, so only the opening frame could be sampled.',
    );
  }

  const settled = await Promise.all(
    times.map(async (time) => {
      try {
        const res = await fetch(frameUrl(playbackId, time), { cache: 'no-store' });
        if (!res.ok) {
          return { time, error: `Frame at ${time}s came back ${res.status}.` };
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) return { time, error: `Frame at ${time}s was empty.` };
        return {
          time,
          image: { data: buffer.toString('base64'), mediaType: 'image/jpeg' as const },
        };
      } catch (err: any) {
        return { time, error: `Frame at ${time}s could not be fetched: ${err.message}` };
      }
    }),
  );

  const images: ImageInput[] = [];
  const timestamps: number[] = [];
  for (const frame of settled) {
    if ('image' in frame && frame.image) {
      images.push(frame.image);
      timestamps.push(frame.time);
    } else if ('error' in frame && frame.error) {
      warnings.push(frame.error);
    }
  }

  if (images.length === 0) {
    throw new Error(
      `No frames could be pulled from the recording. ${warnings.join(' ')}`.trim(),
    );
  }

  return { images, timestamps, warnings };
}
