# Rainy Neon Store Theme Design

Date: 2026-10-19

## Intent

Add a fourth appearance choice to Token Tracker: a personal "Rainy Neon Store" theme. It is not a recolored light or dark mode. It is a compact, collectible miniature diorama that becomes the visual anchor of the dashboard while preserving the dashboard's real usage data and existing card workflow.

The emotional target is a quiet Japanese-animation convenience store at night: cool rain and neon outside, warm and full of life inside, observed from a third-person miniature scale. The scene is static enough to feel like a captured moment and animated enough to feel inhabited. There are no people and no UI inside the 3D scene.

## Goals

- Add `neon-store` as a first-class theme value while retaining Light, Dark, and System.
- Apply the theme across the whole signed-in application. The dashboard gets the 3D scene and special composition; other pages inherit the same night, glass, line, and accent language without embedding the store scene. Marketing, public-share, login, and authentication pages retain their existing treatment.
- Replace the expanded/collapsed sidebar behavior in this theme with a fixed compact icon rail. Navigation remains available at all supported desktop sizes.
- On the dashboard, place the miniature store beside the existing dashboard card area inside the right-hand main panel.
- Preserve every existing dashboard card, each card's feature behavior, screenshot mode, left/right column membership, drag-to-reorder within a column, and persisted custom order.
- Make all dashboard cards visually glass-like in this theme while leaving Light and Dark unchanged.
- Deliver a clear 3D diorama with a complete square base, legible store interior, perimeter street details, rain, and restrained animation.
- Provide deterministic fallbacks for WebGL failure, reduced motion, inactive tabs, screenshot mode, tests, and narrow windows.

## Non-goals

- No people or moving pedestrian simulation.
- No dashboard title, metrics, labels, or controls composited inside the 3D scene.
- No new usage metrics, new API endpoints, or changes to data aggregation.
- No changes to card visibility rules or card contents.
- No cross-column dragging between the two existing card columns.
- No free placement, moving the store to arbitrary positions, or a layout editor.
- No live WebGL store in public share pages, landing pages, screenshot captures, or non-dashboard direct routes. Screenshot mode may use the deterministic static store preview described below.
- No additional mobile-specific 3D experience. Mobile remains a card-first dashboard with a static store preview.

## Theme and Persistence

Extend the theme union from `light | dark | system` to `light | dark | system | neon-store`. The existing localStorage key `tokentracker-theme` remains the source of truth. The settings Appearance section and any other theme picker expose the fourth option using the copy registry in every supported locale.

The selected `neon-store` choice is persisted exactly like the existing choices. The pre-paint theme script in `index.html` must recognize it and establish the dark background before React loads to avoid a light flash. `resolvedTheme` remains the effective brightness (`light` or `dark`) for components that require two-way color decisions; add a separate explicit theme-mode value or boolean derived from `theme === "neon-store"` for the store-specific layout and styling. Native chrome synchronization uses the dark resolved appearance and preserves the selected theme value.

Selecting Light, Dark, or System restores the current product behavior exactly. Switching away from `neon-store` unmounts and disposes the WebGL renderer, GPU buffers, textures, and animation loop.

### Native Host Compatibility

The fourth theme value must be handled by every desktop host rather than silently coerced or rejected:

- macOS `NativeQAProfile` currently allowlists `setChromeAppearance` theme values as `system`, `light`, and `dark`. Add `neon-store` to that allowlist and its native/profile tests.
- macOS `DashboardWindowController.applyChromeAppearance` should treat `neon-store` as an explicitly dark chrome appearance, not as an accidental fallback.
- Windows `NativeTheme` currently normalizes unknown preferences to `dark`. Add `neon-store` as a recognized preference whose resolved appearance is dark, preserving it in native settings and when read back from dashboard localStorage.
- Windows tray, quota, and pet surfaces may continue to use their nearest-light/dark presentation; they only need the preference to round-trip without erasing the web-selected theme.
- Existing native theme pickers, if any, need not expose the fourth option in this change unless they are already the product's canonical web theme picker. The web Appearance picker remains authoritative, and native code must preserve its value.
- Add focused native tests for the accepted message/preference value and dark appearance resolution where those test suites exist.

## Sidebar Icon Rail

In `neon-store`, the desktop sidebar is always a fixed-width icon rail rather than an expandable panel. It contains, in order:

- Brand/app mark at the top.
- Primary navigation icons.
- Tool navigation icons, separated with compact rules.
- Settings near the bottom.
- Theme control at the bottom, retaining access to all four options.
- No always-visible text labels and no expand/collapse toggle.

