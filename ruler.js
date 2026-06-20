/* ════════════════════════════════════════════════════════════════
   ruler.js — Canvas-based ruler rendering engine
   ════════════════════════════════════════════════════════════════ */

'use strict';

const RulerEngine = (() => {

  // ── State ────────────────────────────────────────────────────────
  let ppi = 96;
  let unit = 'cm';
  let activeEdges = { top: true, bottom: true, left: true, right: true };
  let scrollOffset = { x: 0, y: 0 }; // for future scrollable ruler

  // Canvas references
  let canvases = {};
  let contexts = {};

  // ── Theme ────────────────────────────────────────────────────────
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      bg:          isDark ? '#0f1923'               : '#e0e3e8',
      tick:        isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
      tickMajor:   isDark ? 'rgba(255,255,255,0.85)': 'rgba(0,0,0,0.75)',
      number:      isDark ? 'rgba(255,255,255,0.55)': 'rgba(0,0,0,0.55)',
      accent:      '#00c8ff',
      zeroLine:    isDark ? 'rgba(255,255,255,0.12)': 'rgba(0,0,0,0.1)',
    };
  }

  // ── Unit Conversion ──────────────────────────────────────────────
  const UNITS = {
    cm: { pxPerUnit: () => ppi / 2.54,   label: 'cm',    subDivs: [1, 5, 10],  subPx: () => (ppi / 2.54) / 10 },
    mm: { pxPerUnit: () => ppi / 25.4,   label: 'mm',    subDivs: [1, 5, 10],  subPx: () => ppi / 25.4 },
    in: { pxPerUnit: () => ppi,           label: '"',     subDivs: [16,8,4,2,1],subPx: () => ppi / 16 },
    px: { pxPerUnit: () => 1,             label: 'px',    subDivs: [10, 50, 100],subPx: () => 10 },
  };

  function pixelsPerUnit() {
    return UNITS[unit].pxPerUnit();
  }

  function pixelToUnit(px) {
    const ppu = pixelsPerUnit();
    return px / ppu;
  }

  function unitToLabel(value) {
    if (unit === 'px') return Math.round(value) + ' px';
    if (unit === 'in') {
      // Show fractions for inches
      const whole = Math.floor(value);
      const frac  = value - whole;
      if (frac < 0.01) return whole + '"';
      // Find nearest 1/16
      const n = Math.round(frac * 16);
      if (n === 0) return whole + '"';
      const d = 16;
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      const g = gcd(n, d);
      return (whole > 0 ? whole + ' ' : '') + (n/g) + '/' + (d/g) + '"';
    }
    return value.toFixed(2) + ' ' + unit;
  }

  // ── Ruler Drawing ────────────────────────────────────────────────
  function drawHorizontalRuler(canvas, ctx, offset) {
    const C = getThemeColors();
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Bottom border line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(0, H - dpr / 2);
    ctx.lineTo(W, H - dpr / 2);
    ctx.stroke();

    const ppu = pixelsPerUnit() * dpr; // pixels per unit in physical coords

    ctx.save();
    ctx.translate(-offset * dpr, 0);

    const startUnit = Math.floor(offset / pixelsPerUnit());
    const endUnit   = Math.ceil((offset + W / dpr) / pixelsPerUnit()) + 1;

    // Draw ticks
    ctx.lineWidth = dpr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const fontSizePt = Math.round(9 * dpr);
    ctx.font = `${fontSizePt}px 'JetBrains Mono', 'Courier New', monospace`;

    for (let u = startUnit; u <= endUnit; u++) {
      const x = u * ppu;

      // Determine tick type
      let tickH, color, drawLabel;
      if (unit === 'in') {
        // Inches: draw at every 1/16
        // Already handled per sub-loop
        drawLabel = true;
        tickH = H * 0.55;
        color = C.tickMajor;
      } else {
        drawLabel = true;
        tickH = H * 0.55;
        color = C.tickMajor;
      }

      // Major unit tick
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tickH);
      ctx.stroke();

      // Number label
      if (drawLabel && u > startUnit) {
        ctx.fillStyle = C.number;
        const labelVal = unit === 'px' ? u * 100 : u;
        ctx.fillText(String(labelVal), x, tickH + 2);
      }

      // Sub-ticks
      if (unit === 'cm') {
        // 10 sub-divisions = 1mm each
        for (let i = 1; i < 10; i++) {
          const sx = x + (ppu / 10) * i;
          const isMid = i === 5;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * (isMid ? 1 : 0.6);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, isMid ? H * 0.38 : H * 0.22);
          ctx.stroke();
        }
      } else if (unit === 'mm') {
        // 10 sub-divisions = 0.1mm each (too small usually), show 5
        for (let i = 1; i < 5; i++) {
          const sx = x + (ppu / 5) * i;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, H * 0.2);
          ctx.stroke();
        }
      } else if (unit === 'in') {
        // 16 sub-divisions
        for (let i = 1; i < 16; i++) {
          const sx = x + (ppu / 16) * i;
          const is8   = i === 8;
          const is4   = i % 4 === 0;
          const is2   = i % 2 === 0;
          const h = is8 ? H * 0.4 : is4 ? H * 0.3 : is2 ? H * 0.22 : H * 0.14;
          ctx.strokeStyle = is8 ? C.tickMajor : C.tick;
          ctx.lineWidth = dpr * (is8 ? 1 : 0.6);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
          ctx.stroke();
        }
      } else if (unit === 'px') {
        // Sub-ticks every 10px
        const subPx = 10 * dpr;
        for (let i = 1; i < 10; i++) {
          const sx = x + subPx * i;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, H * (i === 5 ? 0.3 : 0.18));
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function drawVerticalRuler(canvas, ctx, offset) {
    const C = getThemeColors();
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Right border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(W - dpr / 2, 0);
    ctx.lineTo(W - dpr / 2, H);
    ctx.stroke();

    const ppu = pixelsPerUnit() * dpr;

    ctx.save();
    ctx.translate(0, -offset * dpr);

    const startUnit = Math.floor(offset / pixelsPerUnit());
    const endUnit   = Math.ceil((offset + H / dpr) / pixelsPerUnit()) + 1;

    ctx.lineWidth = dpr;
    ctx.textBaseline = 'middle';
    const fontSizePt = Math.round(9 * dpr);
    ctx.font = `${fontSizePt}px 'JetBrains Mono', 'Courier New', monospace`;

    for (let u = startUnit; u <= endUnit; u++) {
      const y = u * ppu;
      const tickW = W * 0.55;

      // Major tick
      ctx.strokeStyle = C.tickMajor;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tickW, y);
      ctx.stroke();

      // Number — rotate and draw
      if (u > startUnit) {
        ctx.save();
        ctx.fillStyle = C.number;
        ctx.translate(W - 2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        const labelVal = unit === 'px' ? u * 100 : u;
        ctx.fillText(String(labelVal), 0, 0);
        ctx.restore();
      }

      // Sub-ticks
      if (unit === 'cm') {
        for (let i = 1; i < 10; i++) {
          const sy = y + (ppu / 10) * i;
          const isMid = i === 5;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * (isMid ? 1 : 0.6);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(isMid ? W * 0.38 : W * 0.22, sy);
          ctx.stroke();
        }
      } else if (unit === 'mm') {
        for (let i = 1; i < 5; i++) {
          const sy = y + (ppu / 5) * i;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(W * 0.2, sy);
          ctx.stroke();
        }
      } else if (unit === 'in') {
        for (let i = 1; i < 16; i++) {
          const sy = y + (ppu / 16) * i;
          const is8 = i === 8;
          const is4 = i % 4 === 0;
          const is2 = i % 2 === 0;
          const w = is8 ? W * 0.4 : is4 ? W * 0.3 : is2 ? W * 0.22 : W * 0.14;
          ctx.strokeStyle = is8 ? C.tickMajor : C.tick;
          ctx.lineWidth = dpr * (is8 ? 1 : 0.6);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
          ctx.stroke();
        }
      } else if (unit === 'px') {
        const subPx = 10 * dpr;
        for (let i = 1; i < 10; i++) {
          const sy = y + subPx * i;
          ctx.strokeStyle = C.tick;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(W * (i === 5 ? 0.3 : 0.18), sy);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  // ── Canvas Resize ────────────────────────────────────────────────
  function sizeCanvas(canvas) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
    }
  }

  // ── Cursor indicator line ─────────────────────────────────────
  let cursorX = null, cursorY = null;

  function drawCursorLine(canvasId, axis) {
    const canvas = canvases[canvasId];
    if (!canvas) return;
    // redraw ruler with cursor marker
    renderAll();
  }

  // ── Render All ───────────────────────────────────────────────────
  function renderAll() {
    const dpr = window.devicePixelRatio || 1;

    if (activeEdges.top && canvases.top) {
      sizeCanvas(canvases.top);
      const ctx = contexts.top;
      drawHorizontalRuler(canvases.top, ctx, scrollOffset.x);
      // Cursor marker
      if (cursorX !== null) {
        const x = (cursorX - scrollOffset.x) * dpr;
        ctx.strokeStyle = 'rgba(0,200,255,0.7)';
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvases.top.height);
        ctx.stroke();
      }
    }

    if (activeEdges.bottom && canvases.bottom) {
      sizeCanvas(canvases.bottom);
      const ctx = contexts.bottom;
      drawHorizontalRuler(canvases.bottom, ctx, scrollOffset.x);
      if (cursorX !== null) {
        const x = (cursorX - scrollOffset.x) * (window.devicePixelRatio || 1);
        ctx.strokeStyle = 'rgba(0,200,255,0.7)';
        ctx.lineWidth = window.devicePixelRatio || 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvases.bottom.height);
        ctx.stroke();
      }
    }

    if (activeEdges.left && canvases.left) {
      sizeCanvas(canvases.left);
      const ctx = contexts.left;
      drawVerticalRuler(canvases.left, ctx, scrollOffset.y);
      if (cursorY !== null) {
        const y = (cursorY - scrollOffset.y) * dpr;
        ctx.strokeStyle = 'rgba(0,200,255,0.7)';
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvases.left.width, y);
        ctx.stroke();
      }
    }

    if (activeEdges.right && canvases.right) {
      sizeCanvas(canvases.right);
      const ctx = contexts.right;
      drawVerticalRuler(canvases.right, ctx, scrollOffset.y);
      if (cursorY !== null) {
        const y = (cursorY - scrollOffset.y) * dpr;
        ctx.strokeStyle = 'rgba(0,200,255,0.7)';
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvases.right.width, y);
        ctx.stroke();
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────────
  function init(canvasMap) {
    // canvasMap: { top, bottom, left, right }
    canvases = canvasMap;
    for (const [key, canvas] of Object.entries(canvasMap)) {
      if (canvas) contexts[key] = canvas.getContext('2d');
    }
    renderAll();
  }

  function setPPI(newPPI) {
    ppi = newPPI;
    renderAll();
  }

  function setUnit(newUnit) {
    unit = newUnit;
    renderAll();
  }

  function setEdgeActive(edge, active) {
    activeEdges[edge] = active;
    renderAll();
  }

  function updateCursor(x, y) {
    cursorX = x;
    cursorY = y;
    renderAll();
  }

  function pixelToMeasure(px) {
    const ppu = pixelsPerUnit();
    const value = px / ppu;
    return unitToLabel(value);
  }

  function pixelToRaw(px) {
    return px / pixelsPerUnit();
  }

  function formatValue(value) {
    return unitToLabel(value);
  }

  function getUnit() { return unit; }
  function getPPU()  { return pixelsPerUnit(); }

  return {
    init,
    setPPI,
    setUnit,
    setEdgeActive,
    updateCursor,
    renderAll,
    pixelToMeasure,
    pixelToRaw,
    formatValue,
    getUnit,
    getPPU,
  };

})();
