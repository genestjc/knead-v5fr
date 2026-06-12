'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Loader2, ImageIcon } from 'lucide-react';

type Format = 'square' | 'portrait' | 'story';
type TextPosition = 'top' | 'center' | 'bottom';
type TextColor = 'white' | 'black';

const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5' },
  story: { w: 1080, h: 1920, label: 'Story 9:16' },
};

const CREAM = '#f4f2ec';
const INK = '#141414';

/** Greedy word-wrap for canvas text */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function SocialAssetStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<Format>('square');
  const [kicker, setKicker] = useState('');
  const [headline, setHeadline] = useState('');
  const [byline, setByline] = useState('');
  const [textColor, setTextColor] = useState<TextColor>('white');
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom');
  const [overlay, setOverlay] = useState(45);
  // Image placement within the frame: 0..1 on each axis (0.5 = centered), plus zoom
  const [posX, setPosX] = useState(0.5);
  const [posY, setPosY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [imagePan, setImagePan] = useState(50);
  const [showWordmark, setShowWordmark] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load brand fonts into the document so canvas can use them
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      document.fonts.load('400 100px "adonis-web"'),
      document.fonts.load('400 100px "Georgia Pro"'),
      document.fonts.load('italic 400 100px "Georgia Pro"'),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFontsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
  }

  const draw = useCallback(
    (withGuides: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { w: W, h: H } = FORMATS[format];
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, W, H);

      // Image — cover fit with vertical pan
      if (image) {
        const scale = Math.max(W / image.width, H / image.height);
        const dw = image.width * scale;
        const dh = image.height * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) * (imagePan / 100);
        ctx.drawImage(image, dx, dy, dw, dh);
      }

      // Legibility overlay
      if (image && overlay > 0) {
        const alpha = overlay / 100;
        if (textPosition === 'center') {
          ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
          ctx.fillRect(0, 0, W, H);
        } else {
          const grad =
            textPosition === 'bottom'
              ? ctx.createLinearGradient(0, H * 0.35, 0, H)
              : ctx.createLinearGradient(0, H * 0.65, 0, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        }
      }

      const color = textColor === 'white' ? '#ffffff' : INK;
      const pad = W * 0.085;
      const maxWidth = W - pad * 2;
      // Keep text clear of Instagram's story UI (~13% top and bottom)
      const topSafe = format === 'story' ? H * 0.13 : pad;
      const bottomSafe = format === 'story' ? H * 0.13 : pad;

      ctx.textBaseline = 'top';

      // Wordmark — top center, like a masthead
      let wordmarkBottom = topSafe;
      if (showWordmark) {
        const ws = W * 0.055;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.font = `400 ${ws}px "adonis-web", serif`;
        try {
          (ctx as any).letterSpacing = `${W * 0.012}px`;
        } catch {}
        ctx.fillText('KNEAD', W / 2 + W * 0.006, topSafe);
        try {
          (ctx as any).letterSpacing = '0px';
        } catch {}
        wordmarkBottom = topSafe + ws + W * 0.05;
      }

      // Measure the text block
      const kickerSize = W * 0.026;
      const headlineSize = W * 0.075;
      const headlineLine = headlineSize * 1.12;
      const bylineSize = W * 0.028;

      ctx.font = `400 ${headlineSize}px "adonis-web", serif`;
      const headlineLines = headline ? wrapText(ctx, headline, maxWidth) : [];

      let blockHeight = 0;
      if (kicker) blockHeight += kickerSize + W * 0.03;
      blockHeight += headlineLines.length * headlineLine;
      if (byline) blockHeight += W * 0.035 + bylineSize;

      let y: number;
      if (textPosition === 'bottom') {
        y = H - bottomSafe - blockHeight;
      } else if (textPosition === 'top') {
        y = wordmarkBottom;
      } else {
        y = (H - blockHeight) / 2;
      }

      // Kicker
      ctx.textAlign = 'left';
      if (kicker) {
        ctx.fillStyle = color;
        ctx.font = `400 ${kickerSize}px "Georgia Pro", Georgia, serif`;
        try {
          (ctx as any).letterSpacing = `${W * 0.006}px`;
        } catch {}
        ctx.fillText(kicker.toUpperCase(), pad, y);
        try {
          (ctx as any).letterSpacing = '0px';
        } catch {}
        y += kickerSize + W * 0.03;
      }

      // Headline
      ctx.fillStyle = color;
      ctx.font = `400 ${headlineSize}px "adonis-web", serif`;
      for (const line of headlineLines) {
        ctx.fillText(line, pad, y);
        y += headlineLine;
      }

      // Byline
      if (byline) {
        y += W * 0.035;
        ctx.fillStyle = color;
        ctx.font = `italic 400 ${bylineSize}px "Georgia Pro", Georgia, serif`;
        ctx.fillText(byline, pad, y);
      }

      // Story safe-zone guides — preview only, never exported
      if (withGuides && format === 'story') {
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.moveTo(0, H * 0.13);
        ctx.lineTo(W, H * 0.13);
        ctx.moveTo(0, H * 0.87);
        ctx.lineTo(W, H * 0.87);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 80, 80, 0.85)';
        ctx.font = '400 28px Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText('IG story UI — keep text inside', 24, H * 0.13 + 16);
      }
    },
    [
      format,
      image,
      imagePan,
      overlay,
      textPosition,
      textColor,
      kicker,
      headline,
      byline,
      showWordmark,
    ],
  );

  // Redraw whenever anything changes
  useEffect(() => {
    if (!fontsReady) return;
    draw(showGuides);
  }, [draw, fontsReady, showGuides]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);
    draw(false); // strip preview guides before export
    canvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `knead-${format}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      draw(showGuides); // restore guides in preview
      setDownloading(false);
    }, 'image/png');
  }

  const { w: exportW, h: exportH } = FORMATS[format];

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr] items-start">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="font-adonis text-2xl mb-1">Social Asset Studio</h2>
          <p className="font-georgia-pro text-sm text-gray-500">
            Upload an image, set the type, download a ready-to-post asset.
          </p>
        </div>

        {/* Upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-black rounded-xl py-4 font-georgia-pro text-sm text-gray-600 hover:text-black transition"
          >
            <Upload size={16} />
            {image ? 'Replace image' : 'Upload high-res image'}
          </button>
        </div>

        {/* Format */}
        <div>
          <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-2">
            Format
          </label>
          <div className="flex gap-2">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-2 rounded-lg text-xs font-georgia-pro border transition ${
                  format === f
                    ? 'bg-black text-white border-black'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {FORMATS[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* Text fields */}
        <div className="space-y-3">
          <div>
            <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-1.5">
              Kicker (Georgia Pro caps)
            </label>
            <input
              value={kicker}
              onChange={(e) => setKicker(e.target.value)}
              placeholder="e.g. Culture · New Story"
              className="w-full text-sm font-georgia-pro bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div>
            <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-1.5">
              Headline (Adonis)
            </label>
            <textarea
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Can We Make Websites Fun Again?"
              rows={2}
              className="w-full text-sm font-georgia-pro bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black resize-none"
            />
          </div>
          <div>
            <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-1.5">
              Byline (Georgia Pro italic)
            </label>
            <input
              value={byline}
              onChange={(e) => setByline(e.target.value)}
              placeholder="By Joseph Genest"
              className="w-full text-sm font-georgia-pro bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Layout controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-2">
              Text position
            </label>
            <div className="flex gap-1.5">
              {(['top', 'center', 'bottom'] as TextPosition[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setTextPosition(p)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-georgia-pro border capitalize transition ${
                    textPosition === p
                      ? 'bg-black text-white border-black'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-2">
              Text color
            </label>
            <div className="flex gap-1.5">
              {(['white', 'black'] as TextColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-georgia-pro border capitalize transition ${
                    textColor === c
                      ? 'bg-black text-white border-black'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <div>
            <label className="flex justify-between font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-1.5">
              <span>Darken for legibility</span>
              <span>{overlay}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={80}
              value={overlay}
              onChange={(e) => setOverlay(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>
          <div>
            <label className="flex justify-between font-georgia-pro text-xs uppercase tracking-wide text-gray-500 mb-1.5">
              <span>Image focal point</span>
              <span>{imagePan < 40 ? 'top' : imagePan > 60 ? 'bottom' : 'center'}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={imagePan}
              onChange={(e) => setImagePan(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-georgia-pro text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showWordmark}
              onChange={(e) => setShowWordmark(e.target.checked)}
              className="accent-black"
            />
            KNEAD wordmark
          </label>
          {format === 'story' && (
            <label className="flex items-center gap-2 font-georgia-pro text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="accent-black"
              />
              Show story safe-zone guides (preview only)
            </label>
          )}
        </div>

        {/* Download */}
        <button
          onClick={download}
          disabled={downloading || !fontsReady}
          className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-xl py-3 font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Download PNG · {exportW}×{exportH}
        </button>
      </div>

      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
          style={{ maxWidth: format === 'story' ? 320 : 460 }}
        >
          {!fontsReady ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-24 px-12">
              <Loader2 size={16} className="animate-spin" />
              <span className="font-georgia-pro text-sm">Loading fonts…</span>
            </div>
          ) : null}
          <canvas
            ref={canvasRef}
            className={`w-full h-auto rounded-md ${fontsReady ? '' : 'hidden'}`}
          />
        </div>
        <p className="font-georgia-pro text-xs text-gray-400 flex items-center gap-1.5">
          <ImageIcon size={12} />
          Preview is the exact export — what you see is what downloads.
        </p>
      </div>
    </div>
  );
}
