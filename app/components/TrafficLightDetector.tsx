"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import {
  Activity,
  Camera,
  CarFront,
  Eye,
  Gauge,
  Megaphone,
  Radio,
  ScanLine,
  ShieldAlert,
  Square,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import styled from "@emotion/styled";

// ─────────────────────────────────────────────────────
// Glassmorphism styled components
// ─────────────────────────────────────────────────────

const FullscreenContainer = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background:
    radial-gradient(circle at 15% 10%, rgba(113, 112, 255, 0.15), transparent 30%),
    radial-gradient(circle at 85% 80%, rgba(48, 209, 88, 0.12), transparent 35%),
    linear-gradient(135deg, #0a0b0d 0%, #0f1115 50%, #08090a 100%);
  overflow: hidden;
  z-index: 0;
`;

const WebcamContainer = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 0;
`;

const VideoFrame = styled.div<{ $isRunning: boolean }>`
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;

  video,
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  canvas {
    pointer-events: none;
  }

  &.is-mirrored video {
    transform: scaleX(-1);
  }
`;

const EmptyState = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background:
    radial-gradient(circle at 50% 50%, rgba(113, 112, 255, 0.1), transparent 50%),
    #030405;
  color: rgba(255, 255, 255, 0.3);
  z-index: 2;
`;

// ── Glass overlay panels ──

const GlassOverlay = styled.div<{
  $top?: string;
  $right?: string;
  $bottom?: string;
  $left?: string;
  $transform?: string;
}>`
  position: fixed;
  ${({ $top }) => ($top ? `top: ${$top};` : "")}
  ${({ $right }) => ($right ? `right: ${$right};` : "")}
  ${({ $bottom }) => ($bottom ? `bottom: ${$bottom};` : "")}
  ${({ $left }) => ($left ? `left: ${$left};` : "")}
  ${({ $transform }) => ($transform ? `transform: ${$transform};` : "")}
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  z-index: 100;
`;

const SignalOverlay = styled(GlassOverlay)`
  top: 24px;
  right: 24px;
  padding: 20px 24px;
  min-width: 260px;
`;

const TTSOverlay = styled(GlassOverlay)`
  top: 24px;
  left: 24px;
  padding: 20px 24px;
  min-width: 280px;
  max-width: 360px;
  transition: border-color 300ms, box-shadow 300ms;

  &.is-speaking {
    border-color: rgba(255, 93, 93, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 60px rgba(255, 93, 93, 0.25);
  }
`;

const ControlBar = styled(GlassOverlay)`
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  flex-wrap: wrap;
  justify-content: center;
`;

// ── Internal glass components ──

const StyledButton = styled.button<{ $variant?: "primary" | "secondary" | "danger" }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 520;
  cursor: pointer;
  transition: all 200ms ease-out;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  ${({ $variant }) => {
    if ($variant === "primary") {
      return `
        background: linear-gradient(135deg, #7170ff, #5a58e8);
        border-color: rgba(113, 112, 255, 0.6);
        color: #fff;
        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #8a88ff, #6d6bf0);
        }
      `;
    }
    if ($variant === "danger") {
      return `
        background: rgba(255, 93, 93, 0.18);
        border-color: rgba(255, 93, 93, 0.5);
        color: #ff8f8f;
        &:hover:not(:disabled) {
          background: rgba(255, 93, 93, 0.28);
        }
      `;
    }
    return "";
  }}
`;

const SignalLampGlass = styled.div<{ $color: "red" | "yellow" | "green"; $active: boolean }>`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
  font-family: "Berkeley Mono", monospace;
  font-size: 11px;
  transition: all 300ms ease-out;

  ${({ $active, $color }) => {
    if (!$active) return "";

    const glowColor = {
      red: "rgba(255, 69, 58, 0.8)",
      yellow: "rgba(255, 214, 10, 0.7)",
      green: "rgba(48, 209, 88, 0.7)",
    }[$color];

    const bgColor = {
      red: "rgba(255, 69, 58, 0.95)",
      yellow: "rgba(255, 214, 10, 0.9)",
      green: "rgba(48, 209, 88, 0.9)",
    }[$color];

    return `
      background: ${bgColor};
      color: #000;
      font-weight: 700;
      box-shadow:
        0 0 40px ${glowColor},
        0 0 80px ${glowColor},
        inset 0 0 20px rgba(255, 255, 255, 0.4);
      transform: scale(1.08);
    `;
  }}
`;

const OverlaySectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  svg {
    color: rgba(255, 255, 255, 0.5);
    width: 18px;
    height: 18px;
  }

  span {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const LampRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 12px;
`;

const LedBoard = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(245, 184, 75, 0.5);
  border-radius: 6px;
  background: rgba(8, 7, 4, 0.5);
  color: #ffd66b;
  font-family: "Berkeley Mono", monospace;
  font-size: 12px;
  font-weight: 590;
  text-shadow: 0 0 8px rgba(255, 214, 10, 0.6);
  margin-bottom: 10px;

  svg {
    color: #ffd60a;
    flex-shrink: 0;
    filter: drop-shadow(0 0 6px rgba(255, 214, 10, 0.5));
  }
`;

const PedestrianInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);

  strong {
    font-weight: 600;
    &.red { color: #ff453a; }
    &.yellow { color: #ffd60a; }
    &.green { color: #30d158; }
  }

  svg {
    color: rgba(255, 255, 255, 0.4);
    width: 14px;
    height: 14px;
  }
`;

const TTSHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  svg {
    color: #ff5d5d;
    width: 20px;
    height: 20px;
  }

  h3 {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }
`;

const WarningContent = styled.div`
  text-align: center;
  padding: 12px;
  border: 1px solid rgba(255, 93, 93, 0.35);
  border-radius: 10px;
  background: rgba(255, 93, 93, 0.06);
  margin-bottom: 12px;

  .stop-badge {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(255, 93, 93, 0.2);
    border: 1px solid rgba(255, 93, 93, 0.5);
    border-radius: 4px;
    color: #ff8f8f;
    font-family: "Berkeley Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }

  h2 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
    line-height: 1.1;
  }

  p {
    font-size: 12px;
    color: rgba(255, 208, 208, 0.7);
    line-height: 1.4;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
`;

const StatusLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);

  svg {
    width: 12px;
    height: 12px;
    color: rgba(255, 255, 255, 0.3);
  }
`;

const StatusPill = styled.span<{ $variant?: "live" | "red" | "yellow" | "green" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);

  ${({ $variant }) => {
    if ($variant === "live") {
      return `
        color: #30d158;
        border-color: rgba(48, 209, 88, 0.4);
        background: rgba(48, 209, 88, 0.08);
      `;
    }
    if ($variant === "red") {
      return `
        color: #ff453a;
        border-color: rgba(255, 69, 58, 0.4);
      `;
    }
    if ($variant === "yellow") {
      return `
        color: #ffd60a;
        border-color: rgba(255, 214, 10, 0.4);
      `;
    }
    if ($variant === "green") {
      return `
        color: #30d158;
        border-color: rgba(48, 209, 88, 0.4);
      `;
    }
    return "";
  }}
`;

const TelemetryGridGlass = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const TelemetryItemGlass = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);

  svg {
    width: 12px;
    height: 12px;
    color: rgba(255, 255, 255, 0.35);
  }

  strong {
    color: rgba(255, 255, 255, 0.85);
    font-size: 13px;
    font-weight: 600;
  }
`;

const ThresholdSlider = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);

  input {
    width: 60px;
    accent-color: #7170ff;
  }

  strong {
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    min-width: 32px;
    text-align: right;
  }
`;

const StatusText = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
`;

// ─────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────

type Signal = "R" | "Y" | "G";

const CYCLE_MS = 10000;
const CLEAR_GRACE_MS = 2000;

const CAR_LABEL: Record<Signal, string> = {
  R: "차량 정지",
  Y: "보호 통과",
  G: "차량 진행",
};

const SIGNAL_TONE: Record<Signal, string> = {
  R: "red",
  Y: "yellow",
  G: "green",
};

const PEDESTRIAN_LABEL: Record<Signal, string> = {
  R: "보행자 정지",
  Y: "보행 주의",
  G: "보행 가능",
};

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function getCarSignal(pedestrianSignal: Signal): Signal {
  if (pedestrianSignal === "G") return "R";
  if (pedestrianSignal === "Y") return "R";
  return "G";
}

function shouldAutoSpeakOnPedestrianSignalChange(previous: Signal, next: Signal) {
  return previous !== "Y" && next === "Y";
}

function subscribeToSpeechSupport() {
  return () => undefined;
}

function getSpeechSupport() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function getServerSpeechSupport() {
  return false;
}

// ─────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────

export default function TrafficLightDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const signalRef = useRef<Signal>("R");
  const phaseStartRef = useRef(0);
  const lastSeenRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastPostedRef = useRef<Signal | null>(null);
  const lastPedestrianSignalRef = useRef<Signal>("R");
  const mirroredRef = useRef(true);

  const [status, setStatus] = useState("COCO-SSD 모델 로딩 중");
  const [running, setRunning] = useState(false);
  const [signal, setSignal] = useState<Signal>("R");
  const [personCount, setPersonCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [threshold, setThreshold] = useState(0.55);
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupport,
    getServerSpeechSupport
  );
  const [speaking, setSpeaking] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("경고 방송 대기 중");
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  const warningMessage = "꼬리물기하지 마세요. 사고 위험이 큽니다. 뒤로 물러나세요.";

  const detected = personCount > 0;
  const pedestrianSignal = signal;
  const carSignal = getCarSignal(pedestrianSignal);

  const speakWarning = useCallback(() => {
    if (!speechSupported) {
      setSpeechStatus("이 브라우저는 TTS를 지원하지 않습니다.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(warningMessage);
    utterance.lang = "ko-KR";
    utterance.rate = 1.08;
    utterance.pitch = 0.82;
    utterance.volume = 1;
    utterance.onstart = () => {
      setSpeaking(true);
      setSpeechStatus("경고 방송 송출 중");
    };
    utterance.onend = () => {
      setSpeaking(false);
      setSpeechStatus("경고 방송 완료");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechStatus("경고 방송 실패. 브라우저 음성 권한을 확인하세요.");
    };
    window.speechSynthesis.speak(utterance);
  }, [speechSupported, warningMessage]);

  const postSignal = useCallback((sig: Signal) => {
    if (lastPostedRef.current === sig) return;
    lastPostedRef.current = sig;
    fetch("/api/esp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal: sig }),
    }).catch(() => { });
  }, []);

  const applySignal = useCallback(
    (sig: Signal) => {
      const previousPedestrianSignal = lastPedestrianSignalRef.current;

      signalRef.current = sig;
      setSignal(sig);
      postSignal(sig);

      if (shouldAutoSpeakOnPedestrianSignalChange(previousPedestrianSignal, sig)) {
        speakWarning();
      }

      lastPedestrianSignalRef.current = sig;
    },
    [postSignal, speakWarning]
  );

  const updateStateMachine = useCallback(
    (personPresent: boolean, now: number) => {
      const cur = signalRef.current;

      if (cur === "G") {
        if (now - phaseStartRef.current >= CYCLE_MS) {
          if (personPresent) {
            applySignal("Y");
            lastSeenRef.current = now;
          } else {
            applySignal("R");
            phaseStartRef.current = now;
          }
        }
      } else if (cur === "R") {
        if (now - phaseStartRef.current >= CYCLE_MS) {
          applySignal("G");
          phaseStartRef.current = now;
        }
      } else if (personPresent) {
        lastSeenRef.current = now;
      } else if (now - lastSeenRef.current >= CLEAR_GRACE_MS) {
        applySignal("R");
        phaseStartRef.current = now;
      }
    },
    [applySignal]
  );

  const drawDetections = useCallback((persons: cocoSsd.DetectedObject[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const highlight = rootStyle.getPropertyValue("--signal-green").trim() || "#30d158";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = highlight;
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    persons.forEach((p) => {
      const [bx, by, w, h] = p.bbox;
      const x = mirroredRef.current ? canvas.width - (bx + w) : bx;
      const label = `person ${(p.score * 100).toFixed(0)}%`;
      const tw = ctx.measureText(label).width;

      ctx.strokeStyle = highlight;
      ctx.strokeRect(x, by, w, h);
      ctx.fillStyle = highlight;
      ctx.fillRect(x, Math.max(0, by - 22), tw + 10, 22);
      ctx.fillStyle = "#08090a";
      ctx.fillText(label, x + 5, Math.max(16, by - 6));
    });
  }, []);

  const detectLoop = useCallback(async () => {
    const video = videoRef.current;
    const model = modelRef.current;
    if (!video || !model) return;

    const now = performance.now();
    let persons: cocoSsd.DetectedObject[] = [];

    try {
      const predictions = await model.detect(video);
      persons = predictions.filter((p) => p.class === "person" && p.score >= thresholdRef.current);
    } catch {
      setStatus("카메라 프레임 대기 중");
    }

    drawDetections(persons);
    setPersonCount(persons.length);
    updateStateMachine(persons.length > 0, now);

    if (lastFrameRef.current) {
      setFps(Number((1000 / (now - lastFrameRef.current)).toFixed(1)));
    }
    lastFrameRef.current = now;

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [drawDetections, updateStateMachine]);

  const startCamera = useCallback(async () => {
    if (!modelRef.current) {
      setStatus("모델이 아직 준비되지 않았습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      phaseStartRef.current = performance.now();
      applySignal("R");
      setRunning(true);
      setStatus("실행 중. 보행 신호 기준으로 차량 신호가 연동됩니다.");
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (e) {
      setStatus(`카메라 접근 실패: ${(e as Error).message}`);
    }
  }, [applySignal, detectLoop]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);

    setRunning(false);
    setPersonCount(0);
    setFps(0);
    applySignal("R");
    setStatus("정지됨.");
  }, [applySignal]);

  const stopWarning = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeechStatus("경고 방송 중지됨");
  }, [speechSupported]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("COCO-SSD 모델 로딩 중");
        const model = await cocoSsd.load();
        if (cancelled) return;
        modelRef.current = model;
        setStatus("모델 준비 완료");
      } catch (e) {
        setStatus(`모델 로딩 실패: ${(e as Error).message}`);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // ── Render ──────────────────────────────────────────

  return (
    <FullscreenContainer>
      {/* ── Fullscreen webcam ── */}
      <WebcamContainer>
        <VideoFrame $isRunning={running} className={mirroredRef.current ? "is-mirrored" : ""}>
          <video ref={videoRef} autoPlay muted playsInline aria-label="카메라 영상" />
          <canvas ref={canvasRef} aria-hidden="true" />
          {!running && (
            <EmptyState>
              <ScanLine size={48} aria-hidden="true" />
              <span>카메라 시작 전</span>
            </EmptyState>
          )}
        </VideoFrame>
      </WebcamContainer>

      {/* ── Vehicle Signal — Top Right ── */}
      <SignalOverlay>
        <OverlaySectionLabel>
          <CarFront aria-hidden="true" />
          <span>차량 신호</span>
          <StatusPill
            $variant={carSignal === "R" ? "red" : carSignal === "Y" ? "yellow" : "green"}
            style={{ marginLeft: "auto" }}
          >
            {CAR_LABEL[carSignal]}
          </StatusPill>
        </OverlaySectionLabel>

        <LampRow>
          <SignalLampGlass $color="red" $active={carSignal === "R"}>
          </SignalLampGlass>
          <SignalLampGlass $color="green" $active={carSignal === "G"}>
          </SignalLampGlass>
        </LampRow>

        <LedBoard>
          <ShieldAlert size={16} aria-hidden="true" />
          <span>사회적 약자가 지나가고있어요</span>
        </LedBoard>

        <PedestrianInfo>
          <Users aria-hidden="true" />
          <span>보행자: </span>
          <strong className={SIGNAL_TONE[pedestrianSignal]}>{PEDESTRIAN_LABEL[pedestrianSignal]}</strong>
        </PedestrianInfo>
      </SignalOverlay>

      {/* ── TTS — Top Left ── */}
      <TTSOverlay className={speaking ? "is-speaking" : ""}>
        <TTSHeader>
          <Megaphone aria-hidden="true" />
          <h3>건너지마세요 경고 방송</h3>
        </TTSHeader>

        <WarningContent>
          <div className="stop-badge">STOP</div>
          <h2>건너지마세요</h2>
          <p>지금 건너면 위험합니다. 뒤로 물러나세요.</p>
        </WarningContent>

        <ButtonRow>
          <StyledButton $variant="danger" onClick={speakWarning} disabled={!speechSupported}>
            <Volume2 size={16} aria-hidden="true" />
            경고 방송 재생
          </StyledButton>
          <StyledButton onClick={stopWarning} disabled={!speechSupported || !speaking}>
            <VolumeX size={16} aria-hidden="true" />
            방송 중지
          </StyledButton>
        </ButtonRow>

        <StatusLine>
          <Activity aria-hidden="true" />
          <span>{speechSupported ? speechStatus : "이 브라우저는 TTS를 지원하지 않습니다."}</span>
        </StatusLine>
      </TTSOverlay>

      {/* ── Control Bar — Bottom Center ── */}
      <ControlBar>
        <StyledButton $variant="primary" onClick={startCamera} disabled={running}>
          <Camera size={16} aria-hidden="true" />
          카메라 시작
        </StyledButton>
        <StyledButton $variant="danger" onClick={stopCamera} disabled={!running}>
          <Square size={16} aria-hidden="true" />
          정지
        </StyledButton>

        <StatusPill $variant={running ? "live" : "neutral"}>
          <Radio size={12} aria-hidden="true" />
          {running ? "LIVE" : "STANDBY"}
        </StatusPill>

        <div aria-hidden style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        <TelemetryGridGlass>
          <TelemetryItemGlass>
            <Users aria-hidden="true" />
            <span>인원 </span>
            <strong>{personCount}</strong>
          </TelemetryItemGlass>
          <TelemetryItemGlass>
            <Eye aria-hidden="true" />
            <span>감지 </span>
            <strong>{detected ? "감지됨" : "없음"}</strong>
          </TelemetryItemGlass>
          <TelemetryItemGlass>
            <Gauge aria-hidden="true" />
            <span>FPS </span>
            <strong>{fps}</strong>
          </TelemetryItemGlass>
        </TelemetryGridGlass>

        <ThresholdSlider>
          <span>신뢰도</span>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
          <strong>{threshold.toFixed(2)}</strong>
        </ThresholdSlider>

        <StatusText>{status}</StatusText>
      </ControlBar>
    </FullscreenContainer>
  );
}
