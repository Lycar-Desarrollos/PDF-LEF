export function normalizeAngleDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  const rounded = Math.round(a * 2) / 2;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function snapRotationAngleDeg(rawDeg: number, shiftSnap = false): number {
  const norm = normalizeAngleDeg(rawDeg);
  if (shiftSnap) {
    return normalizeAngleDeg(Math.round(norm / 15) * 15);
  }
  const cardinals = [0, 90, -90, 180, -180];
  for (const card of cardinals) {
    if (Math.abs(norm - card) <= 3) {
      return normalizeAngleDeg(card);
    }
  }
  return normalizeAngleDeg(Math.round(norm));
}

/**
 * Computes smooth zero-jump clockwise rotation angle in degrees (-180..180]
 * from initial pointer angle to current pointer angle around element center (centerX, centerY).
 */
export function computeRelativeDragRotationDeg(
  centerX: number,
  centerY: number,
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
  initialRotationDeg = 0,
  shiftSnap = false
): number {
  const startDx = startClientX - centerX;
  const startDy = startClientY - centerY;
  const curDx = currentClientX - centerX;
  const curDy = currentClientY - centerY;
  if (Math.hypot(startDx, startDy) < 2 || Math.hypot(curDx, curDy) < 2) {
    return normalizeAngleDeg(initialRotationDeg);
  }

  const a0 = (Math.atan2(startDy, startDx) * 180) / Math.PI;
  const a1 = (Math.atan2(curDy, curDx) * 180) / Math.PI;
  return snapRotationAngleDeg(initialRotationDeg + (a1 - a0), shiftSnap);
}

/**
 * Rotates a PDF coordinate point (px, py) around visual box center (cx, cy)
 * for a visual clockwise angle `clockwiseDeg`.
 * PDF page coordinates have +X right and +Y UP, so clockwise visual rotation
 * corresponds to counter-clockwise mathematical angle `-clockwiseDeg`.
 */
export function rotatePdfPointAroundCenter(
  px: number,
  py: number,
  cx: number,
  cy: number,
  clockwiseDeg: number
): { x: number; y: number } {
  const norm = normalizeAngleDeg(clockwiseDeg);
  if (Math.abs(norm) <= 0.05) {
    return { x: px, y: py };
  }
  const rad = (-norm * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}
