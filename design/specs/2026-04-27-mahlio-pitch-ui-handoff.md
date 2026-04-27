# Mahlio Pitch UI Handoff

Stand: 2026-04-27

## Chosen Direction

- Stitch project: `Mahlio Pitch UI Sprint 2026-04-27`
- Project ID: `7467535621837030012`
- Winning desktop screen: `Mahlio Weekly Workbench`
- Desktop screen ID: `a77951143f964966bee18da1d1f9be79`
- Winning mobile screen: `Mahlio Mobile Planner`
- Mobile screen ID: `151e97322d49425f8fc98f915810ea2c`
- Design system: `Mahlio Reserve`

## Fixed Decisions

- The authenticated product surface is not a dashboard. The weekly workbench is the hero.
- Desktop must show week, recipe context, and shopping in one composed workspace.
- Mobile must not shrink the desktop grid. It shows one active pane with day rail, focused meals, recipe, or shopping.
- The visible brand is `Mahlio`; do not reintroduce `Mealplanner` in user-facing UI.
- Palette: parchment base, olive ink, mature olive, sage, restrained tomato. No blue SaaS chrome, purple, grey admin grid, decorative blobs, or KPI tiles.
- Typography: `Newsreader` for brand, week, recipe and editorial hierarchy; `Plus Jakarta Sans` for controls and utility copy.
- Boundaries come from tonal surfaces and spacing, not heavy dividers.

## Flexible Decisions

- Real app data replaces the static Stitch meal examples.
- Existing React components stay in place where possible.
- Existing auth, premium, admin, feedback, Bring and onboarding behavior stays unchanged.
- Food imagery may use the existing project brand asset until a dedicated recipe-photo pipeline exists.

## Layout Map

Desktop:

1. Compact glass header with brand, week chip, create-week action, profile/admin/logout actions.
2. Slim editorial stage that frames the current week without becoming a marketing hero.
3. Workspace with two major zones:
   - left: dominant weekly workbench with all days visible and active-day emphasis
   - right: recipe context and shopping rail stacked as operational context
4. Prompt-debug and feedback surfaces remain secondary.

Mobile:

1. Compact sticky header.
2. Segmented switch: `Woche`, `Rezept`, `Einkauf`.
3. Active pane only.
4. Week pane shows day rail plus selected-day meal stack; inactive day sections collapse.
5. Recipe and shopping panes keep large touch targets and avoid text overlap.

## Component Mapping

- `DashboardPage`: workspace topology and stage copy.
- `MealBoard`: selected-day state and compact weekly workbench.
- `MealInspector`: editorial recipe hero with image-led focus, summary facts and actions.
- `ShoppingListPanel`: grouped checklist with progress and tomato-accent Bring action.
- `styles.css`: final visual system, breakpoints and pitch polish.

## Anti-Goals

- No generic card dashboard.
- No hero that pushes the product below the first viewport.
- No nested card piles.
- No decorative orb/blob background treatment.
- No mobile layout that requires reading a seven-column desktop grid.
- No secret, auth, premium, admin or API behavior changes for this pass.
