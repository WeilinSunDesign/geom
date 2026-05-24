# 🔮 GEOM · Cyber Feng Shui Advisor

A lightweight AI-powered feng shui interior design assistant for modern living.

## Features

- 🏠 **2D Room Planner** — Drag and drop furniture, resize your room freely
- 🧭 **Compass Orientation** — Set facing direction with cardinal and bagua directions
- 🚪 **Doors & Windows** — Add doors and windows that snap to walls automatically
- 📷 **Photo Analysis** — Upload a real room photo and let AI analyse the feng shui directly
- 🎨 **Room Render** — Generate an ideal room visualisation via DALL-E 3
- 💬 **AI Chat** — Describe your situation and receive personalised feng shui advice

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open your browser at http://localhost:5173

### 3. Build for production

```bash
npm run build
```

## Tech Stack

- **Framework**: React 18 + Vite
- **AI Chat & Image Analysis**: Claude API (Anthropic)
- **Room Renders**: DALL-E 3 (OpenAI, optional)

## API Notes

- **Claude API**: Integrated via claude.ai — no extra configuration needed
- **OpenAI API**: Only required for room render generation. Enter your key temporarily in the UI (it is never stored)

## Project Structure

```
fengshui-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx      # React entry point
    ├── App.jsx       # Main component
    └── index.css     # Global styles
```
