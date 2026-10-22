# Auris virtual hearing-aid try-on POC

A React + TypeScript browser-only technical prototype for live virtual try-on of hearing aids. The app uses MediaPipe Face Landmarker for tracking and Three.js for procedural 3D device rendering. Camera frames stay in the browser.

## Run locally

Install dependencies and start Vite (camera access requires localhost or HTTPS):

```powershell
npm install
npm run dev
```

Then open the printed localhost URL and allow camera access.

## Current scope

- Live camera and still-photo input
- MediaPipe 3D face landmarks and smoothed ear anchoring
- Three procedural device styles: BTE, RIC and ITE
- Five casing colors
- Automatic or manual left/right placement
- Approximate depth occlusion and a diagnostics overlay
- No backend and no frame upload

This is a visual feasibility prototype, not a medical fitting or measurement tool.
