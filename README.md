# EZReader — Your Personal Digital Library

EZReader is a private, offline-first reading app for your own documents. It runs entirely in the browser: there is no backend, no account, no database, and no cloud storage. Your books never leave your device.

The app is a static React + TypeScript + Vite PWA and can be hosted for free on GitHub Pages.

## Features

- **Dashboard** with continue-reading, recently added, recently read, favorites, collections, and series.
- **Format libraries** for PDF, EPUB, comics, text documents, and images, plus a combined library and favorites view.
- **Search, sort, filter**, grid/list views, and multi-select bulk actions.
- **Rename metadata** without touching the original file.
- **Collections** and **series**, including series ordering and next-volume navigation.
- **Reading history** with continue reading and per-document progress.
- **Bookmarks** and **notes** attached to a reading location.
- **Reading statistics** based on active reading time (only counted while the tab is visible and you are interacting).
- **Settings** for theme, accent color, language (English/Indonesian), grid density, default library view, and reader preferences.
- **Metadata backup and restore** as a versioned JSON file.
- **PWA/offline support** for the application shell. Documents are never uploaded or cached by the service worker.
- **Responsive layout** for desktop, tablet, and mobile, with drag-and-drop import.

## Supported formats

| Category | Formats |
| --- | --- |
| Documents | PDF, EPUB |
| Text | TXT, DOCX, RTF |
| Comics | CBZ, CBR, CB7, CBT, ZIP of images |
| Images | JPG/JPEG, PNG, WEBP |

- PDF rendering uses PDF.js.
- EPUB rendering uses epub.js.
- CBZ/ZIP archives are read with JSZip; CBR/CB7/CBT archives are read with libarchive.js (WASM).
- DOCX conversion uses Mammoth.js.
- RTF is converted with a small built-in safe parser, not a Node-only library.

## Privacy and data model

- Document files stay on your device. EZReader does **not** upload, copy, or cache your documents.
- Only metadata is stored in `LocalStorage` under versioned keys:
  - `ezreader.documents.v1`
  - `ezreader.covers.v1`
  - `ezreader.library.v1`
  - `ezreader.activity.v1`
  - `ezreader.settings.v1`
- Open files live in an in-memory registry for the current tab. A `FileSystemFileHandle` may also be kept in memory when the browser supports the File System Access API.
- Removing a document from the library deletes **EZReader metadata only**. The original file on your device is untouched.
- After a page reload, the browser may not be able to reopen a local file automatically. EZReader clearly marks unavailable documents and asks you to **Locate File**, matching the original by file name and size.

There is no IndexedDB, Dexie, SQLite, Firebase, Supabase, API server, AI service, login, or registration in this project.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

### Build and preview

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

### Type check only

```bash
npm run typecheck
```

## Deploying to GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow at `.github/workflows/deploy.yml` builds and deploys the app on every push to `main`. You can also run it manually from the **Actions** tab.

The Vite config uses `base: './'` and the app uses `HashRouter`, so the same build works at:

- `https://<user>.github.io/<repository>/`
- a custom domain
- any static file host

No rewrite rules are needed because routes live after `#`.

### PWA notes

- The service worker is registered only in production builds.
- The app shell, hashed JS/CSS bundles, fonts, icons, the libarchive worker, and its WASM binary are precached on install.
- Documents and user files are never cached or transmitted.
- On iOS, add the site to the Home Screen for a standalone app experience.

## Project structure

```text
src/
  components/      Reusable UI, layout, document cards, modals
  hooks/           Store hooks and import orchestration
  pages/           Dashboard, libraries, collections, series, history,
                   bookmarks, notes, statistics, settings, detail pages
  readers/         PDF, EPUB, comic/image, and text readers
  services/
    archiveHandler/ Archive and image page sources
    fileHandler/    File inspection, PDF loading, format handlers
    storage/        LocalStorage store and in-memory file registry
  styles/          Base, layout, components, pages, reader styles
  types/           Shared TypeScript types
  utils/           Formatting, sorting, i18n, RTF parser, helpers
public/
  icons/           PWA icons
  libarchive/      libarchive.js worker and WASM binary
  pdfjs/           PDF.js CMaps and standard fonts
  manifest.json    PWA manifest
  sw.js            Offline app-shell service worker
```

## Backup and restore

Settings offers metadata export/import as JSON.

- A **full** backup can replace current metadata after confirmation.
- Partial backups (collections, series, bookmarks, notes, history, favorites) are merged.
- Restoring documents matches by file name and size and never restores the original files, because those never left your device.

## Limitations

- Browsers cannot silently reopen a local file after a reload. Use **Locate File** when prompted.
- Password-protected archives are not supported yet.
- Very large files may be limited by available browser memory.
- Reading-time statistics are best-effort estimates; browsers cannot track activity perfectly.
- LocalStorage is limited (typically around 5 MB), so covers are compressed and the app reports storage errors instead of failing silently.
- DOCX support covers text and basic document structure through Mammoth.js; complex layouts may look simpler than in a word processor.

## License

This project is provided as-is for personal use. Third-party libraries retain their own licenses.
