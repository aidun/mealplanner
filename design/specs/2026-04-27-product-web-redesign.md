# Mahlio Product Web Redesign Contract

## Scope

This redesign covers the existing React/Vite frontend surfaces: login, authenticated planner, recipe inspector, shopping list, onboarding/profile, admin, feedback, invite acceptance, and legal pages. Backend APIs, routes, auth behavior, data models, and deployment manifests stay unchanged.

## Product Reading

Mahlio is a shared weekly kitchen workspace for couples and families. The primary jobs are: create or review a weekly plan, inspect a recipe, regenerate or favorite a meal, export to Bring, maintain the household profile, manage family accounts, and triage premium/admin feedback.

## Chosen Direction

Reference concept: `/Users/markus/.codex/generated_images/019dcfb4-35f8-75d0-9d07-c44fc15399e8/ig_0fc7c9396dc80eb40169ef8b77ca908191bd60962cde90a590.png`

Use a product-first command table: compact navigation, a week agenda as the main work surface, recipe detail as the focused context surface, and shopping as an operational rail. The product should feel modern, calm, and useful rather than promotional.

## Visual System

- Base: porcelain white, soft graphite, and pale cool neutrals.
- Accents: mint for active planning, raspberry for primary action/focus, turmeric for food/category accents, muted blue for secondary state.
- Typography: crisp sans-serif UI with restrained brand-scale display treatment only where useful.
- Components: 6-10px radii, fine borders, low shadows, clear focus rings, stable 44px touch targets.
- Imagery: use the new command-table food asset at `/brand/mahlio-command-table.png` for entry/profile/recipe moments.

## Layout Map

- Desktop: sticky app header, compact stage, two-zone workspace with weekly board left and recipe/shopping rail right.
- Tablet: board and rail stack without changing task order.
- Mobile: segmented pane switch controls full-width Week, Recipe, and Shopping task panes.
- Admin/profile/legal: use the same product shell, grid rhythm, form controls, and status language.

## States

Loading, error, success, empty, active day, active pane, active recipe, selected favorite, disabled Bring export, and resolved feedback states must remain visually explicit.

## Anti-Goals

- No generic landing page as the first screen.
- No old warm cream/sage/tomato visual palette.
- No decorative orb/blob backgrounds.
- No nested-card visual flattening.
- No backend, API, route, or auth rewiring.
