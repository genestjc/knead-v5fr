'use client';

/**
 * Screenshots, made sendable in the browser before anything leaves it.
 *
 * Every screenshot goes through here, not just the oversized ones. A person
 * should never have to know what a megabyte is to use this tab, and "crop it
 * and try again" is a demand that the tool do its own job. See
 * lib/eval/image-fit.ts for why downscaling costs nothing: both providers
 * resize past ~1568px anyway, so the large version was being uploaded only to
 * be discarded before any model read it.
 *
 * JPEG, not PNG. A screenshot re-encoded as PNG is frequently LARGER than the
 * original because PNG is lossless and a photograph inside the screenshot does
 * not compress that way — which would turn this from a fix into a regression.
 */
import { base64Bytes, fitWithin, formatBytes, JPEG_QUALITY } from '@/lib/eval/image-fit';

export interface PreparedImage {
  /** A data: URL, ready to render as a thumbnail and to send. */
  dataUrl: string;
  bytes: number;
  /** Set when the file was resized, so the UI can say so rather than surprise. */
  note: string | null;
}

/**
 * Decode, fit, re-encode.
 *
 * Throws with a message a person can act on. The caller shows it next to the
 * file it belongs to rather than as a banner about "an image".
 */
export async function prepareImage(file: File, maxBytes: number): Promise<PreparedImage> {
  const original = file.size;
  const bitmap = await decode(file);

  try {
    const fitted = fitWithin(bitmap.width, bitmap.height);
    const resized = fitted.width !== bitmap.width || fitted.height !== bitmap.height;

    const canvas = document.createElement('canvas');
    canvas.width = fitted.width;
    canvas.height = fitted.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`${file.name} could not be processed — no canvas available.`);

    // Screenshots are mostly type, and the default nearest-neighbour path makes
    // downscaled type look chewed. This is the setting that keeps a caption
    // readable at 1600px.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // A white ground under anything with transparency: a PNG screenshot with an
    // alpha channel goes black on a JPEG background, which reads as a broken
    // screenshot rather than a converted one.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, fitted.width, fitted.height);
    ctx.drawImage(bitmap, 0, 0, fitted.width, fitted.height);

    let quality = JPEG_QUALITY;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    let bytes = base64Bytes(dataUrl.split(',')[1] ?? '');

    // A dense screenshot can still land over the budget at the default quality.
    // Step down twice before giving up — below ~0.5 the type starts to smear,
    // and a screenshot nobody can read is not worth sending.
    while (bytes > maxBytes && quality > 0.5) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      bytes = base64Bytes(dataUrl.split(',')[1] ?? '');
    }

    if (bytes > maxBytes) {
      throw new Error(
        `${file.name} is still ${formatBytes(bytes)} after resizing, over the ${formatBytes(maxBytes)} limit. ` +
          'Crop it to the part that matters, or record the screen instead — a recording is not limited this way.',
      );
    }

    return {
      dataUrl,
      bytes,
      note: resized
        ? `resized to ${fitted.width}×${fitted.height}, ${formatBytes(original)} → ${formatBytes(bytes)}`
        : null,
    };
  } finally {
    // createImageBitmap allocates outside the JS heap; without this a handful
    // of large screenshots hold on to real memory until GC gets around to it.
    if ('close' in bitmap) bitmap.close();
  }
}

/**
 * File → bitmap.
 *
 * `createImageBitmap` where it exists, which decodes off the main thread and
 * keeps the tab responsive while a 15MB screenshot is read. The <img> fallback
 * covers older Safari, where createImageBitmap on a Blob is unimplemented.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through — Safari rejects some blobs createImageBitmap claims to
      // support, and the <img> path decodes them fine.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} is not an image this browser can read.`));
    };
    img.src = url;
  });
}
