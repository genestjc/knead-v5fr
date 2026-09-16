/**
 * Sizing screenshots so they upload at all.
 *
 * THE BUG THIS FIXES. A screenshot taken on a modern phone or a retina display
 * is routinely 8-15MB — an iPhone screenshot is 1290×2796 before the display
 * scale factor, and a full-height capture of a long Instagram thread is far
 * larger. The audit was refusing those at the door, which meant the most
 * obvious thing a person would try was the thing that did not work.
 *
 * Raising the limit would not have fixed it. The per-request body cap is a few
 * megabytes on the platform and base64 inflates a file by a third, so four
 * real screenshots cannot be sent whatever the limit says.
 *
 * DOWNSCALING COSTS NOTHING HERE, which is the part worth knowing. Anthropic
 * resizes anything over roughly 1568px on the long edge before the model sees
 * it, and OpenAI does the same at its own bound. Sending a 15MB screenshot
 * means paying to upload pixels that are discarded server-side before any
 * model reads them. Fitting to 1600px in the browser sends the same picture the
 * model was going to see anyway.
 *
 * Caption text stays legible at that size: an Instagram caption occupies a wide
 * band of a phone screenshot, so it lands at a comfortable reading size even
 * after the long edge is bounded.
 */

/**
 * The long edge to fit within.
 *
 * 1600, just above the ~1568px both providers downscale to, so a picture that
 * is already smaller than their bound is never enlarged and one that is larger
 * arrives at the size they would have made it.
 */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG quality. 0.85 is where screenshot text stops showing ringing artifacts. */
export const JPEG_QUALITY = 0.85;

/**
 * Total DECODED image bytes one audit request may carry, across every post.
 *
 * The arithmetic, because getting it wrong is silent: the platform caps a
 * serverless request body at 4.5MB, and base64 inflates a payload by 4/3. So
 * the decoded budget is 4.5MB × 3/4 = 3.375MB before any JSON overhead —
 * captions, notes, the field names. 2.8MB leaves room for that and still fits
 * roughly a dozen resized screenshots.
 *
 * An earlier value of 3.5MB was over the line: it would have passed this check
 * and then been rejected by the edge with a status nobody can debug from the
 * console.
 *
 * Shared between the browser (which warns before you press the button) and the
 * route (which is the authority), so the two can never disagree about what
 * fits.
 */
export const MAX_INLINE_IMAGE_BYTES = 2_800_000;

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Fit within a bounding square, preserving aspect ratio.
 *
 * Never enlarges: a small image that is already under the bound is returned
 * unchanged rather than upscaled into a blurrier version of itself that costs
 * more to send.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
): Dimensions {
  // A zero or non-finite dimension means the browser could not decode the
  // image. Returning it unchanged lets the caller fail on the real problem
  // rather than on a division by zero here.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width, height };
  }

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };

  const scale = maxEdge / longest;
  return {
    // At least 1px on the short edge: a 4000×3 panorama would otherwise round
    // its height to zero and produce a canvas nothing can be drawn on.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Decoded byte length of a base64 payload, without materialising it. */
export function base64Bytes(data: string): number {
  if (!data) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/** "2.4MB", "870KB" — for error messages a person has to act on. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.round(bytes / 1_000)}KB`;
}
