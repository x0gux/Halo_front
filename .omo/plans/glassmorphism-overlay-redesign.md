# glassmorphism-overlay-redesign - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** TrafficLightDetector 화면이 전체화면 웹캠 배경 위에 글라스모피즘 오버레이로 TTS 경고방송(좌측 상단)과 차량 신호등(우측 상단)을 띄우는 디자인으로 변경됩니다. 컨트롤 버튼은 하단 중앙에 배치됩니다.

**Why this approach:** 컴포넌트 파일에 이미 FullscreenContainer, TTSOverlay, SignalOverlay, ControlBar 등의 글라스모피즘 스타일드 컴포넌트가 전부 정의되어 있지만 사용되지 않고 있습니다. 기존 CSS 클래스 기반 3컬럼 레이아웃을 이 기존 스타일드 컴포넌트로 교체합니다. 감지 로직, TTS, 상태 머신은 전혀 변경되지 않습니다.

**What it will NOT do:**
- 감지 로직, 신호 상태 머신, TTS 콜백, /api/esp 통신을 변경하지 않습니다.
- 새 스타일드 컴포넌트를 만들지 않습니다 — 이미 정의된 것만 사용합니다.
- globals.css의 기존 패널 CSS 클래스를 이 웨이브에서 삭제하지 않습니다.

**Effort:** Short
**Risk:** Low — 순수 렌더링 재구성, 로직 불변
**Decisions to sanity-check:**
- 기존 스타일드 컴포넌트를 그대로 사용 (새 컴포넌트 생성 없음)
- CameraPanel/VehicleSignalPanel/WarningPanel 서브 컴포넌트 제거, 내용을 오버레이 JSX에 인라인
- globals.css 패널 클래스 정리는 후속 웨이브로 연기

Your next move: approve and start work. Full execution detail follows below.

---

> TL;DR (machine): Short / Low risk / Restructure TrafficLightDetector.tsx return JSX to use existing glassmorphism styled-components for fullscreen webcam + overlay layout. No logic changes. 2 files touched (TrafficLightDetector.tsx + DESIGN.md).

## Scope
### Must have
- Fullscreen webcam background via FullscreenContainer + WebcamContainer + VideoFrame
- TTS warning overlay (TTSOverlay, top-left) with speak/stop controls and status
- Vehicle signal overlay (SignalOverlay, top-right) with SignalLampGlass car lamps, LED notice, pedestrian lightbar
- Control bar (ControlBar, bottom center) with camera start/stop, threshold slider, telemetry
- EmptyState when camera not running
- DESIGN.md updated with Fullscreen Glass Overlay component spec (Section 5)
- Zero logic changes: detection loop, state machine, TTS, postSignal all untouched

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Must NOT change coco-ssd model loading, detectLoop, updateStateMachine, applySignal, postSignal, speakWarning, stopWarning
- Must NOT create new styled-components
- Must NOT remove the old CSS classes from globals.css (deferred to follow-up)
- Must NOT change app/page.tsx or app/layout.tsx
- Must NOT change signal mapping, auto-speak rule, or /api/esp endpoint
- Must NOT alter state/ref variables or hook signatures
- Must NOT introduce emojis, banned fonts, banned layout animations, or slop motion

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after — verify TypeScript compilation passes, dev server starts, then browser visual QA
- Evidence: .omo/evidence/task-N-glassmorphism-overlay-redesign.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- **Wave 1 (2 todos):** TrafficLightDetector.tsx JSX restructure + DESIGN.md update. These share the same file? No — different files. Serial dependency: DESIGN.md needs the final component structure, so todo 2 depends on todo 1 completion. Execute sequentially.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. JSX restructure | none | todo 2 | none |
| 2. DESIGN.md update | todo 1 | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. TrafficLightDetector.tsx: Restructure return JSX to use existing glassmorphism styled-components
  What to do / Must NOT do:
  - Replace `<section className="signal-workspace">` block (lines 697-720) with fullscreen overlay layout using existing styled-components
  - Layout: FullscreenContainer wraps everything; WebcamContainer + VideoFrame for webcam; EmptyState when !running
  - TTSOverlay (top-left): inline WarningPanel content — speakWarning/stopWarning buttons with StyledButton, speechStatus display, Megaphone icon
  - SignalOverlay (top-right): inline VehicleSignalPanel content — SignalLampGlass for car R/Y/G, vehicle LED notice, pedestrian lightbar with SignalLampGlass
  - ControlBar (bottom center): startCamera/stopCamera with StyledButton, threshold range input, telemetry grid with TelemetryItemGlass
  - StatusPill for running/standby indicator
  - Keep CameraPanel, VehicleSignalPanel, WarningPanel sub-component definitions in file for now (remove in cleanup wave)
  - Must NOT change any logic: hooks, refs, callbacks, state all stay; only the return JSX changes
  - Remove `<CameraPanel ... />`, `<VehicleSignalPanel ... />`, `<WarningPanel ... />` from return
  Parallelization: Wave 1 | Blocked by: none | Blocks: todo 2
  References (executor has NO interview context - be exhaustive):
  - TrafficLightDetector.tsx:31-393 (all styled-component definitions)
  - TrafficLightDetector.tsx:440-721 (current return JSX + sub-components to inline)
  - DESIGN.md:98-143 (Section 5 Components for reference)
  - globals.css:93 (signal-workspace grid layout — will no longer be used)
  Acceptance criteria (agent-executable):
  - `npx tsc --noEmit` passes with zero new errors
  - `npx next build 2>&1` completes successfully
  - File grep confirms no `className="signal-workspace"` in TrafficLightDetector.tsx return
  - File grep confirms `FullscreenContainer` appears in the return JSX
  QA scenarios (name the exact tool + invocation):
  - Happy: `npx tsc --noEmit` exits 0; check evidence .omo/evidence/task-1-typecheck.txt
  - Happy: `npx next build 2>&1` exits 0; check evidence .omo/evidence/task-1-build.txt
  - Failure: grep for `CameraPanel` / `VehicleSignalPanel` / `WarningPanel` JSX tags in return — should find 0 in the main return JSX
  Evidence .omo/evidence/task-1-glassmorphism-overlay-redesign.txt
  Commit: Y | refactor(TrafficLightDetector): restructure JSX to fullscreen glassmorphism overlay layout

