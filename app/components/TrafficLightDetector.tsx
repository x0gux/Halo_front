"use client";

import {
  type ReactNode,
  type RefObject,
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

// Styled components for glassmorphism UI
const FullscreenContainer = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background:
    radial-gradient(circle at 15% 10%, rgba(113, 112, 255, 0.15), transparent 30%),
    radial-gradient(circle at 85% 80%, rgba(48, 209, 88, 0.12), transparent 35%),
    linear-gradient(135deg, #0a0b0d 0%, #0f1115 50%, #08090a 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  z-index: 0;
`;

const GlassPanel = styled.div<{ $position?: "top" | "bottom" | "right" | "left" }>`
  position: absolute;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  border-radius: 24px;
  
  ${({ $position }) => {
    switch ($position) {
      case "top":
        return `
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: min(90%, 1200px);
          max-height: 35vh;
          overflow-y: auto;
        `;
      case "bottom":
        return `
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: min(90%, 800px);
        `;
      case "right":
        return `
          top: 50%;
          right: 24px;
          transform: translateY(-50%);
          width: 320px;
          max-height: 70vh;
        `;
      default:
        return "";
    }
  }}
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
  
  video, canvas {
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
`;

const ControlBar = styled(GlassPanel)`
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  z-index: 100;
`;

const SignalOverlay = styled(GlassPanel)`
  position: fixed;
  top: 32px;
  right: 32px;
  padding: 20px 28px;
  min-width: 280px;
  z-index: 100;
`;

const TTSOverlay = styled(GlassPanel)`
  position: fixed;
  top: 32px;
  left: 32px;
  padding: 20px 28px;
  min-width: 300px;
  z-index: 100;
  
  &.is-speaking {
    border-color: rgba(255, 93, 93, 0.4);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 0 60px rgba(255, 93, 93, 0.2);
  }
`;

const StyledButton = styled.button<{ $variant?: "primary" | "secondary" | "danger" }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 520;
  cursor: pointer;
  transition: all 200ms ease-out;
  
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
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
  position: relative;
  width: 80px;
  height: 80px;
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
  font-size: 12px;
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

const TelemetryGridGlass = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
`;

const TelemetryItemGlass = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  text-align: center;
  
  svg {
    color: rgba(255, 255, 255, 0.4);
    width: 18px;
    height: 18px;
  }
  
  span {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  strong {
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }
`;

const StatusPill = styled.div<{ $variant?: "live" | "red" | "yellow" | "green" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
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

const WarningText = styled.div`
  text-align: center;
  padding: 24px;
  
  .stop-label {
    display: inline-block;
    padding: 8px 16px;
    background: rgba(255, 93, 93, 0.15);
    border: 1px solid rgba(255, 93, 93, 0.4);
    border-radius: 6px;
    color: #ff8f8f;
    font-family: "Berkeley Mono", monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }
  
  h3 {
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
  }
  
  p {
    font-size: 14px;
    color: rgba(255, 208, 208, 0.7);
    line-height: 1.5;
  }
`;

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

function getCarSignal(pedestrianSignal: Signal): Signal {
  if (pedestrianSignal === "G") return "R";
  if (pedestrianSignal === "Y") return "Y";
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
    }).catch(() => {});
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

  return (
    <section className="signal-workspace" aria-label="자동차 신호와 보행자 보호 제어">
      <CameraPanel
        canvasRef={canvasRef}
        detected={detected}
        fps={fps}
        onThresholdChange={setThreshold}
        personCount={personCount}
        running={running}
        startCamera={startCamera}
        status={status}
        stopCamera={stopCamera}
        threshold={threshold}
        videoRef={videoRef}
      />
      <VehicleSignalPanel carSignal={carSignal} pedestrianSignal={pedestrianSignal} />
      <WarningPanel
        speakWarning={speakWarning}
        speaking={speaking}
        speechStatus={speechStatus}
        speechSupported={speechSupported}
        stopWarning={stopWarning}
      />
    </section>
  );
}

type CameraPanelProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  detected: boolean;
  fps: number;
  onThresholdChange: (threshold: number) => void;
  personCount: number;
  running: boolean;
  startCamera: () => void;
  status: string;
  stopCamera: () => void;
  threshold: number;
  videoRef: RefObject<HTMLVideoElement | null>;
};

function CameraPanel({
  canvasRef,
  detected,
  fps,
  onThresholdChange,
  personCount,
  running,
  startCamera,
  status,
  stopCamera,
  threshold,
  videoRef,
}: CameraPanelProps) {
  return (
    <div className="panel camera-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Camera detection</p>
          <h2>보행자 인식 화면</h2>
        </div>
        <span className={`live-pill ${running ? "is-live" : ""}`}>
          <Radio size={14} aria-hidden="true" />
          {running ? "LIVE" : "STANDBY"}
        </span>
      </div>

      <div className="video-frame is-mirrored">
        <video ref={videoRef} autoPlay muted playsInline aria-label="카메라 영상" />
        <canvas ref={canvasRef} aria-hidden="true" />
        {!running && (
          <div className="camera-placeholder">
            <ScanLine size={36} aria-hidden="true" />
            <span>카메라 시작 전</span>
          </div>
        )}
      </div>

      <div className="control-row">
        <button type="button" className="icon-button primary" onClick={startCamera} disabled={running}>
          <Camera size={16} aria-hidden="true" />
          카메라 시작
        </button>
        <button type="button" className="icon-button secondary" onClick={stopCamera} disabled={!running}>
          <Square size={16} aria-hidden="true" />
          정지
        </button>
      </div>

      <p className="system-status" aria-live="polite">
        {status}
      </p>

      <div className="telemetry-grid" aria-label="감지 상태">
        <TelemetryItem icon={<Users size={16} aria-hidden="true" />} label="감지 인원" value={personCount} />
        <TelemetryItem icon={<Eye size={16} aria-hidden="true" />} label="사람 감지" value={detected ? "감지됨" : "없음"} />
        <TelemetryItem icon={<Gauge size={16} aria-hidden="true" />} label="추론 FPS" value={fps} />
      </div>

      <label className="range-control">
        <span>감지 신뢰도 임계값</span>
        <strong>{threshold.toFixed(2)}</strong>
        <input
          type="range"
          min={0.2}
          max={0.9}
          step={0.05}
          value={threshold}
          onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}

function TelemetryItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="telemetry-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VehicleSignalPanel({
  carSignal,
  pedestrianSignal,
}: {
  carSignal: Signal;
  pedestrianSignal: Signal;
}) {
  return (
    <div className="panel signal-panel" data-car-signal={carSignal} data-pedestrian-signal={pedestrianSignal}>
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Vehicle signal</p>
          <h2>자동차용 신호등</h2>
        </div>
        <span className={`signal-chip ${SIGNAL_TONE[carSignal]}`}>{CAR_LABEL[carSignal]}</span>
      </div>

      <div className="car-signal-wrap">
        <div className="car-signal-header">
          <CarFront size={24} aria-hidden="true" />
          <span>차량 신호</span>
        </div>
        <div className="traffic-light vehicle" aria-label={`현재 자동차용 신호등: ${CAR_LABEL[carSignal]}`}>
          <SignalLamp color="red" label="R" active={carSignal === "R"} />
          <SignalLamp color="yellow" label="Y" active={carSignal === "Y"} />
          <SignalLamp color="green" label="G" active={carSignal === "G"} />
        </div>
        <div className="vehicle-led-board" role="status" aria-label="차량 운전자 안내: 사회적 약자가 지나가고있어요">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>사회적 약자가 지나가고있어요</span>
        </div>
        <div className="pedestrian-signal" aria-label={`현재 보행자용 신호등: ${PEDESTRIAN_LABEL[pedestrianSignal]}`}>
          <div className="pedestrian-signal-header">
            <Users size={16} aria-hidden="true" />
            <span>보행자용 신호등</span>
            <strong className={SIGNAL_TONE[pedestrianSignal]}>{PEDESTRIAN_LABEL[pedestrianSignal]}</strong>
          </div>
          <div className="pedestrian-lightbar">
            <SignalLamp color="red" label="보행 정지" active={pedestrianSignal === "R"} />
            <SignalLamp color="yellow" label="보행 주의" active={pedestrianSignal === "Y"} />
            <SignalLamp color="green" label="보행 가능" active={pedestrianSignal === "G"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalLamp({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <div className={`lamp ${color} ${active ? "on" : ""}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}

type WarningPanelProps = {
  speakWarning: () => void;
  speaking: boolean;
  speechStatus: string;
  speechSupported: boolean;
  stopWarning: () => void;
};

function WarningPanel({
  speakWarning,
  speaking,
  speechStatus,
  speechSupported,
  stopWarning,
}: WarningPanelProps) {
  return (
    <div className={`panel warning-panel ${speaking ? "is-speaking" : ""}`}>
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Pedestrian TTS</p>
          <h2>건너지마세요 경고 방송</h2>
        </div>
        <Megaphone size={22} aria-hidden="true" />
      </div>

      <div className="warning-copy">
        <span className="warning-led">STOP</span>
        <strong>건너지마세요</strong>
        <p>지금 건너면 위험합니다. 뒤로 물러나세요.</p>
      </div>

      <div className="control-row">
        <button type="button" className="icon-button danger" onClick={speakWarning} disabled={!speechSupported}>
          <Volume2 size={16} aria-hidden="true" />
          경고 방송 재생
        </button>
        <button type="button" className="icon-button secondary" onClick={stopWarning} disabled={!speechSupported || !speaking}>
          <VolumeX size={16} aria-hidden="true" />
          방송 중지
        </button>
      </div>

      <p className="system-status" aria-live="polite">
        <Activity size={14} aria-hidden="true" />
        {speechSupported ? speechStatus : "이 브라우저는 TTS를 지원하지 않습니다."}
      </p>
    </div>
  );
}
