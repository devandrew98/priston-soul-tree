// Client-side image compression: resize and re-encode as WebP (falls back to
// JPEG if the browser can't produce WebP) so uploads stay small. This is what
// keeps Supabase Storage egress in check — raw camera/screenshot files can be
// 10x+ bigger than what's ever displayed.
async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
}

async function canvasToFile(canvas: HTMLCanvasElement, baseName: string, quality: number): Promise<File> {
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (webp && webp.type === 'image/webp') return new File([webp], `${baseName}.webp`, { type: 'image/webp' });
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (jpeg) return new File([jpeg], `${baseName}.jpg`, { type: 'image/jpeg' });
  throw new Error('image encode failed');
}

/** Center-crop to a square and resize to size×size. Returns a compressed WebP/JPEG File. */
export async function squareThumbnail(file: File, size = 256, quality = 0.85): Promise<File> {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  try {
    return await canvasToFile(canvas, 'avatar', quality);
  } catch {
    return file;
  }
}

/** Resize to fit within maxSide×maxSide (keeps aspect ratio, no crop). Returns a compressed WebP/JPEG File. */
export async function compressPhoto(file: File, maxSide = 1280, quality = 0.82): Promise<File> {
  const img = await loadImage(file);
  let { width, height } = img;
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const base = (file.name.split('.')[0] || 'image').replace(/[^a-z0-9_-]/gi, '_');
  try {
    return await canvasToFile(canvas, base, quality);
  } catch {
    return file;
  }
}
