/* ════════════════════════════════════════════════════════════════
   calibration.js — PPI detection & 3 calibration methods
   ════════════════════════════════════════════════════════════════ */

'use strict';

const Calibration = (() => {

  // ── Device PPI Database ─────────────────────────────────────────
  // Key: "cssWidthxcssHeight" at devicePixelRatio
  // Value: { ppi, name }
  const DEVICE_DB = [
    // MacBooks
    { w: 1440, h: 900,  dpr: 2,   ppi: 220, name: 'MacBook Air 13"' },
    { w: 1280, h: 800,  dpr: 2,   ppi: 227, name: 'MacBook Pro 13" (early)' },
    { w: 1440, h: 900,  dpr: 1,   ppi: 110, name: 'MacBook Air 13" (non-Retina)' },
    { w: 1512, h: 982,  dpr: 2,   ppi: 220, name: 'MacBook Pro 14" (M1/M2)' },
    { w: 1728, h: 1117, dpr: 2,   ppi: 220, name: 'MacBook Pro 16" (M1/M2)' },
    { w: 1470, h: 956,  dpr: 2,   ppi: 224, name: 'MacBook Air 15" (M2)' },

    // Dell XPS
    { w: 1920, h: 1200, dpr: 1,   ppi: 166, name: 'Dell XPS 13 (FHD+)' },
    { w: 1920, h: 1200, dpr: 1.5, ppi: 166, name: 'Dell XPS 13 (FHD+ 150%)' },
    { w: 3840, h: 2400, dpr: 2,   ppi: 331, name: 'Dell XPS 13 OLED (4K)' },
    { w: 1920, h: 1080, dpr: 1,   ppi: 141, name: 'Dell XPS 15 FHD' },
    { w: 3840, h: 2160, dpr: 2,   ppi: 283, name: 'Dell XPS 15 4K' },

    // Surface
    { w: 2256, h: 1504, dpr: 2,   ppi: 201, name: 'Surface Pro 7 (2736x1824)' },
    { w: 1368, h: 912,  dpr: 2,   ppi: 201, name: 'Surface Pro 7 (150%)' },
    { w: 2880, h: 1920, dpr: 2,   ppi: 267, name: 'Surface Book 3 13.5"' },

    // iPad
    { w: 1024, h: 768,  dpr: 2,   ppi: 264, name: 'iPad Pro 11"' },
    { w: 1366, h: 1024, dpr: 2,   ppi: 264, name: 'iPad Pro 12.9"' },
    { w: 820,  h: 1180, dpr: 2,   ppi: 264, name: 'iPad Air 10.9"' },

    // Common desktop monitors
    { w: 1920, h: 1080, dpr: 1,   ppi: 96,  name: '24" FHD Monitor (96 PPI)' },
    { w: 2560, h: 1440, dpr: 1,   ppi: 109, name: '27" QHD Monitor' },
    { w: 3840, h: 2160, dpr: 1,   ppi: 163, name: '27" 4K Monitor' },
    { w: 3840, h: 2160, dpr: 2,   ppi: 163, name: '27" 4K (HiDPI)' },

    // Lenovo
    { w: 1920, h: 1200, dpr: 1.25,ppi: 166, name: 'ThinkPad X1 Carbon 14"' },
    { w: 2560, h: 1600, dpr: 2,   ppi: 226, name: 'ThinkPad X1 Carbon 14" (2K)' },
  ];

  // ── State ───────────────────────────────────────────────────────
  let currentPPI = 96;
  let calibrationSource = 'default';
  let listeners = [];

  // ── Internal Helpers ────────────────────────────────────────────
  function notifyChange() {
    listeners.forEach(fn => fn(currentPPI, calibrationSource));
  }

  function getScreenInfo() {
    return {
      screenW: window.screen.width,
      screenH: window.screen.height,
      cssW:    window.innerWidth,
      cssH:    window.innerHeight,
      dpr:     window.devicePixelRatio || 1
    };
  }

  // ── Method 1: Auto Detect ───────────────────────────────────────
  function autoDetect() {
    const { screenW, screenH, dpr } = getScreenInfo();

    // Try exact match first
    let best = null;
    let bestScore = Infinity;

    for (const dev of DEVICE_DB) {
      const wDiff = Math.abs(dev.w - screenW);
      const hDiff = Math.abs(dev.h - screenH);
      const dprDiff = Math.abs(dev.dpr - dpr);
      const score = wDiff + hDiff + dprDiff * 50;

      if (score < bestScore) {
        bestScore = score;
        best = dev;
      }
    }

    // If match is close enough (within 5% of total pixels)
    const totalPixels = screenW * screenH;
    const threshold = totalPixels * 0.05;

    if (best && bestScore < threshold) {
      return { ppi: best.ppi, name: best.name, confidence: 'high', fromDB: true };
    }

    // Fallback: estimate from devicePixelRatio
    // Standard 96 PPI baseline scaled by DPR
    const estimatedPPI = Math.round(96 * dpr);
    return {
      ppi: estimatedPPI,
      name: `${screenW}×${screenH} @ ${dpr}x DPR`,
      confidence: 'low',
      fromDB: false
    };
  }

  // ── Method 2: Screen Diagonal ───────────────────────────────────
  function fromDiagonal(diagonalInches) {
    if (!diagonalInches || diagonalInches <= 0) return null;
    const { screenW, screenH } = getScreenInfo();
    // PPI = sqrt(resW² + resH²) / diagonal
    const physicalW = window.screen.width  * (window.devicePixelRatio || 1);
    const physicalH = window.screen.height * (window.devicePixelRatio || 1);
    const ppi = Math.round(Math.sqrt(physicalW * physicalW + physicalH * physicalH) / diagonalInches);
    return ppi;
  }

  // ── Method 3: Credit Card ───────────────────────────────────────
  // Standard ISO 7810 ID-1 card: 85.6mm × 53.98mm
  const CARD_WIDTH_MM  = 85.6;
  const CARD_HEIGHT_MM = 53.98;
  const MM_PER_INCH    = 25.4;

  function fromCreditCard(widthPx, heightPx) {
    // Calculate PPI from both dimensions and average
    const ppiFromWidth  = (widthPx  / CARD_WIDTH_MM)  * MM_PER_INCH;
    const ppiFromHeight = (heightPx / CARD_HEIGHT_MM)  * MM_PER_INCH;
    return Math.round((ppiFromWidth + ppiFromHeight) / 2);
  }

  // ── Public API ──────────────────────────────────────────────────
  function init() {
    // Try to load from localStorage or URL hash
    const saved = loadSaved();
    if (saved) {
      currentPPI = saved.ppi;
      calibrationSource = saved.source;
    } else {
      // Run auto-detect
      const result = autoDetect();
      currentPPI = result.ppi;
      calibrationSource = result.confidence === 'high' ? 'auto' : 'default';
    }
    notifyChange();
  }

  function setPPI(ppi, source) {
    currentPPI = Math.max(50, Math.min(600, Math.round(ppi)));
    calibrationSource = source || 'manual';
    saveCurrent();
    notifyChange();
  }

  function getPPI() { return currentPPI; }
  function getSource() { return calibrationSource; }

  function onCalibrationChange(fn) { listeners.push(fn); }

  function runAutoDetect() {
    const result = autoDetect();
    return result;
  }

  function runDiagonal(diagonalInches) {
    const ppi = fromDiagonal(parseFloat(diagonalInches));
    return ppi;
  }

  function applyDiagonal(diagonalInches) {
    const ppi = fromDiagonal(parseFloat(diagonalInches));
    if (ppi && ppi > 0) {
      setPPI(ppi, 'diagonal');
      return ppi;
    }
    return null;
  }

  function applyFromCard(widthPx, heightPx) {
    const ppi = fromCreditCard(widthPx, heightPx);
    if (ppi > 0) {
      setPPI(ppi, 'creditcard');
      return ppi;
    }
    return null;
  }

  function applyManual(ppiValue) {
    const ppi = parseFloat(ppiValue);
    if (ppi > 0) {
      setPPI(ppi, 'manual');
      return ppi;
    }
    return null;
  }

  // ── Persistence ─────────────────────────────────────────────────
  function saveCurrent() {
    try {
      localStorage.setItem('ruler_ppi', currentPPI);
      localStorage.setItem('ruler_source', calibrationSource);
      // Update URL hash
      const hash = `ppi=${currentPPI}&src=${calibrationSource}`;
      history.replaceState(null, '', `#${hash}`);
    } catch(e) {}
  }

  function loadSaved() {
    // Check URL hash first
    if (location.hash) {
      const params = new URLSearchParams(location.hash.slice(1));
      const ppi = parseFloat(params.get('ppi'));
      const src = params.get('src');
      if (ppi > 0) return { ppi, source: src || 'url' };
    }
    // Check localStorage
    try {
      const ppi = parseFloat(localStorage.getItem('ruler_ppi'));
      const source = localStorage.getItem('ruler_source') || 'saved';
      if (ppi > 0) return { ppi, source };
    } catch(e) {}
    return null;
  }

  function getShareURL() {
    const url = new URL(location.href);
    url.hash = `ppi=${currentPPI}&src=${calibrationSource}`;
    return url.toString();
  }

  // Source display labels
  function getSourceLabel(source) {
    const labels = {
      auto:       '✓ Auto-detected',
      diagonal:   '📐 Screen diagonal',
      creditcard: '💳 Credit card',
      manual:     '✏️ Manual PPI',
      url:        '🔗 From shared link',
      default:    '⚠ Estimated (not calibrated)',
      saved:      '💾 Saved calibration'
    };
    return labels[source] || source;
  }

  function getSourceClass(source) {
    if (['auto', 'diagonal', 'creditcard', 'manual', 'url', 'saved'].includes(source)) return 'calibrated';
    if (source === 'default') return 'uncalibrated';
    return 'partial';
  }

  return {
    init,
    setPPI,
    getPPI,
    getSource,
    onCalibrationChange,
    runAutoDetect,
    runDiagonal,
    applyDiagonal,
    applyFromCard,
    applyManual,
    getShareURL,
    getSourceLabel,
    getSourceClass,
    CARD_WIDTH_MM,
    CARD_HEIGHT_MM,
    getScreenInfo,
  };

})();
