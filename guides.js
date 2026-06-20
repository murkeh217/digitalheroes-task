/* ════════════════════════════════════════════════════════════════
   guides.js — Draggable guide lines & point-to-point measurement
   ════════════════════════════════════════════════════════════════ */

// Polyfill for CanvasRenderingContext2D.roundRect (Safari < 15.4, older Chrome)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y,     x + w, y + h, r);
    this.arcTo(x + w, y + h, x,     y + h, r);
    this.arcTo(x,     y + h, x,     y,     r);
    this.arcTo(x,     y,     x + w, y,     r);
    this.closePath();
    return this;
  };
}

'use strict';

const GuidesEngine = (() => {

  // ── State ────────────────────────────────────────────────────────
  let guides = []; // { id, type: 'h'|'v', pos: px, el, labelEl }
  let guideIdCounter = 0;
  let measureArea = null;
  let measureCanvas = null;
  let measureCtx = null;
  let onMeasureCallback = null;

  // Point-to-point measurement state
  let measureMode = false;
  let point1 = null;
  let point2 = null;
  let measurePoints = []; // DOM elements

  // Gap badges
  let gapBadges = [];

  // ── Create Guide ─────────────────────────────────────────────────
  function createGuide(type, posPercent) {
    const id = ++guideIdCounter;
    const el = document.createElement('div');
    el.className = `guide-line ${type === 'h' ? 'horizontal' : 'vertical'}`;
    el.dataset.guideId = id;
    el.dataset.type = type;

    // Label showing position
    const labelEl = document.createElement('div');
    labelEl.className = 'guide-label';
    el.appendChild(labelEl);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'guide-delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Remove guide';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeGuide(id);
    });
    el.appendChild(deleteBtn);

    // Position the guide
    const rect = measureArea.getBoundingClientRect();
    let posPx;
    if (type === 'h') {
      posPx = posPercent !== undefined ? posPercent : rect.height / 2;
      el.style.top = posPx + 'px';
    } else {
      posPx = posPercent !== undefined ? posPercent : rect.width / 2;
      el.style.left = posPx + 'px';
    }

    // Make draggable
    makeDraggable(el, id, type);

    measureArea.appendChild(el);

    const guide = { id, type, pos: posPx, el, labelEl };
    guides.push(guide);
    updateGuideLabel(guide);
    updateGapBadges();
    hideHint();

    return guide;
  }

  // ── Remove Guide ─────────────────────────────────────────────────
  function removeGuide(id) {
    const idx = guides.findIndex(g => g.id === id);
    if (idx === -1) return;
    const guide = guides[idx];
    guide.el.style.opacity = '0';
    guide.el.style.transform = guide.type === 'h' ? 'scaleY(0)' : 'scaleX(0)';
    setTimeout(() => {
      if (guide.el.parentNode) guide.el.parentNode.removeChild(guide.el);
    }, 200);
    guides.splice(idx, 1);
    updateGapBadges();
    if (guides.length === 0) showHint();
  }

  function clearAllGuides() {
    [...guides].forEach(g => removeGuide(g.id));
    clearMeasurePoints();
  }

  // ── Drag ─────────────────────────────────────────────────────────
  function makeDraggable(el, id, type) {
    let dragging = false;
    let startPos = 0;
    let startMouse = 0;

    const onDown = (e) => {
      if (e.target.classList.contains('guide-delete-btn')) return;
      dragging = true;
      el.classList.add('dragging');
      if (type === 'h') {
        startPos   = parseFloat(el.style.top)  || 0;
        startMouse = e.clientY;
      } else {
        startPos   = parseFloat(el.style.left) || 0;
        startMouse = e.clientX;
      }
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const client = e.touches ? e.touches[0] : e;
      const rect = measureArea.getBoundingClientRect();
      let pos;
      if (type === 'h') {
        pos = startPos + (client.clientY - startMouse);
        pos = Math.max(0, Math.min(rect.height, pos));
        el.style.top = pos + 'px';
      } else {
        pos = startPos + (client.clientX - startMouse);
        pos = Math.max(0, Math.min(rect.width, pos));
        el.style.left = pos + 'px';
      }
      const guide = guides.find(g => g.id === id);
      if (guide) {
        guide.pos = pos;
        updateGuideLabel(guide);
        updateGapBadges();
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
    };

    el.addEventListener('mousedown',  onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchend',   onUp);
  }

  // ── Guide Labels ─────────────────────────────────────────────────
  function updateGuideLabel(guide) {
    if (!RulerEngine) return;
    const pos = guide.pos;
    const measurement = RulerEngine.pixelToMeasure(pos);
    guide.labelEl.textContent = measurement;
  }

  function updateAllLabels() {
    guides.forEach(g => updateGuideLabel(g));
    updateGapBadges();
  }

  // ── Gap Badges ───────────────────────────────────────────────────
  function updateGapBadges() {
    // Remove old badges
    gapBadges.forEach(b => { if (b.parentNode) b.parentNode.removeChild(b); });
    gapBadges = [];

    // Horizontal guides sorted by position
    const hGuides = guides.filter(g => g.type === 'h').sort((a, b) => a.pos - b.pos);
    const vGuides = guides.filter(g => g.type === 'v').sort((a, b) => a.pos - b.pos);

    // Create gap badge between each pair of adjacent guides
    for (let i = 0; i < hGuides.length - 1; i++) {
      const a = hGuides[i], b = hGuides[i + 1];
      const gapPx = b.pos - a.pos;
      const badge = makeBadge(gapPx, 'h', (a.pos + b.pos) / 2);
      gapBadges.push(badge);
    }
    for (let i = 0; i < vGuides.length - 1; i++) {
      const a = vGuides[i], b = vGuides[i + 1];
      const gapPx = b.pos - a.pos;
      const badge = makeBadge(gapPx, 'v', (a.pos + b.pos) / 2);
      gapBadges.push(badge);
    }
  }

  function makeBadge(gapPx, type, centerPos) {
    const badge = document.createElement('div');
    badge.className = 'gap-badge';
    const measurement = RulerEngine ? RulerEngine.pixelToMeasure(gapPx) : gapPx.toFixed(0) + 'px';
    badge.textContent = '↕ ' + measurement;

    if (type === 'h') {
      badge.style.top  = (centerPos - 12) + 'px';
      badge.style.left = '50%';
      badge.style.transform = 'translateX(-50%)';
    } else {
      badge.textContent = '↔ ' + measurement;
      badge.style.left = (centerPos - 30) + 'px';
      badge.style.top  = '50%';
      badge.style.transform = 'translateY(-50%)';
    }

    // Click to copy
    badge.style.cursor = 'pointer';
    badge.title = 'Click to copy';
    badge.addEventListener('click', () => {
      navigator.clipboard.writeText(measurement).then(() => showCopiedToast());
    });

    measureArea.appendChild(badge);
    return badge;
  }

  // ── Point-to-Point Measurement ───────────────────────────────────
  function enableMeasureMode() {
    measureMode = true;
    point1 = null;
    point2 = null;
    clearMeasureCanvas();
    measureArea.style.cursor = 'crosshair';
    measureArea.classList.add('measure-mode');
    measureArea.addEventListener('click', onMeasureClick);
    measureArea.addEventListener('mousemove', onMeasureHover);
  }

  function disableMeasureMode() {
    measureMode = false;
    measureArea.style.cursor = '';
    measureArea.classList.remove('measure-mode');
    measureArea.removeEventListener('click', onMeasureClick);
    measureArea.removeEventListener('mousemove', onMeasureHover);
    clearMeasureCanvas();
    clearMeasurePoints();
  }

  function onMeasureClick(e) {
    const rect = measureArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!point1) {
      point1 = { x, y };
      addMeasurePoint(x, y);
    } else if (!point2) {
      point2 = { x, y };
      addMeasurePoint(x, y);
      drawMeasureLine(point1, point2);
      const dist = Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
      const measurement = RulerEngine ? RulerEngine.pixelToMeasure(dist) : dist.toFixed(1) + 'px';

      if (onMeasureCallback) onMeasureCallback(measurement, point1, point2);
      // Allow re-measurement on next click
      setTimeout(() => {
        clearMeasurePoints();
        clearMeasureCanvas();
        point1 = null;
        point2 = null;
      }, 3000);
    }
  }

  let hoverLine = null;
  function onMeasureHover(e) {
    if (!point1) return;
    const rect = measureArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawMeasureLine(point1, { x, y }, true);
  }

  function drawMeasureLine(p1, p2, isPreview) {
    if (!measureCanvas) return;
    const rect = measureArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    // Only resize canvas if dimensions changed (avoids flicker)
    if (measureCanvas.width !== w * dpr || measureCanvas.height !== h * dpr) {
      measureCanvas.width  = w * dpr;
      measureCanvas.height = h * dpr;
      measureCanvas.style.width  = w + 'px';
      measureCanvas.style.height = h + 'px';
    }

    measureCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    measureCtx.clearRect(0, 0, rect.width, rect.height);

    // Line
    measureCtx.beginPath();
    measureCtx.moveTo(p1.x, p1.y);
    measureCtx.lineTo(p2.x, p2.y);
    measureCtx.strokeStyle = isPreview ? 'rgba(0,200,255,0.5)' : 'rgba(0,200,255,0.9)';
    measureCtx.lineWidth = isPreview ? 1 : 2;
    measureCtx.setLineDash(isPreview ? [6, 4] : []);
    measureCtx.stroke();
    measureCtx.setLineDash([]);

    // Distance label at midpoint
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const measurement = RulerEngine ? RulerEngine.pixelToMeasure(dist) : dist.toFixed(1) + 'px';

    if (dist > 20) {
      measureCtx.fillStyle = 'rgba(13,17,23,0.85)';
      const w = measureCtx.measureText(measurement).width + 16;
      measureCtx.beginPath();
      measureCtx.roundRect(mx - w/2, my - 12, w, 22, 4);
      measureCtx.fill();

      measureCtx.fillStyle = '#00c8ff';
      measureCtx.font = `500 11px 'JetBrains Mono', monospace`;
      measureCtx.textAlign = 'center';
      measureCtx.textBaseline = 'middle';
      measureCtx.fillText(measurement, mx, my);
    }

    // Reset transform
    measureCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function clearMeasureCanvas() {
    if (measureCtx && measureCanvas) {
      measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
    }
  }

  function addMeasurePoint(x, y) {
    const dot = document.createElement('div');
    dot.className = 'measure-point';
    dot.style.left = x + 'px';
    dot.style.top  = y + 'px';
    measureArea.appendChild(dot);
    measurePoints.push(dot);
  }

  function clearMeasurePoints() {
    measurePoints.forEach(p => { if (p.parentNode) p.parentNode.removeChild(p); });
    measurePoints = [];
  }

  // ── Hint visibility ──────────────────────────────────────────────
  function hideHint() {
    const hint = document.getElementById('measure-hint');
    if (hint) hint.classList.add('hidden');
  }
  function showHint() {
    const hint = document.getElementById('measure-hint');
    if (hint && guides.length === 0) hint.classList.remove('hidden');
  }

  // ── Copied Toast ─────────────────────────────────────────────────
  function showCopiedToast() {
    const t = document.getElementById('copied-toast');
    if (!t) return;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init(area, canvas) {
    measureArea   = area;
    measureCanvas = canvas;
    if (canvas) measureCtx = canvas.getContext('2d');
  }

  function onMeasure(fn) { onMeasureCallback = fn; }

  function isMeasureMode() { return measureMode; }

  return {
    init,
    createGuide,
    removeGuide,
    clearAllGuides,
    updateAllLabels,
    enableMeasureMode,
    disableMeasureMode,
    isMeasureMode,
    onMeasure,
  };

})();