- [ ] 2. DESIGN.md: Add Fullscreen Glass Overlay component specification to Section 5
  What to do / Must NOT do:
  - Add a new component entry in DESIGN.md Section 5 (after line 143) documenting the Fullscreen Glass Overlay component
  - Specify: structure (fullscreen container + webcam canvas + overlays), variants (tts-overlay, signal-overlay, control-bar), spacing (top-left/right/bottom fixed positioning), states (running/standby/speaking), and accessibility (landmarks preserved, aria-live for TTS)
  - Reference existing glassmorphism tokens: surface-soft, border-subtle, accent-primary, signal-red/yellow/green
  - Must NOT change any existing DESIGN.md entries — add-only
  Parallelization: Wave 1 | Blocked by: todo 1 | Blocks: none
  References:
  - DESIGN.md:98-143 (existing Component section structure)
  - TrafficLightDetector.tsx:31-393 (styled-component definitions to document)
  Acceptance criteria (agent-executable):
  - grep DESIGN.md for "Fullscreen Glass Overlay" finds the new section
  - DESIGN.md Section 5 has the new entry after the existing entries
  QA scenarios:
  - Happy: grep "Fullscreen Glass Overlay" DESIGN.md returns a match
  - Failure: grep count of "## 5. Components" sub-sections increases by exactly 1
  Evidence .omo/evidence/task-2-glassmorphism-overlay-redesign.txt
  Commit: Y | docs(DESIGN): add Fullscreen Glass Overlay component spec

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit: Confirm every Must-have from Scope is present; every Must-NOT-have is absent
- [ ] F2. Code quality review: TypeScript compilation, no unused imports, no logic changes in detection/TTS/signal code
- [ ] F3. Real manual QA: Visual QA via browser — confirm fullscreen webcam, glass overlays visible, controls functional
- [ ] F4. Scope fidelity: Verify no stray changes to page.tsx, layout.tsx, or any file outside scope

## Commit strategy
- Commit 1 (task 1): `refactor(TrafficLightDetector): restructure JSX to fullscreen glassmorphism overlay layout`
- Commit 2 (task 2): `docs(DESIGN): add Fullscreen Glass Overlay component spec`
- Final verification commit if any fixes needed: `chore(verify): final verification fixes for glassmorphism overlay`

## Success criteria
- TrafficLightDetector renders as fullscreen webcam with TTS and vehicle signal as glass overlays
- All existing functionality preserved: camera start/stop, detection, signal cycling, TTS speak/stop, /api/esp POST
- TypeScript compilation passes with zero errors
- Next.js build passes
- DESIGN.md updated with new component spec