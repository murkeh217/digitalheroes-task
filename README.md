# PrecisionRuler

**Online ruler tool with real-size measurement** — a premium, feature-rich alternative to anruler.com.

## Features

- **4-edge rulers** — toggle Top, Bottom, Left, Right independently
- **3 calibration methods**:
  1. Auto-detect device (device database + DPR matching)
  2. Screen diagonal (mathematical PPI calculation)
  3. Credit card (drag-to-fit, ISO card standard)
- **Direct PPI/DPI input** field
- **Draggable measurement guides** (horizontal + vertical) with live gap readout
- **Point-to-point measurement** — click two points to measure distance
- **Units**: cm, mm, inch, px
- **Copy measurements** to clipboard
- **Share calibration** via URL hash
- **Keyboard shortcuts**: `C` calibrate, `F` fullscreen, `H/V` guides, `M` measure, `Esc` close
- **Dark / light theme** toggle
- **Fullscreen mode**

## Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project → select this repo
3. No build step needed — it's a static site
4. Vercel will deploy automatically on every push

## Local Development

Just open `index.html` in a browser, or use any static server:

```bash
npx serve .
# or
python -m http.server 8080
```

## File Structure

```
├── index.html       # Main page
├── style.css        # Dark-mode premium design
├── calibration.js   # PPI detection (3 methods + device DB)
├── ruler.js         # Canvas ruler rendering engine
├── guides.js        # Draggable guides & measurement tools
├── app.js           # Main controller, keyboard shortcuts, state
├── vercel.json      # Vercel deployment config
└── README.md
```
