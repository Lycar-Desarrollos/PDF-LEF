import { PDFDocument } from 'pdf-lib';

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 320,
        height: img.naturalHeight || img.height || 180,
      });
    img.onerror = () => reject(new Error('Imagen no válida.'));
    img.src = dataUrl;
  });
}

export async function normalizeImageToPngBytes(dataUrl: string): Promise<Uint8Array> {
  if (dataUrl.startsWith('data:image/png;base64,')) {
    const base64 = dataUrl.split(',')[1] || '';
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, img.naturalWidth || img.width);
      canvas.height = Math.max(1, img.naturalHeight || img.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el lienzo.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const base64 = pngUrl.split(',')[1] || '';
      const bin = atob(base64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      resolve(out);
    };
    img.onerror = () => reject(new Error('Error procesando imagen para PDF.'));
    img.src = dataUrl;
  });
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full || '111318', 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Removes white/light paper background from a photographed signature
 * and optionally tints the ink stroke to a clean signature color.
 */
export function removeSignatureBackground(
  sourceDataUrl: string,
  inkHex?: string,
  threshold = 215
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 900;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Sin contexto 2D'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const tint = inkHex ? hexToRgbTuple(inkHex) : null;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        if (a < 10) continue;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum >= threshold) {
          d[i + 3] = 0;
        } else {
          const strength = Math.min(1, (threshold - lum) / 95);
          d[i + 3] = Math.round(a * strength);
          if (tint) {
            d[i] = tint[0];
            d[i + 1] = tint[1];
            d[i + 2] = tint[2];
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo procesar la firma.'));
    img.src = sourceDataUrl;
  });
}

export async function convertImagesToPdfBytes(
  files: File[],
  pagePreset: 'a4' | 'letter' | 'fit' = 'a4',
  marginPt = 28
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setCreator('PDF-LEF');
  pdfDoc.setProducer('PDF-LEF Native Engine');

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const dims = await getImageDimensions(dataUrl);
    const pngBytes = await normalizeImageToPngBytes(dataUrl);
    const embedded = await pdfDoc.embedPng(pngBytes);

    if (pagePreset === 'fit') {
      const page = pdfDoc.addPage([dims.width, dims.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
      });
    } else {
      const [pw, ph] = pagePreset === 'a4' ? [595.28, 841.89] : [612, 792];
      const isLandscape = dims.width > dims.height * 1.15;
      const finalW = isLandscape ? ph : pw;
      const finalH = isLandscape ? pw : ph;
      const page = pdfDoc.addPage([finalW, finalH]);

      const availW = Math.max(40, finalW - marginPt * 2);
      const availH = Math.max(40, finalH - marginPt * 2);
      const scale = Math.min(availW / dims.width, availH / dims.height);
      const drawW = dims.width * scale;
      const drawH = dims.height * scale;

      page.drawImage(embedded, {
        x: (finalW - drawW) / 2,
        y: (finalH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  return pdfDoc.save();
}
