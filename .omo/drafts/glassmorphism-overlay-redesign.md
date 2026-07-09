---
slug: glassmorphism-overlay-redesign
status: awaiting-approval
intent: clear
review_required: false
pending-action: write .omo/plans/glassmorphism-overlay-redesign.md
approach: Restructure TrafficLightDetector.tsx return JSX only. Swap the CSS-class-based 3-column grid layout for the already-defined glassmorphism styled-components — fullscreen webcam background (FullscreenContainer + WebcamContainer + VideoFrame), with TTS (TTSOverlay, top-left) and vehicle signal (SignalOverlay, top-right) as glass overlays, control bar at bottom. Zero logic changes: detection loop, state machine, TTS callbacks, postSignal all stay untouched.
---

# Draft: glassmorphism-overlay-redesign

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
- **fullscreen-webcam**: FullscreenContainer + WebcamContainer + VideoFrame replace the current CameraPanel. Webcam video/canvas fills the entire viewport. | active | app/components/TrafficLightDetector.tsx:440-721 (return JSX), styled-components at :31-124
- **glassmorphism-tts-overlay**: TTSOverlay (top-left glass panel) replaces WarningPanel. Same TTS controls, warning text, status — just rendered as a glass overlay. | active | app/components/TrafficLightDetector.tsx:161-176 (TTSOverlay definition), :877-924 (WarningPanel logic)
- **glassmorphism-signal-overlay**: SignalOverlay (top-right glass panel) replaces VehicleSignalPanel. Car traffic light lamps and pedestrian signal in glass style. | active | app/components/TrafficLightDetector.tsx:152-159 (SignalOverlay), :236-280 (SignalLampGlass), :821-866 (VehicleSignalPanel logic)
- **control-bar**: ControlBar (bottom center glass panel) replaces the CameraPanel start/stop/threshold controls. | active | app/components/TrafficLightDetector.tsx:140-150 (ControlBar), :178-234 (StyledButton)
- **empty-state**: EmptyState renders when camera is not running (no video feed). | active | app/components/TrafficLightDetector.tsx:126-138
- **globals-css-cleanup**: globals.css removes the now-unused .signal-workspace, .panel, .camera-panel, .signal-panel, .warning-panel classes and their children. | deferred | app/globals.css:93-129, 183-608

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
- **Existing styled-components used as-is**: The already-defined FullscreenContainer, GlassPanel, TTSOverlay, SignalOverlay, ControlBar, StyledButton, SignalLampGlass, etc. are used directly — no new styled-components are created. | The existing definitions match the glassmorphism spec perfectly (blur, border, inset highlights, glow). | Reversible — new styled-components can be created if needed.
- **CameraPanel, VehicleSignalPanel, WarningPanel sub-components removed**: Their logic content is inlined directly into the new overlay JSX. | These were thin presentational wrappers; inlining avoids indirection. | Reversible — can keep them as named sub-components.
- **globals.css cleanup deferred to a follow-up**: The old CSS-class panel styles remain in globals.css but are no longer referenced. Remove them in a separate cleanup wave. | Safe rollback — removing CSS while JSX still references old classes would break things; best to remove after JSX switch is verified. | Reversible — clean up in same wave if desired.
- **DESIGN.md updated with new glassmorphism overlay section**: Section 5 Components gets a new entry documenting the fullscreen glass overlay layout. | Required per design system gate. | Yes but required for compliance.

## Findings (cited - path:lines)
- TrafficLightDetector.tsx defines full glassmorphism styled-components at lines 31-393: FullscreenContainer (:32-45), GlassPanel (:47-89), WebcamContainer (:91-100), VideoFrame (:102-124), ControlBar (:140-150), SignalOverlay (:152-159), TTSOverlay (:161-176), StyledButton (:178-234), SignalLampGlass (:236-280), TelemetryGridGlass (:282-287), TelemetryItemGlass (:289-318), StatusPill (:320-361), WarningText (:363-393).
- The return JSX at lines 696-720 uses `<CameraPanel>`, `<VehicleSignalPanel>`, `<WarningPanel>` — all CSS-class-based sub-components.
- CameraPanel (:737-808) renders `class="panel camera-panel"`, `class="video-frame is-mirrored"`, etc.
- VehicleSignalPanel (:821-866) renders `class="panel signal-panel"` with `class="traffic-light vehicle"` lamps.
- WarningPanel (:877-924) renders `class="panel warning-panel"` with TTS controls.
- DESIGN.md exists at project root; Section 5 Components (:98-143) documents panel-based architecture.
- `app/layout.tsx` already gates react-scan, react-grab on NODE_ENV === 'development' (:18-31). React dev tooling gate is satisfied.
- `package.json` confirms @emotion/styled 11.14.1 is installed (:14) — styled-components work out of the box.
- No DESIGN.md change needed for color/tokens — existing palette covers the glassmorphism overlays (surface-soft, border-subtle, accent-primary, signal colors).

## Decisions (with rationale)
1. **Use existing styled-components, zero new ones** — they're fully defined and match the glassmorphism aesthetic. No reinvention.
2. **Inline CameraPanel/VehicleSignalPanel/WarningPanel content into the overlay JSX** — these sub-components exist only to break down the CSS-class layout; they hold no reusable logic. Inlining matches the fullscreen overlay structure better.
3. **Keep all logic code untouched** — useCallback hooks, refs, state, coco-ssd detection loop, state machine, TTS, postSignal all remain exactly as they are. This is purely a render restructuring.
4. **Globals.css cleanup deferred** — remove old panel CSS classes AFTER the JSX switch is verified to avoid broken-references risk.
5. **Update DESIGN.md Section 5** — document the new fullscreen overlay component architecture so the design system stays current.

## Scope IN
- TrafficLightDetector.tsx return JSX restructured to use FullscreenContainer, WebcamContainer, VideoFrame, EmptyState, SignalOverlay, TTSOverlay, ControlBar, and their child styled-components.
- DESIGN.md Section 5 updated with Fullscreen Glass Overlay component specification.
- globals.css: remove unused `.app-shell` max-width constraint (fullscreen doesn't need content bounds).

## Scope OUT (Must NOT have)
- Must NOT change any detection logic, state machine, TTS callbacks, postSignal, or coco-ssd handling.
- Must NOT create new styled-components — use only those already defined.
- Must NOT change the `/api/esp` endpoint, signal mapping, or auto-speak rules.
- Must NOT remove the old CSS classes from globals.css in this wave (deferred).
- Must NOT touch app/page.tsx or app/layout.tsx.

## Open questions
(None — all forks are resolved by the existing styled-components and DESIGN.md.)

## Approval gate
status: awaiting-approval
<!-- APPROVAL authorizes exactly: writing the plan file. It never authorizes implementation. -->
<!-- The user's original request to plan is not this gate's approval. -->
---