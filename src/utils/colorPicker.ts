interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperConstructor {
  new (): { open: () => Promise<EyeDropperResult> };
}

export function isEyeDropperSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper ===
      'function'
  );
}

export async function pickScreenColorHex(): Promise<string | null> {
  if (!isEyeDropperSupported()) return null;
  try {
    const EyeDropperCtor = (
      window as unknown as { EyeDropper: EyeDropperConstructor }
    ).EyeDropper;
    const dropper = new EyeDropperCtor();
    const res = await dropper.open();
    if (res?.sRGBHex && res.sRGBHex.startsWith('#')) {
      return res.sRGBHex.toUpperCase();
    }
    return null;
  } catch {
    // User pressed Escape to cancel eyedropper
    return null;
  }
}

export function sampleCanvasColorAtNorm(
  canvas: HTMLCanvasElement | null | undefined,
  nx: number,
  ny: number
): { hex: string; luminance: number } | null {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(nx * canvas.width)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(ny * canvas.height)));
    const data = ctx.getImageData(px, py, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const hex = `#${[r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return { hex, luminance };
  } catch {
    return null;
  }
}
