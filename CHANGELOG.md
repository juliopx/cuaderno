## [1.4.0] - 2026-01-18

### Features
* Added support for context menu (right-click and long-press) in TLDraw, editor language synchronization, and fixed 1:1 panning. (#26)
* Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.3.1...v1.4.0

## [1.3.1] - 2026-01-18

### Features
* **Fix hybrid name editor**: Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.3.0...v1.3.1

## [1.3.0] - 2026-01-17

### Features
- **Simplified Drag and Drop UX**: Streamlined sidebar drag-and-drop interaction by removing direct item nesting. Items now only support reordering (above/below) when dragging directly onto them, while nesting is exclusively handled by dropping onto column containers or empty spaces.

### Internal
- **Code Cleanup**: Removed unused props and state variables (`activeDragItem`, `dropZone` middle-zone detection) from `SortableItem` and related components.
- **Improved Type Safety**: Resolved TypeScript lint warnings and cleaned up component interfaces.

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.2.0...v1.3.0

## [1.2.0] - 2026-01-17

### Internal
- **Release Process Improvements**: Updated release script to ensure `package-lock.json` stays in sync with version bumps.

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.1.3...v1.2.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-01-17

### Features
- **Undo/Redo Shortcuts**: Added keyboard shortcuts for Undo (`Ctrl/Cmd + Z`) and Redo (`Ctrl/Cmd + Shift + Z`, `Ctrl/Cmd + Y`).
- **Improved Release Flow**: Automated `CHANGELOG.md` updates and local version bumping via `npm run release`.
- **Branch Protection Enforcement**: Improved security by requiring PRs for `main` and `develop`.

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.1.0...v1.1.3

## [1.1.0] - 2026-01-17

<!-- Release notes generated using configuration in .github/release.yml at 23d4a909f43cefb623188c0e8e5a792d35eab21c -->

### Features
- **Sync Welcome Page Color**: Dynamically synchronization of the welcome page's branding, links, and background with the application's accent color.

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.0.0...v1.1.0

## [1.0.0] - 2026-01-17

<!-- Release notes generated using configuration in .github/release.yml at af9c84b96075ae0612aa787d06a7ddaeab58c020 -->

**Full Changelog**: https://github.com/juliopx/cuaderno/commits/v1.0.0

## [0.0.1] - 2026-01-17

### Features
- **UI/UX**: Implement a new welcome screen with app description, privacy, and terms links.
- **Localization**: Add translations for privacy policy and Google Drive notices in multiple languages.
- **Layout**: Conditionally calculate sidebar columns based on the active notebook.
- **SEO/Metadata**: Enhance SEO with bilingual descriptions and adaptive metadata.
- **CI/CD**: Implement conditional deployment based on version changes.

### Bug Fixes
- Correct application return links in privacy and terms pages.

### Internal
- **Linting**: Configure ESLint and integrate it into the CI pipeline.
- **Documentation**: Comprehensive rewrite of README.
- **Workflow**: Initial implementation of release and deployment scripts.

## [0.0.0] - Prior to 2026-01-17

### Features
- **Core**: Initial MVP with `tldraw` integration for canvas drawing.
- **Cloud Sync**: Full integration with Google Drive for real-time document synchronization.
- **PWA**: Progressive Web App support with custom icons, manifest, and offline capabilities.
- **UI System**: Custom design system including glassmorphism, theme-based accent colors, and responsive layouts.
- **Accessibility**: Support for RTL (Right-to-Left) languages and dedicated left-handed mode.
- **Localization**: Initial i18n framework with support for multiple languages.
- **Interactions**: Enhanced pointer events for touch and pen support, including multi-finger gestures for undo/redo.
- **Components**: Library of custom UI components (Bubble, Circular buttons, Dropdowns, Portals).
- **Tools**: Specialized drawing tools including advanced eraser and pen modes.
- **Environment**: Support for local HTTPS development and SSL.
