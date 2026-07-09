"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
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
import {
  getNextTrafficPhase,
  getPedestrianSignal,
  shouldAutoSpeakOnPedestrianSignalChange,
  type PedestrianSignal,
  type Signal,
} from "./signalLogic";

const PEDESTRIAN_FATALITIES = 926;

const SIGNAL_LABEL: Record<Signal, string> = {
  R: "차량 정지",
  Y: "보호 통과",
  G: "차량 진행",
};

const SIGNAL_TONE: Record<Signal, string> = {
  R: "red",
  Y: "yellow",
  G: "green",
};

const PEDESTRIAN_LABEL: Record<PedestrianSignal, string> = {
  R: "보행자 정지",
  Y: "보행 주의",
  G: "보행 가능",
};

const PEDESTRIAN_TONE: Record<PedestrianSignal, string> = {
  R: "red",
  Y: "yellow",
  G: "green",
};

function getAnnualizedEstimate() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const nextYear = new Date(now.getFullYear() + 1, 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.max(1, Math.ceil((now.getTime() - start.getTime() + 1) / dayMs));
  const daysInYear = Math.round((nextYear.getTime() - start.getTime()) / dayMs);
  const estimatedFatalities = Math.round((PEDESTRIAN_FATALITIES / daysInYear) * elapsedDays);

  return {
    estimatedFatalities: Math.max(1, estimatedFatalities),
  };
}

type RiskStats = ReturnType<typeof getAnnualizedEstimate>;

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
  const lastPedestrianSignalRef = useRef<PedestrianSignal>("G");
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

  const riskStats = useMemo(() => getAnnualizedEstimate(), []);
  const warningMessage = useMemo(
    () =>
      `건너지마세요. 연간 보행자 사망 ${PEDESTRIAN_FATALITIES}명. 올해도 약 ${riskStats.estimatedFatalities}명이 목숨을 잃었습니다.`,
    [riskStats.estimatedFatalities]
  );

  const detected = personCount > 0;
  const pedestrianSignal = getPedestrianSignal(signal);

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
    }).catch(() => {
      setStatus("ESP32 신호 전송 실패. 네트워크 상태를 확인하세요.");
    });
  }, []);

  const applySignal = useCallback(
    (sig: Signal) => {
      const previousPedestrianSignal = lastPedestrianSignalRef.current;
      const nextPedestrianSignal = getPedestrianSignal(sig);

      signalRef.current = sig;
      setSignal(sig);
      postSignal(sig);

      if (shouldAutoSpeakOnPedestrianSignalChange(previousPedestrianSignal, nextPedestrianSignal)) {
        speakWarning();
      }

      lastPedestrianSignalRef.current = nextPedestrianSignal;
    },
    [postSignal, speakWarning]
  );

  const updateStateMachine = useCallback(
    (personPresent: boolean, now: number) => {
      const next = getNextTrafficPhase({
        signal: signalRef.current,
        phaseStart: phaseStartRef.current,
        lastSeen: lastSeenRef.current,
        personPresent,
        now,
      });

      phaseStartRef.current = next.phaseStart;
      lastSeenRef.current = next.lastSeen;

      if (next.signal !== signalRef.current) {
        applySignal(next.signal);
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
      setStatus("실행 중. 10초마다 차량 빨강과 초록이 전환되고, 횡단자가 있으면 노랑 보호 모드로 유지됩니다.");
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
    setStatus("정지됨. 차량 신호는 안전 기본값 R로 전송됩니다.");
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
        setStatus("모델 준비 완료. 카메라 시작을 누르세요.");
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
      <VehicleSignalPanel pedestrianSignal={pedestrianSignal} signal={signal} />
      <WarningPanel
        riskStats={riskStats}
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
  pedestrianSignal,
  signal,
}: {
  pedestrianSignal: PedestrianSignal;
  signal: Signal;
}) {
  return (
    <div className="panel signal-panel" data-car-signal={signal} data-pedestrian-signal={pedestrianSignal}>
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Vehicle signal</p>
          <h2>자동차용 신호등</h2>
        </div>
        <span className={`signal-chip ${SIGNAL_TONE[signal]}`}>{SIGNAL_LABEL[signal]}</span>
      </div>

      <div className="car-signal-wrap">
        <div className="car-signal-header">
          <CarFront size={24} aria-hidden="true" />
          <span>CAR SIGNAL</span>
        </div>
        <div className="traffic-light vehicle" aria-label={`현재 자동차용 신호등: ${SIGNAL_LABEL[signal]}`}>
          <SignalLamp color="red" label="R" active={signal === "R"} />
          <SignalLamp color="yellow" label="Y" active={signal === "Y"} />
          <SignalLamp color="green" label="G" active={signal === "G"} />
        </div>
        <div className="pedestrian-signal" aria-label={`현재 보행자용 신호등: ${PEDESTRIAN_LABEL[pedestrianSignal]}`}>
          <div className="pedestrian-signal-header">
            <Users size={16} aria-hidden="true" />
            <span>보행자용 신호등</span>
            <strong className={PEDESTRIAN_TONE[pedestrianSignal]}>{PEDESTRIAN_LABEL[pedestrianSignal]}</strong>
          </div>
          <div className="pedestrian-lightbar">
            <SignalLamp color="red" label="보행 정지" active={pedestrianSignal === "R"} />
            <SignalLamp color="yellow" label="보행 주의" active={pedestrianSignal === "Y"} />
            <SignalLamp color="green" label="보행 가능" active={pedestrianSignal === "G"} />
          </div>
        </div>
        <div className="vulnerable-notice">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>사회적 약자가 지나가고있어요</span>
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
  riskStats: RiskStats;
  speakWarning: () => void;
  speaking: boolean;
  speechStatus: string;
  speechSupported: boolean;
  stopWarning: () => void;
};

function WarningPanel({
  riskStats,
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
        <p>연간 사망 {PEDESTRIAN_FATALITIES.toLocaleString()}명 · 올해 추정 약 {riskStats.estimatedFatalities.toLocaleString()}명</p>
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