All existing navigation routes and visibility conditions remain unchanged. Active items have a clear accent fill or rail treatment and an accessible `aria-current="page"`. Every icon has an accessible name and a tooltip that appears on hover and keyboard focus. The rail width is stable and large enough for a 40-44px target with safe gaps. Focus must never be hidden behind the tooltip or clipped.

Mobile navigation continues to use the existing drawer. It must not become a textless icon strip, because labels are necessary for usable discovery on narrow screens. The drawer inherits the theme palette and glass treatment.

The current expandable sidebar remains available unchanged in Light, Dark, and System themes.

## Dashboard Composition

The dashboard main panel is a dark rainy-night surface with real cards and a bounded diorama.

Desktop layout at `lg` and above:

- Reserve the fixed icon rail at the far left.
- The main panel uses a two-part horizontal layout: a fixed-proportion store pane and a wider dashboard card pane.
- The store pane is approximately 36-40% of the usable main-panel width, with practical min/max clamps. It is not a floating card inside another card; it is an unframed, full-height scene region with internal padding and a restrained model-display treatment.
- The card pane is approximately 60-64% of the width and uses a masonry-style two-column CSS grid for the existing left/right card streams. Existing ordering and drag behavior are preserved independently within each stream.
- The whole content region should fit the app's fixed viewport shell. The card pane scrolls independently when cards exceed the available height. The store remains visible and stable while cards scroll.
- Each existing card occupies its existing column stream. Removing or reordering one card must not disturb the other stream's persisted order.
- The existing drag handles and keyboard sorting remain persisted in the same localStorage keys and schema.

At medium widths where two useful card columns plus the store become too tight, reduce the store pane first, then move to the narrow layout. Do not allow text, controls, or card headers to overflow or be clipped.

Below `lg`:

- Keep the icon rail replaced by the existing mobile top bar and drawer.
- Use a single scrolling dashboard column.
- Show a square static store preview at the top with the same styling and fallback image; it must not initialize continuous WebGL.
- Existing cards follow in a single column with all cards and drag behavior available as they are today.

The visual hierarchy should make the 3D store and the data cards peers: the scene supplies the theme's atmosphere, while the cards remain the primary operational surface.

## Miniature Diorama

### Composition

The model has one complete square plinth/base. All buildings, road, sidewalk, props, store, and lighting sit on that base. There is no infinite ground plane or detached skybox. The scene is framed from a third-person overhead three-quarter angle, like a collectible diorama.

The convenience store is the visual center. Its front glazing faces the primary camera angle. The street corner has a clear turn: a main frontage, a side street or alley, and a corner intersection. Elements are compact enough to read as a miniature but ordered enough that each category is recognizable.

Required exterior elements:

- Main illuminated convenience-store sign.
- Large glazed storefront with a visible counter and aisles.
- Automatic sliding door and entry mat.
- Canopy with rain runoff.
- At least one vending machine.
- Bicycle.
- Umbrella stand.
- Trash bins at the entry.
- Streetlight.
- Utility pole and sagging overhead wires.
- Street sign and corner guard rails.
- Small parking area.
- Drain grates and gutter flow.
- Wet asphalt, puddles, and reflective crossing markings.
- Alley entrance.
- Air-conditioning outdoor unit.
- Small bulletin/poster board.

Required interior content, visible through the glazing:

- Multiple product shelves with distinct rows.
- Refrigerated drink wall.
- Bento section.
- Onigiri and snack displays.
- Checkout counter and register.
- Coffee machine.
- Magazine rack.
- In-store promotional posters.
- Ceiling light fixtures.
- Ice freezer.
- Oden/hot-food counter.
- Floor directional markings.
- Staff lockers and a back-room door.

Props should support the animation mood rather than fill the base indiscriminately. Silhouettes, spacing, and the storefront opening must stay legible at desktop and static-mobile sizes.

### Art Direction

The renderer uses a stylized, bright three-shaded anime look: cel-like stepped lighting, clean color fields, fine dark outlines, restrained surface texture, and soft night color separation. Do not use photorealistic materials or noisy texture detail.

Exterior palette: cool blue-grey rain, desaturated teal and indigo shadows, restrained red/amber shop accents, warm practical lights, and localized cyan/magenta neon. Avoid purple-dominant single-hue styling and avoid broad decorative gradient orbs.

Interior palette: warm cream and amber lighting, inviting whites, colored packaging, and cooler accents in beverage refrigeration. The lit interior must dominate the store silhouette and contrast with the dark exterior.

The base should have an edge profile and miniature-model finish, with a restrained rim rather than a glowing ring. The wet street and rain are part of the model, while the surrounding web surface is a quiet dark stage that lets the miniature stand out.

