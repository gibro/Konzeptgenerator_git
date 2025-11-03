# Repository Guidelines

## Project Structure & Module Organization
All deliverables live at the repo root for simplicity. `addtemplate.html` supplies the full IG Metall input form layout; `listtemplateheader.html`, `listtemplate.html`, and `listtemplatefooter.html` render listing views and must stay synchronized, while `singletemplate.html` covers detail pages. `preset.xml` maps placeholders like `[[Titel]]` to dynamic fields. `csstemplate.css` and `jstemplate.js` start empty by design—extend them only when styling or scripting cannot live inline.

## Build, Test, and Development Commands
No build tooling is required; open the templates directly or serve the folder locally. Use `python3 -m http.server 8000` from the repo root to preview layouts with relative paths intact. Run `npx html-validate addtemplate.html` if you have the validator installed to catch structural issues early.

## Coding Style & Naming Conventions
Follow HTML5 semantics, keep indentation at two spaces, and prefer multi-line attributes when a tag exceeds 120 characters. Attribute names stay in lowercase, placeholder tokens remain in `[[PascalCase]]`, and comments follow the `<!-- SECTION: Summary -->` pattern already in `addtemplate.html`. Avoid introducing framework-specific classes; reuse the existing `ig-*` prefix for shared components.

## Testing Guidelines
Before submitting, open the affected template in Chromium- and Firefox-based browsers and confirm expandable sections, placeholder rendering, and navigation anchors. Validate modified HTML via W3C Validator or `html-validate`, and lint CSS additions with `npx stylelint "*.css"` when you add custom styling. Attach annotated screenshots or screencasts for visual tweaks.

## Commit & Pull Request Guidelines
This repository has no published git history; please write imperative, scope-leading commit subjects (e.g., `Refine nav anchors`). Each pull request should summarise the problem, list the touched templates, reference related tickets, and include before/after visuals when UI changes are involved. Request review from the maintainer responsible for the consuming system before merging.

## Template-Specific Tips
Never rename placeholder tokens without updating `preset.xml`. When adding dynamic sections, keep summary labels concise to prevent overflow in the sticky navigation. If you introduce scripts, encapsulate them in functions within `jstemplate.js` and call them from a single inline hook to keep templates portable.
