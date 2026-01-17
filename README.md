# 📓 Cuaderno

**Cuaderno** is a privacy-first, local-first digital notebook designed for seamless handwriting, sketching, and note-taking. Built with a focus on speed, ergonomics, and data ownership, it offers an infinite canvas experience that lives entirely in your browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)

---

## ✨ Key Features

- ** Local-First Architecture**: Uses the **Origin Private File System (OPFS)** for near-native storage performance. Your notes are always available, even offline.
- ** Infinite Canvas**: Powered by **tldraw**, providing a world-class drawing engine with pressure sensitivity and smart shape detection.
- **☁️ Private Cloud Sync**: Optional synchronization with **your own Google Drive**. No third-party servers, no surveillance. Your data stays between your device and your cloud.
- ** Ergonomic UI**: 
  - **Left/Right-Handed Modes**: Adaptive interface to keep tools within reach regardless of your dominant hand.
  - **Glassmorphism Design**: A modern, premium aesthetic that stays out of your way.
- ** Deep Organization**: Organize your world into **Notebooks**, **Folders**, and **Pages** with intuitive drag-and-drop.
- ** Global by Design**: Fully localized in 18+ languages including English, Spanish, French, German, Japanese, and more.
- ** PWA Ready**: Install it on your tablet or desktop for a true application experience.

---

## 🛠️ Built With

### Core Engine
- **[React 19](https://react.dev/)**: For a modern, declarative UI.
- **[tldraw](https://tldraw.dev/)**: The heart of the drawing experience.
- **[TypeScript](https://www.typescriptlang.org/)**: For rock-solid type safety across the entire codebase.

### State & Storage
- **[Zustand](https://github.com/pmndrs/zustand)**: Lightweight, high-performance state management.
- **[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)**: Cutting-edge browser storage for large-scale drawing data.
- **[Google Drive API](https://developers.google.com/drive)**: Seamless, secure cloud integration.

### UI & Aesthetics
- **[Lucide React](https://lucide.dev/)**: Beautifully consistent iconography.
- **[DND Kit](https://dndkit.com/)**: Sophisticated drag-and-drop for file management.
- **[Sonner](https://sonner.emilkowal.ski/)**: Minimalist toasted notifications.
- **Vanilla CSS Modules**: High-performance, scoped styling with modern CSS variables.

### Tools
- **[Vite](https://vitejs.dev/)**: Ultra-fast build tool and dev server.
- **[i18next](https://www.i18next.com/)**: Powerful localization framework.

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm / pnpm / yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/juliopx/cuaderno.git
   cd cuaderno
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file for your licenses and API keys:
   ```env
   VITE_TLDRAW_LICENSE=your_license_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## Privacy

Cuaderno is built on the belief that your thoughts are private. 
- **No Analytics**: We don't track you.
- **No Backend**: We don't have a server that stores your notes.
- **Direct Auth**: Google Drive authentication happens directly between you and Google.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with love for the creative mind.
</p>