### Camera

Desktop scene camera is perspective but restrained enough to preserve the miniature feel. It starts at a fixed three-quarter view, framing the entire square base with modest negative space.

Interaction:

- Primary drag rotates the camera around the base.
- Wheel or trackpad scroll zooms within a safe range.
- Pointer gestures never prevent scrolling the card pane when the pointer is outside the scene.
- A double-click or small visible reset control outside the actual diorama restores the default view. The reset control is part of the dashboard, not embedded UI in the model.
- Orbit rotation is clamped to prevent going under the base or losing the model.
- Zoom is clamped to keep the square base complete and visually generous.

No interaction hint should occupy the scene image itself. If a hint is needed, it belongs in accessible description or the scene pane's surrounding control treatment.

### Animation

Baseline ambient animation:

- Continuous but lightweight rain, with varied streak lengths and speed.
- Drips from the canopy edge, synchronized to occasional ripple rings.
- Puddle ripples and rain rings.
- Wet-road and glass reflections of store and neon lights.
- Rain running down the storefront glass.
- Storefront sign with a rare, subtle flicker.
- Automatic door opening and closing on an irregular loop.
- Distant traffic signal changing on a slow cycle.
- Small light-temperature variation in the warm interior.

Animation must feel quiet and punctuated, not action-heavy. Avoid busy camera motion, constant dramatic flashes, or particle counts that obscure the interior.

## Runtime and Performance

Implement the diorama as a dedicated Three.js component, reusing the already-installed `three` dependency. Keep geometry, materials, textures, and animation setup in that component or adjacent scene helpers. Do not add React Three Fiber or another rendering framework.

Runtime rules:

- Load Three.js code only when the neon-store theme is active on a desktop dashboard. Do not add it to the initial route bundle.
- Use one renderer and one animation loop per mounted scene.
- Cap device-pixel ratio, use reasonable shadow-map size, and avoid per-frame allocations in the render loop.
- Reuse geometries/materials and instanced or batched geometry where it materially reduces draw calls.
- Keep particle counts responsive to viewport and device capability. Use fewer rain particles on small or low-power devices.
- Pause rendering when the tab is hidden or when the dashboard scene is outside the viewport/interaction is not needed.
- Dispose renderer, geometries, materials, textures, event listeners, observers, and animation frame on unmount.
- Respect `prefers-reduced-motion`: retain a high-quality static three-shaded scene, disable continuous rain and moving accents, and leave camera interaction available.
- Screenshot mode must render a deterministic static scene and must not include the WebGL motion or live animation state.
- If WebGL construction fails, show a static CSS/SVG or pre-rendered fallback that preserves the square miniature composition, theme copy, card layout, and all functionality.

For narrow/mobile and non-dashboard routes, show the static preview rather than mounting continuous WebGL. The visual fallback is a first-class surface, not an error page.

### Screenshot Behavior

Dashboard screenshot mode (`?screenshot=1`) is a deterministic capture surface used for documentation and visual comparisons. It is not the same as the live desktop experience.

- When neon-store is the selected theme, screenshot mode shows the static miniature-store preview beside the card area, with no live WebGL loop and no frame-to-frame randomness.
- If the screenshot scenario does not explicitly select neon-store, screenshots retain the existing appearance. The theme feature must not change existing default screenshot baselines.
- Screenshot mode does not need a separate share-card composition for the store, and public share pages remain outside this theme's 3D scope.
- The static preview must be deterministic across runs, including a stable camera angle, rain pattern, store lighting, and door state.
- Visual acceptance includes at least one neon-store desktop screenshot and one narrow screenshot.

## Data and Card Preservation

No data requests or card props change. `DashboardView` continues to register every existing card according to the same visibility booleans and default order:

- Left stream: identity/stats, optional install, heatmap, optional local device usage, trend, quality-per-dollar, optional session insights.
- Right stream: usage overview and data details.

The neon-store layout wraps these existing streams in glass theme containers only when the theme is active. Card internals must continue to work: tabs, custom date popovers, summary refresh/share/cost actions, provider expansion, details sorting/pagination, tooltips, drag handles, and empty/loading states.

"All cards glass-like" means the outer surface of every top-level dashboard card. The outer card surface is translucent with a subtle cool border, restrained highlight, soft depth, and enough tint and backdrop falloff to preserve text contrast. Nested inner surfaces, table rows, tooltips, modals, and form controls inherit the neon-store color tokens and remain visually coherent, but they do not all become independently translucent; preserving legibility and avoiding a stack of glass layers takes precedence.

