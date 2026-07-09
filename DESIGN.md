# Halo Signal Design System

## 1. Atmosphere & Identity

Halo Signal is a compact safety command center. The signature is a dark, automotive-grade control surface where a real car traffic light, camera detection, and pedestrian voice warning all stay visible at once. The interface should feel precise, urgent, and calm under pressure.

## 2. Color

### Palette

| Role | Token | Dark | Usage |
|------|-------|------|-------|
| Surface/primary | `--surface-primary` | `#08090a` | Page background |
| Surface/radial | `--surface-radial` | `#111522` | Subtle background atmosphere |
| Surface/panel | `--surface-panel` | `#0f1011` | Primary panels |
| Surface/elevated | `--surface-elevated` | `#17191d` | Raised modules |
| Surface/soft | `--surface-soft` | `rgba(255,255,255,0.04)` | Toolbar and stat surfaces |
| Text/primary | `--text-primary` | `#f7f8f8` | Headlines and key values |
| Text/secondary | `--text-secondary` | `#d0d6e0` | Body text |
| Text/muted | `--text-muted` | `#8a8f98` | Captions and metadata |
| Border/subtle | `--border-subtle` | `rgba(255,255,255,0.06)` | Low-emphasis edges |
| Border/standard | `--border-standard` | `rgba(255,255,255,0.1)` | Panels and controls |
| Accent/primary | `--accent-primary` | `#7170ff` | Focus, active controls |
| Accent/hover | `--accent-hover` | `#8a8cff` | Hovered active controls |
| Signal/red | `--signal-red` | `#ff453a` | Car red light |
| Signal/yellow | `--signal-yellow` | `#ffd60a` | Car protected crossing light |
| Signal/green | `--signal-green` | `#30d158` | Car green light |
| Status/warning | `--status-warning` | `#f5b84b` | Pedestrian warning |
| Status/danger | `--status-danger` | `#ff5d5d` | Stop and risk indicators |

### Rules

- Use one chromatic UI accent, `--accent-primary`, for interactive focus only.
- Signal colors are reserved for signal lamps and safety status, never decoration.
- Any new color must be added here first.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `clamp(2.4rem, 6vw, 5.5rem)` | 590 | 0.95 | 0 | Main headline |
| H1 | `2rem` | 590 | 1.1 | 0 | Section title |
| H2 | `1.5rem` | 590 | 1.2 | 0 | Panel title |
| H3 | `1.125rem` | 590 | 1.35 | 0 | Card title |
| Body | `1rem` | 400 | 1.6 | 0 | Default text |
| Body/sm | `0.875rem` | 400 | 1.5 | 0 | Secondary copy |
| Caption | `0.75rem` | 510 | 1.4 | 0.04em | Labels, metadata |
| Mono | `0.875rem` | 400 | 1.45 | 0 | API payloads |

### Font Stack

- Primary: `Inter Variable`, `SF Pro Display`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- Mono: `Berkeley Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.

### Rules

- Letter spacing remains non-negative.
- Body text never drops below 14px.
- Korean copy must be concise and scan-friendly.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon-to-label gaps |
| `--space-2` | `8px` | Tight controls |
| `--space-3` | `12px` | Compact padding |
| `--space-4` | `16px` | Default card rhythm |
| `--space-5` | `20px` | Panel padding |
| `--space-6` | `24px` | Dense grid gaps |
| `--space-8` | `32px` | Section separation |
| `--space-10` | `40px` | Hero internal spacing |
| `--space-12` | `48px` | Page section rhythm |

### Grid

- Max content width: 1360px.
- Main workspace: responsive two-column grid, camera and signal panels visible together on desktop.
- Mobile: single-column stack with signal first after the hero stats.

## 5. Components

### Command Panel
- **Structure**: section with eyebrow, title, secondary copy, and optional stats.
- **Variants**: hero, camera, signal, warning.
- **Spacing**: `--space-5` to `--space-8`.
- **States**: default, hover for interactive child controls, focus-within.
- **Accessibility**: headings in source order, landmarks preserved.
- **Motion**: opacity and transform only.

### Icon Button
- **Structure**: native `button` with lucide icon and text.
- **Variants**: primary, secondary, danger.
- **Spacing**: `--space-2` horizontal gap, `--space-3`/`--space-4` padding.
- **States**: hover, active, focus-visible, disabled.
- **Accessibility**: button text remains visible; icon is decorative.
- **Motion**: 160ms color and transform.

### Car Traffic Light
- **Structure**: vertical housing with three circular lamps, labels, and protection notice underneath.
- **Variants**: red, yellow, green active.
- **Spacing**: `--space-4` lamp gap.
- **States**: inactive dimmed, active glow, reduced-motion static.
- **Accessibility**: current signal duplicated as text.
- **Motion**: lamp glow and scale only.

### TTS Warning Console
- **Structure**: risk headline, annual statistics, live estimate, and speak/stop controls.
- **Variants**: ready, speaking, unsupported.
- **Spacing**: `--space-4` internal grid.
- **States**: speaking live region, disabled unsupported controls.
- **Accessibility**: uses `aria-live` for speech status and visible text equivalent.
- **Motion**: subtle active pulse only when speaking.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | Button press |
| Standard | 200ms | ease-in-out | Lamp state shift |
| Emphasis | 420ms | cubic-bezier(0.16, 1, 0.3, 1) | Panel entrance |

Rules:
- Animate only `transform`, `opacity`, and `filter`.
- Respect `prefers-reduced-motion`.
- Every interactive element needs hover, active, focus-visible, and disabled states.

## 7. Depth & Surface

Strategy: mixed. Panels use translucent dark surfaces, subtle borders, inset highlights, and restrained shadows.

| Level | Value | Usage |
|-------|-------|-------|
| Panel | `0 24px 80px rgba(0,0,0,0.35)` | Major sections |
| Lamp active | signal-colored glow | Active signal only |
| Focus | `0 0 0 3px rgba(113,112,255,0.28)` | Keyboard focus |

Rules:
- No nested card stacks inside decorative cards.
- Radius scale: 6px controls, 8px small modules, 12px panels, 20px traffic housing.
