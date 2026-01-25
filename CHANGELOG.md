## [1.9.4] - 2026-01-25

### Bug Fixes
* Fixed an issue where session expiration could leave the app in an unresponsive state; added a "Session Expired" dialog to easily re-login. (#106)
* Fixed tool configuration persistence and 'jump' on page load. (#105)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.9.3...v1.9.4

## [1.9.3] - 2026-01-25

### Features
* Persist Bubble position, collapse state, and active tool configuration. Fixed issues with drag boundaries and dynamic height overflow. (#103)
* - **Major**: Unified all drawing tools into the floating bubble interface, removing the fixed toolbar
- **Feature**: Added double-click interactions for quick tool access and eraser toggle
- **Feature**: Added smooth icon transition animations in collapsed bubble
- **Enhancement**: Moved tldraw attribution to Settings menu with official branding
- **Fix**: Resolved infinite loops in Bubble component and multi-tab sync
- **Fix**: Improved tldraw theme synchronization
- **Performance**: Optimized store selectors to prevent unnecessary re-renders (#95)
* Added automatic tool switching for Apple Pencil/Wacom erasers. Improved release process to prevent duplicate changelog entries and automated branch cleanup after merging. (#85)

### Bug Fixes
* Fixed Google Drive sync reliability issues including 404 auto-recovery, race conditions, and error notifications. (#101)
* Fixed watermark and recenter button positioning on iPad/Touch devices to respect Safe Area. (#99)
* -   **Fix**: Repositioned tldraw watermark to be visible (license compliance) instead of hiding it, placing it to the left of the recenter button. (#97)
* Fixed missing header path and sidebar expand button in canvas view. (#93)

### Documentation
* Enforce GitHub CLI usage for agents and track `.agent` workflows in Git. (#88)

### Internal
* Refactored CanvasArea and Bubble components into modular sub-components for improved maintainability. (#89)
* chore: sync main → develop after release (#87)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.7.1...v1.9.3

## [1.9.2] - 2026-01-24

### Features
* - **Major**: Unified all drawing tools into the floating bubble interface, removing the fixed toolbar
- **Feature**: Added double-click interactions for quick tool access and eraser toggle
- **Feature**: Added smooth icon transition animations in collapsed bubble
- **Enhancement**: Moved tldraw attribution to Settings menu with official branding
- **Fix**: Resolved infinite loops in Bubble component and multi-tab sync
- **Fix**: Improved tldraw theme synchronization
- **Performance**: Optimized store selectors to prevent unnecessary re-renders (#95)
* Added automatic tool switching for Apple Pencil/Wacom erasers. Improved release process to prevent duplicate changelog entries and automated branch cleanup after merging. (#85)

### Bug Fixes
* Fixed watermark and recenter button positioning on iPad/Touch devices to respect Safe Area. (#99)
* -   **Fix**: Repositioned tldraw watermark to be visible (license compliance) instead of hiding it, placing it to the left of the recenter button. (#97)
* Fixed missing header path and sidebar expand button in canvas view. (#93)

### Documentation
* Enforce GitHub CLI usage for agents and track `.agent` workflows in Git. (#88)

### Internal
* Refactored CanvasArea and Bubble components into modular sub-components for improved maintainability. (#89)
* chore: sync main → develop after release (#87)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.7.1...v1.9.2

## [1.9.1] - 2026-01-24

### Bug Fixes
* -   **Fix**: Repositioned tldraw watermark to be visible (license compliance) instead of hiding it, placing it to the left of the recenter button. (#97)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.9.0...v1.9.1

## [1.9.0] - 2026-01-24

### Features
* - **Major**: Unified all drawing tools into the floating bubble interface, removing the fixed toolbar
- **Feature**: Added double-click interactions for quick tool access and eraser toggle
- **Feature**: Added smooth icon transition animations in collapsed bubble
- **Enhancement**: Moved tldraw attribution to Settings menu with official branding
- **Fix**: Resolved infinite loops in Bubble component and multi-tab sync
- **Fix**: Improved tldraw theme synchronization
- **Performance**: Optimized store selectors to prevent unnecessary re-renders (#95)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.8.2...v1.9.0

## [1.8.2] - 2026-01-24

### Bug Fixes
* Fixed missing header path and sidebar expand button in canvas view. (#93)

### Documentation
* Enforce GitHub CLI usage for agents and track `.agent` workflows in Git. (#88)

### Internal
* Refactored CanvasArea and Bubble components into modular sub-components for improved maintainability. (#89)
* chore: sync main → develop after release (#87)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.8.0...v1.8.2

## [1.8.1] - 2026-01-24

### Documentation
* Enforce GitHub CLI usage for agents and track `.agent` workflows in Git. (#88)

### Internal
* Refactored CanvasArea and Bubble components into modular sub-components for improved maintainability. (#89)
* chore: sync main → develop after release (#87)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.8.0...v1.8.1

## [1.8.0] - 2026-01-24

### Features
* Added automatic tool switching for Apple Pencil/Wacom erasers. Improved release process to prevent duplicate changelog entries and automated branch cleanup after merging. (#85)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.7.1...v1.8.0

## [1.7.1] - 2026-01-24

### Features
* Added robust background token expiration management and proactive refresh on app visibility change. (#82)
* Improved sidepanel drag and drop for touch/pencil devices and implemented a robust sync merge strategy to prevent data loss. (#81)
* Added a custom, non-native confirmation dialog for logout and disabling auto-sync, with full localization support for 18 languages and UI layout refinements. (#70)
* Mejorada la estabilidad de la sincronización con Google Drive, automatización de procesos de carga inicial y correcciones críticas en el modo oscuro y fotos de perfil. (#69)

### Bug Fixes
* Improved settings bubble drag logic to prevent accidental movement when interacting with buttons. (#71)

### Documentation
* Updated changelog to reflect new features and bug fixes. (#78)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.7.0...v1.7.1

## [1.7.0] - 2026-01-24

### Features
* Added a custom, non-native confirmation dialog for logout and disabling auto-sync, with full localization support for 18 languages and UI layout refinements. (#70)
* Mejorada la estabilidad de la sincronización con Google Drive, automatización de procesos de carga inicial y correcciones críticas en el modo oscuro y fotos de perfil. (#69)
* Harmonized the transparency and background color of all floating dialogs (like Image Upload) and slightly increased global UI opacity for better readability. (#68)

### Bug Fixes
* Improved settings bubble drag logic to prevent accidental movement when interacting with buttons. (#71)
* Fixed an issue where synchronization would stop working after long periods of inactivity, requiring a manual logout/login to restore. (#66)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.6.1...v1.7.0

## [1.6.1] - 2026-01-21

### Bug Fixes
* Fix issue where name editor showed black text strokes in dark mode when theme was set to "Auto". (#52)
* Fix: Corregido el cierre prematuro del menú contextual en dispositivos táctiles al usar la aplicación instalada como PWA. (#42)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.6.0...v1.6.1

## [1.6.0] - 2026-01-21

### Features
- Added Shapes Tool (Square, Circle, Arrow, etc.) to toolbar.
- Improved text styling: mixed formatting support, fixed double decorations, and clean format removal.
- Enhanced Selection Mode: Text is no longer selectable unless in Edit Mode.
- Fixed various localization and interaction issues. (#59)
- Restored image upload and link features, enhanced toolbar visibility, and improved tool switching logic. (#55)
- Added extra-small and huge sizes for drawing and text tools. (#54)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.5.2...v1.6.0

## [1.5.1] - 2026-01-19

### Features
- Added support for local image uploads and improved hyperlink functionality in text shapes, including selection-aware link creation and interactive links in selection mode. (#35)
- Added support for context menu (right-click and long-press) in TLDraw, editor language synchronization, and fixed 1:1 panning. (#26)
- Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

### Bug Fixes
- Fixed context menu immediately closing after long press on touch devices in selection mode (#38)
- Corregido el cierre prematuro del menú contextual en dispositivos táctiles tras una pulsación larga.
- Habilitado el rectángulo de selección en pantallas táctiles eliminando la interferencia de gestos del navegador. (#31)

**Full Changelog**: https://github.com/https://github.com/juliopx/cuaderno/compare/v1.5.0...v1.5.1

## [1.5.0] - 2026-01-18

### Features
- Added support for local image uploads and improved hyperlink functionality in text shapes, including selection-aware link creation and interactive links in selection mode. (#35)
- Added support for context menu (right-click and long-press) in TLDraw, editor language synchronization, and fixed 1:1 panning. (#26)
- Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

### Bug Fixes
- Corregido el cierre prematuro del menú contextual en dispositivos táctiles tras una pulsación larga.
- Habilitado el rectángulo de selección en pantallas táctiles eliminando la interferencia de gestos del navegador. (#31)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.4.1...v1.5.0

## [1.4.1] - 2026-01-18

### Features
- Added support for context menu (right-click and long-press) in TLDraw, editor language synchronization, and fixed 1:1 panning. (#26)
- Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

### Bug Fixes
- Corregido el cierre prematuro del menú contextual en dispositivos táctiles tras una pulsación larga.
- Habilitado el rectángulo de selección en pantallas táctiles eliminando la interferencia de gestos del navegador. (#31)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.4.0...v1.4.1

## [1.4.0] - 2026-01-18

### Features
- Added support for context menu (right-click and long-press) in TLDraw, editor language synchronization, and fixed 1:1 panning. (#26)
- Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

**Full Changelog**: https://github.com/juliopx/cuaderno/compare/v1.3.1...v1.4.0

## [1.3.1] - 2026-01-18

### Features
- **Fix hybrid name editor**: Achieved pixel-perfect synchronization between text and pen strokes in file names and breadcrumbs. Fixed "linear drift" on long names and resolved layout/clipping issues in the sidebar and navigation path. (#20)

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