Cards and card bodies are scoped by the dashboard's card wrappers so that headerless cards such as the trend, stats, heatmap, details, and usage overview surfaces receive the same treatment. Light, Dark, and System must not inherit these overrides.

Persisted card order keys and schema stay unchanged. The existing reorder hook and data flow remain the source of truth. If a card is hidden by its existing visibility rules, it remains absent. The theme must not substitute mock metrics or remove cards to make the layout easier.

## Whole-App Theme Treatment

For all signed-in routes, the neon-store theme provides:

- Deep rainy-night background surfaces.
- Fixed icon navigation in the desktop shell.
- Glass-like panels and controls with sufficiently opaque content surfaces for readability.
- Consistent cool linework and restrained warm interior accents.
- Accessible text and control contrast in all states.
- Native chrome synchronization to dark appearance.

Only the Overview dashboard mounts the store. Other pages use their existing structures and components under the theme tokens. They must not gain decorative 3D environments, oversized headings, or new page-specific compositions solely for the theme.

Light, Dark, and System retain their current layout, sidebar behavior, card surfaces, and visual hierarchy. Theme tokens must be scoped so that neon-store styles cannot leak into the other appearances.

## Accessibility and Interaction

- Icon-only rail links have accessible names and visible hover/focus tooltips.
- The theme picker labels the fourth option clearly and exposes selected state.
- The canvas has an accessible description of the rainy convenience-store diorama.
- Camera interaction is supplementary; all dashboard data and actions remain keyboard accessible outside the canvas.
- Reduced-motion setting freezes decorative animation.
- Glass surfaces keep readable contrast; do not rely solely on background blur.
- Card drag keyboard controls continue to work within each column.
- Focus indicators remain visible against both glass and dark surfaces.
- Do not make the canvas capture wheel events unless the user is intentionally zooming with the documented camera gesture; page/card scrolling must remain predictable.

## Responsive Behavior

- Wide desktop: store and card pane side by side, two card streams in the card pane.
- Shorter desktop: keep side-by-side composition, reduce vertical glass padding, and let the card pane scroll.
- Medium narrow desktop: shrink the store proportionally first; when the data columns cannot maintain their minimum usable width, switch to the narrow layout.
- Mobile: no continuous WebGL; static store preview followed by one card stream and the existing drawer navigation.
- At every breakpoint, UI text stays within its container, controls retain practical tap targets, and no pane overlaps another.

## Testing and Acceptance

Theme and shell:

- Theme storage accepts `neon-store`; initial pre-paint handling avoids a flash.
- Settings and icon-rail theme menus expose and select the fourth option.
- macOS native profile accepts the fourth value and resolves dark chrome; Windows preserves it as a dark preference.
- Theme switching disposes the scene and restores ordinary themes without layout leakage.
- Desktop neon-store shell shows a fixed icon rail; mobile retains labeled drawer navigation.
- Rail items retain active route semantics and accessible names.

Dashboard layout and cards:

- Every currently visible card registers under the same visibility conditions.
- Both streams retain their own persisted order.
- Point and keyboard drag reorder within a stream still call the existing reorder handlers.
- No card is removed, replaced, or placed in a new stream.
- The store pane is adjacent to, not above, the card pane at wide desktop sizes.
- Card-pane scrolling does not move the store pane.
- Narrow layout shows the static store preview and a single usable card stream.

3D scene:

- Desktop rendering is nonblank and the square base, lit storefront, interior shelving area, wet road, and required sign categories are visible in a screenshot.
- Camera drag rotates and wheel zoom stays inside clamped limits; reset returns to default.
- Door, rain, ripples, glass runoff, sign flicker, and signal cycling are observable but subtle.
- No people appear.
- No dashboard UI is painted inside the 3D scene.

Fallback and performance:

- WebGL failure keeps the theme and dashboard functional with the static fallback.
- Reduced motion pauses decorative animation without hiding content.
- Hidden tab pauses the render loop.
- Unmount releases WebGL resources.
- Screenshot mode is deterministic and does not include the live animation loop; existing default screenshots are unchanged.
- Existing focused tests, dashboard component/view tests, copy validation, guardrails, native theme tests, and a dashboard production build pass.

## Decisions Left to the Builder

- Exact store geometry, prop placement, and package/product detail level that fit the performance budget.
- Exact interior lighting intensities and cel-shading thresholds after visual comparison.
- Exact ratios and min/max widths for the store and card panes within the stated hierarchy.
- Which geometry can be instanced or merged without compromising the model composition.
- Whether the static preview is a captured asset or a deterministic lightweight render, provided it ships in the bundle and does not require live WebGL.
- Exact animation intervals, rain-particle counts by device tier, and shadow quality.
