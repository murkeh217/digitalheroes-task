/* ════════════════════════════════════════════════════════════════
   app.js — Main application controller
   Wires together: Calibration, RulerEngine, GuidesEngine
   + Keyboard shortcuts, Fullscreen, Theme, UI event handlers
   ════════════════════════════════════════════════════════════════ */

'use strict';

(function () {

  // ── Element References ───────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const els = {
    // Toolbar
    unitBtns:     document.querySelectorAll('.unit-btn'),
    edgeBtns:     document.querySelectorAll('.edge-btn'),
    btnGuideH:    $('btn-guide-h'),
    btnGuideV:    $('btn-guide-v'),
    btnMeasure:   $('btn-measure'),
    btnClear:     $('btn-clear-guides'),
    btnCalibrate: $('btn-calibrate'),
    btnFullscreen:$('btn-fullscreen'),
    btnTheme:     $('btn-theme'),
    iconFsEnter:  $('icon-fullscreen-enter'),
    iconFsExit:   $('icon-fullscreen-exit'),
    iconMoon:     $('icon-moon'),
    iconSun:      $('icon-sun'),

    // Status bar
    ppiValue:     $('ppi-value'),
    badgeDot:     $('badge-dot'),
    calLabel:     $('calibration-method-label'),
    cursorValue:  $('cursor-value'),
    btnShare:     $('btn-share'),

    // Ruler strips
    rulerTop:     $('ruler-top'),
    rulerBottom:  $('ruler-bottom'),
    rulerLeft:    $('ruler-left'),
    rulerRight:   $('ruler-right'),

    // Canvases
    canvasTop:    $('canvas-ruler-top'),
    canvasBottom: $('canvas-ruler-bottom'),
    canvasLeft:   $('canvas-ruler-left'),
    canvasRight:  $('canvas-ruler-right'),
    canvasMeasure:$('canvas-measure'),

    // Measure area
    measureArea:  $('measure-area'),

    // Calibration panel
    panelBackdrop:  $('panel-backdrop'),
    calibPanel:     $('calibration-panel'),
    btnPanelClose:  $('btn-panel-close'),
    methodTabs:     document.querySelectorAll('.method-tab'),
    methodContents: document.querySelectorAll('.method-content'),

    // Auto method
    autoResult:   $('auto-result'),
    deviceDropdown:$('device-dropdown'),
    btnApplyAuto: $('btn-apply-auto'),

    // Diagonal method
    diagonalInput:$('diagonal-input'),
    diagonalPreview:$('diagonal-ppi-preview'),
    btnApplyDiag: $('btn-apply-diagonal'),

    // Credit card method
    cardOverlay:  $('card-overlay'),
    cardHandle:   $('card-handle'),
    cardDims:     $('card-dimensions'),
    cardPpiPrev:  $('card-ppi-preview'),
    btnApplyCard: $('btn-apply-card'),

    // Manual PPI method
    ppiInput:     $('ppi-input'),
    ppiInputCm:   $('ppi-input-cm'),
    btnApplyMan:  $('btn-apply-manual'),

    // Panel footer
    panelCurPPI:  $('panel-current-ppi'),
    panelCalSrc:  $('panel-cal-source'),

    // Toast
    measureToast: $('measurement-toast'),
    toastText:    $('toast-text'),
    btnToastCopy: $('btn-toast-copy'),
    btnToastDism: $('btn-toast-dismiss'),
    copiedToast:  $('copied-toast'),
  };

  // ── App State ────────────────────────────────────────────────────
  const state = {
    unit:  'cm',
    theme: 'dark',
    edges: { top: true, bottom: true, left: true, right: true },
    isFullscreen: false,
    panelOpen: false,
    measureMode: false,
    lastMeasurement: null,
    cardWidth:  260, // px
    cardHeight: 164, // px
  };

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    // Load theme preference
    const savedTheme = localStorage.getItem('ruler_theme') || 'dark';
    setTheme(savedTheme);

    // Init sub-modules
    Calibration.init();
    RulerEngine.init({
      top:    els.canvasTop,
      bottom: els.canvasBottom,
      left:   els.canvasLeft,
      right:  els.canvasRight,
    });
    GuidesEngine.init(els.measureArea, els.canvasMeasure);

    // Wire calibration change
    Calibration.onCalibrationChange(onCalibrationChange);

    // Wire guide measurement
    GuidesEngine.onMeasure(onMeasurementResult);

    // Bind all events
    bindToolbarEvents();
    bindCalibrationPanel();
    bindCreditCardCalibration();
    bindMeasureAreaEvents();
    bindKeyboardShortcuts();
    bindFullscreenChange();
    bindShareButton();
    bindToastEvents();

    // Initial render
    handleResize();
    window.addEventListener('resize', handleResize);

    // Run auto-detect and show result
    showAutoResult();

    // Load saved unit
    const savedUnit = localStorage.getItem('ruler_unit') || 'cm';
    setUnit(savedUnit);
  }

  // ── Calibration Change Handler ───────────────────────────────────
  function onCalibrationChange(ppi, source) {
    // Update status bar
    els.ppiValue.textContent = ppi;
    const label = Calibration.getSourceLabel(source);
    const cls   = Calibration.getSourceClass(source);
    els.calLabel.textContent = label;
    els.badgeDot.className   = 'badge-dot ' + cls;

    // Update panel footer
    els.panelCurPPI.textContent = ppi;
    els.panelCalSrc.textContent  = '(' + source + ')';

    // Update ruler engine
    RulerEngine.setPPI(ppi);
    GuidesEngine.updateAllLabels();
  }

  // ── Toolbar Events ───────────────────────────────────────────────
  function bindToolbarEvents() {
    // Unit switcher
    els.unitBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setUnit(btn.dataset.unit);
      });
    });

    // Edge toggles
    els.edgeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const edge = btn.dataset.edge;
        const newState = !state.edges[edge];
        state.edges[edge] = newState;
        btn.classList.toggle('active', newState);
        const rulerEl = document.getElementById(`ruler-${edge}`);
        if (rulerEl) rulerEl.classList.toggle('hidden', !newState);
        RulerEngine.setEdgeActive(edge, newState);
        updateGridTemplate();
      });
    });

    // Guide buttons
    els.btnGuideH.addEventListener('click', () => {
      if (state.measureMode) exitMeasureMode();
      GuidesEngine.createGuide('h');
    });
    els.btnGuideV.addEventListener('click', () => {
      if (state.measureMode) exitMeasureMode();
      GuidesEngine.createGuide('v');
    });

    // Measure button
    els.btnMeasure.addEventListener('click', toggleMeasureMode);

    // Clear button
    els.btnClear.addEventListener('click', () => {
      GuidesEngine.clearAllGuides();
      if (state.measureMode) exitMeasureMode();
    });

    // Calibrate
    els.btnCalibrate.addEventListener('click', openPanel);

    // Fullscreen
    els.btnFullscreen.addEventListener('click', toggleFullscreen);

    // Theme
    els.btnTheme.addEventListener('click', () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Unit ─────────────────────────────────────────────────────────
  function setUnit(unit) {
    state.unit = unit;
    els.unitBtns.forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
    RulerEngine.setUnit(unit);
    GuidesEngine.updateAllLabels();
    localStorage.setItem('ruler_unit', unit);
  }

  // ── Grid Template (show/hide rulers) ────────────────────────────
  function updateGridTemplate() {
    const rulerLayout = document.getElementById('ruler-layout');
    const thickness = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ruler-thickness')) || 36;
    const rowT = state.edges.top    ? thickness + 'px' : '0px';
    const rowB = state.edges.bottom ? thickness + 'px' : '0px';
    rulerLayout.style.gridTemplateRows = `${rowT} 1fr ${rowB}`;

    const rulerMid = document.querySelector('.ruler-middle-row');
    if (rulerMid) {
      const colL = state.edges.left  ? thickness + 'px' : '0px';
      const colR = state.edges.right ? thickness + 'px' : '0px';
      rulerMid.style.gridTemplateColumns = `${colL} 1fr ${colR}`;
    }
  }

  // ── Measure Mode ─────────────────────────────────────────────────
  function toggleMeasureMode() {
    if (state.measureMode) exitMeasureMode();
    else enterMeasureMode();
  }
  function enterMeasureMode() {
    state.measureMode = true;
    els.btnMeasure.classList.add('active');
    GuidesEngine.enableMeasureMode();
  }
  function exitMeasureMode() {
    state.measureMode = false;
    els.btnMeasure.classList.remove('active');
    GuidesEngine.disableMeasureMode();
  }

  function onMeasurementResult(measurement) {
    state.lastMeasurement = measurement;
    showMeasurementToast(measurement);
    if (state.measureMode) exitMeasureMode();
  }

  // ── Toast ────────────────────────────────────────────────────────
  function showMeasurementToast(text) {
    els.toastText.textContent = text;
    els.measureToast.classList.add('visible');
  }
  function hideMeasurementToast() {
    els.measureToast.classList.remove('visible');
  }

  function bindToastEvents() {
    els.btnToastCopy.addEventListener('click', () => {
      if (state.lastMeasurement) {
        navigator.clipboard.writeText(state.lastMeasurement).then(() => showCopiedToast());
      }
    });
    els.btnToastDism.addEventListener('click', hideMeasurementToast);
  }

  function showCopiedToast() {
    els.copiedToast.classList.add('show');
    setTimeout(() => els.copiedToast.classList.remove('show'), 1800);
  }

  // ── Calibration Panel ────────────────────────────────────────────
  function openPanel() {
    state.panelOpen = true;
    els.calibPanel.classList.add('open');
    els.panelBackdrop.classList.add('visible');
    showAutoResult();
  }
  function closePanel() {
    state.panelOpen = false;
    els.calibPanel.classList.remove('open');
    els.panelBackdrop.classList.remove('visible');
  }

  function bindCalibrationPanel() {
    els.btnPanelClose.addEventListener('click', closePanel);
    els.panelBackdrop.addEventListener('click', closePanel);

    // Method tabs
    els.methodTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const method = tab.dataset.method;
        els.methodTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        els.methodContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.getElementById('method-' + method).classList.add('active');
      });
    });

    // Auto detect
    els.btnApplyAuto.addEventListener('click', () => {
      const dropVal = els.deviceDropdown.value;
      if (dropVal) {
        Calibration.setPPI(parseFloat(dropVal), 'auto');
        closePanel();
        return;
      }
      const result = Calibration.runAutoDetect();
      Calibration.setPPI(result.ppi, result.confidence === 'high' ? 'auto' : 'default');
      closePanel();
    });

    // Diagonal input
    els.diagonalInput.addEventListener('input', () => {
      const val = parseFloat(els.diagonalInput.value);
      if (val > 0) {
        const ppi = Calibration.runDiagonal(val);
        if (ppi) {
          els.diagonalPreview.textContent = `Calculated PPI: ${ppi}`;
          els.diagonalPreview.classList.add('has-value');
        }
      } else {
        els.diagonalPreview.textContent = 'Enter size to see PPI';
        els.diagonalPreview.classList.remove('has-value');
      }
    });
    els.btnApplyDiag.addEventListener('click', () => {
      const val = parseFloat(els.diagonalInput.value);
      const ppi = Calibration.applyDiagonal(val);
      if (ppi) closePanel();
      else els.diagonalInput.classList.add('error');
    });

    // Manual PPI
    els.ppiInput.addEventListener('input', () => {
      const val = parseFloat(els.ppiInput.value);
      if (val > 0) els.ppiInputCm.value = (val / 2.54).toFixed(2);
    });
    els.ppiInputCm.addEventListener('input', () => {
      const val = parseFloat(els.ppiInputCm.value);
      if (val > 0) els.ppiInput.value = (val * 2.54).toFixed(1);
    });
    els.btnApplyMan.addEventListener('click', () => {
      const val = parseFloat(els.ppiInput.value);
      const ppi = Calibration.applyManual(val);
      if (ppi) closePanel();
    });
  }

  // ── Auto Detect Result ───────────────────────────────────────────
  function showAutoResult() {
    els.autoResult.innerHTML = '<div class="spinner"></div>';

    setTimeout(() => {
      const result = Calibration.runAutoDetect();
      els.autoResult.innerHTML = `
        <div>
          <div class="auto-result-ppi">${result.ppi} <span style="font-size:12px;color:var(--text-muted)">PPI</span></div>
          <div class="auto-result-device">${result.name}</div>
          <div class="auto-result-text" style="margin-top:4px">${result.fromDB ? '✓ Matched device database' : '⚠ Estimated — use another method for accuracy'}</div>
        </div>
      `;
    }, 800);
  }

  // ── Credit Card Calibration ──────────────────────────────────────
  function bindCreditCardCalibration() {
    const overlay = els.cardOverlay;
    const handle  = els.cardHandle;
    let dragging  = false;
    let startX, startY, startW, startH;

    // Maintain card aspect ratio: 85.6 / 53.98
    const RATIO = Calibration.CARD_WIDTH_MM / Calibration.CARD_HEIGHT_MM;

    // Init size
    state.cardWidth  = 260;
    state.cardHeight = Math.round(260 / RATIO);
    applyCardSize();

    const onDown = (e) => {
      dragging = true;
      const client = e.touches ? e.touches[0] : e;
      startX = client.clientX;
      startY = client.clientY;
      startW = state.cardWidth;
      startH = state.cardHeight;
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const client = e.touches ? e.touches[0] : e;
      const dx = client.clientX - startX;

      // Resize maintaining aspect ratio
      const newW = Math.max(80, Math.min(380, startW + dx));
      const newH = Math.round(newW / RATIO);

      state.cardWidth  = newW;
      state.cardHeight = newH;
      applyCardSize();
      updateCardPPI();
    };

    const onUp = () => { dragging = false; };

    handle.addEventListener('mousedown',  onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchend',   onUp);

    els.btnApplyCard.addEventListener('click', () => {
      const ppi = Calibration.applyFromCard(state.cardWidth, state.cardHeight);
      if (ppi) closePanel();
    });

    updateCardPPI();
  }

  function applyCardSize() {
    els.cardOverlay.style.width  = state.cardWidth  + 'px';
    els.cardOverlay.style.height = state.cardHeight + 'px';
    els.cardDims.textContent = `${state.cardWidth} × ${state.cardHeight} px`;
  }

  function updateCardPPI() {
    const ppi = Calibration.applyFromCard
      ? Math.round((state.cardWidth / Calibration.CARD_WIDTH_MM) * 25.4)
      : 0;
    // Don't apply, just show
    const calcPPI = Math.round((state.cardWidth / Calibration.CARD_WIDTH_MM) * 25.4);
    els.cardPpiPrev.textContent = `→ Calibrated PPI: ${calcPPI}`;
    els.cardPpiPrev.classList.toggle('has-value', calcPPI > 0);
  }

  // ── Measure Area Events ──────────────────────────────────────────
  function bindMeasureAreaEvents() {
    els.measureArea.addEventListener('mousemove', (e) => {
      const rect = els.measureArea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update cursor position in status bar
      const xMeas = RulerEngine.pixelToMeasure(x);
      const yMeas = RulerEngine.pixelToMeasure(y);
      els.cursorValue.textContent = `${xMeas}, ${yMeas}`;

      // Update ruler cursor lines
      RulerEngine.updateCursor(x, y);
    });

    els.measureArea.addEventListener('mouseleave', () => {
      els.cursorValue.textContent = '—';
      RulerEngine.updateCursor(null, null);
    });
  }

  // ── Keyboard Shortcuts ───────────────────────────────────────────
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't fire when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'c': openPanel(); break;
        case 'f': toggleFullscreen(); break;
        case 'h': GuidesEngine.createGuide('h'); break;
        case 'v': GuidesEngine.createGuide('v'); break;
        case 'm': toggleMeasureMode(); break;
        case 'escape':
          if (state.panelOpen) closePanel();
          if (state.measureMode) exitMeasureMode();
          break;
        case '1': setUnit('cm'); break;
        case '2': setUnit('mm'); break;
        case '3': setUnit('in'); break;
        case '4': setUnit('px'); break;
        case 'delete':
        case 'backspace':
          if (!state.panelOpen) GuidesEngine.clearAllGuides();
          break;
      }
    });
  }

  // ── Fullscreen ───────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function bindFullscreenChange() {
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      state.isFullscreen = isFs;
      els.iconFsEnter.style.display = isFs ? 'none' : 'block';
      els.iconFsExit.style.display  = isFs ? 'block' : 'none';
      setTimeout(handleResize, 100);
    });
  }

  // ── Theme ────────────────────────────────────────────────────────
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ruler_theme', theme);
    els.iconMoon.style.display = theme === 'dark'  ? 'block' : 'none';
    els.iconSun.style.display  = theme === 'light' ? 'block' : 'none';
    RulerEngine.renderAll();
  }

  // ── Resize Handler ───────────────────────────────────────────────
  function handleResize() {
    RulerEngine.renderAll();
  }

  // ── Share Button ─────────────────────────────────────────────────
  function bindShareButton() {
    els.btnShare.addEventListener('click', () => {
      const url = Calibration.getShareURL();
      navigator.clipboard.writeText(url).then(() => {
        showCopiedToast();
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    });
  }

  // ── Start ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
