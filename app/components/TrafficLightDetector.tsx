"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

type Signal = "R" | "Y" | "G";

// 신호등 상태 머신 파라미터 (ESP32 main.cpp 의 R/Y/G 와 동일 의미)
//  기본: 일반 신호등처럼 10초마다 R ↔ G 를 번갈아 점등.
//  예외: G → R 로 바뀌는 순간 사람이 인식되어 있으면 R 로 가지 않고
//        Y(노랑)를 켜서 "사람이 사라질 때까지" 유지한다. 사람이 없어지면 R 로 전환.
const CYCLE_MS = 10000; // 빨강/초록 점등 시간 (10초)
// 노랑(Y) 유지 중, 사람이 이 시간만큼 "연속으로" 안 보여야 빨강으로 전환.
// COCO-SSD 가 프레임마다 사람을 놓치는(깜빡이는) 것을 흡수해, 사람이
// 다 건너서 더는 인식되지 않을 때까지 노랑이 유지되게 한다.
const CLEAR_GRACE_MS = 2000;

const SIGNAL_NAME: Record<Signal, string> = { R: "RED", Y: "YELLOW", G: "GREEN" };

export default function TrafficLightDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // 상태 머신 내부 상태 (렌더와 분리하기 위해 ref 사용)
  const signalRef = useRef<Signal>("R");
  const phaseStartRef = useRef(0); // 현재 R/G 점등이 시작된 시각
  const lastSeenRef = useRef(0); // 노랑 유지 중 마지막으로 사람이 보인 시각
  const lastFrameRef = useRef(0);
  const lastPostedRef = useRef<Signal | null>(null);

  const [status, setStatus] = useState("모델 로딩 중…");
  const [running, setRunning] = useState(false);
  const [signal, setSignal] = useState<Signal>("R");
  const [personCount, setPersonCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [threshold, setThreshold] = useState(0.55);
  const [mirrored, setMirrored] = useState(true);
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;

  // ── /esp API 로 신호 전송 (값이 바뀔 때만) ─────────────────────────
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
      signalRef.current = sig;
      setSignal(sig);
      postSignal(sig);
    },
    [postSignal]
  );

  // ── 상태 머신 갱신 ────────────────────────────────────────────────
  const updateStateMachine = useCallback(
    (personPresent: boolean, now: number) => {
      const cur = signalRef.current;

      if (cur === "G") {
        // 초록 10초 경과 → 빨강으로 전환할 차례
        if (now - phaseStartRef.current >= CYCLE_MS) {
          if (personPresent) {
            // 전환 순간 사람이 있으면 빨강 대신 노랑 유지
            applySignal("Y");
            lastSeenRef.current = now;
          } else {
            applySignal("R");
            phaseStartRef.current = now;
          }
        }
      } else if (cur === "R") {
        // 빨강 10초 경과 → 초록으로 전환
        if (now - phaseStartRef.current >= CYCLE_MS) {
          applySignal("G");
          phaseStartRef.current = now;
        }
      } else {
        // Y(노랑): 사람이 다 건너서 인식이 안 될 때까지 계속 유지.
        // 한 프레임 놓침(깜빡임)으로 꺼지지 않도록, CLEAR_GRACE_MS 동안
        // 연속으로 사람이 안 보일 때만 빨강으로 전환한다.
        if (personPresent) {
          lastSeenRef.current = now;
        } else if (now - lastSeenRef.current >= CLEAR_GRACE_MS) {
          applySignal("R");
          phaseStartRef.current = now;
        }
      }
    },
    [applySignal]
  );

  // ── 감지 박스 그리기 ──────────────────────────────────────────────
  const drawDetections = useCallback((persons: cocoSsd.DetectedObject[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#34c759";
    ctx.font = "16px sans-serif";
    const mir = mirroredRef.current;
    persons.forEach((p) => {
      const [bx, by, w, h] = p.bbox;
      // 비디오만 좌우반전되므로, 캔버스(정방향)에 박스를 그릴 때는
      // x 좌표만 반전시켜 거울 영상과 위치를 맞춘다. 글자는 정방향 유지.
      const x = mir ? canvas.width - (bx + w) : bx;
      const y = by;
      ctx.strokeStyle = "#34c759";
      ctx.strokeRect(x, y, w, h);
      const label = `person ${(p.score * 100).toFixed(0)}%`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#34c759";
      ctx.fillRect(x, y - 20, tw + 8, 20);
      ctx.fillStyle = "#000";
      ctx.fillText(label, x + 4, y - 5);
    });
  }, []);

  // ── 추론 루프 ─────────────────────────────────────────────────────
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
      /* 비디오 미준비 프레임 무시 */
    }

    drawDetections(persons);
    setPersonCount(persons.length);
    updateStateMachine(persons.length > 0, now);

    if (lastFrameRef.current) setFps(Number((1000 / (now - lastFrameRef.current)).toFixed(1)));
    lastFrameRef.current = now;

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [drawDetections, updateStateMachine]);

  // ── 카메라 시작/정지 ──────────────────────────────────────────────
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
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      phaseStartRef.current = performance.now();
      applySignal("R");
      setRunning(true);
      setStatus("실행 중 — 10초마다 빨강↔초록. 초록→빨강 순간 사람이 있으면 노랑 유지.");
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (e) {
      setStatus("카메라 접근 실패: " + (e as Error).message);
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
    applySignal("R");
    setStatus("정지됨.");
  }, [applySignal]);

  // ── 모델 로딩 (마운트 시 1회) ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("COCO-SSD 모델 로딩 중…");
        const model = await cocoSsd.load(); // 기본 lite_mobilenet_v2
        if (cancelled) return;
        modelRef.current = model;
        setStatus('모델 준비 완료 — "카메라 시작"을 누르세요.');
      } catch (e) {
        setStatus("모델 로딩 실패 (인터넷 연결 필요): " + (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const detected = personCount > 0;

  return (
    <div className="layout">
      {/* 카메라 */}
      <div className="card">
        <div className={`video-wrap ${mirrored ? "mirrored" : ""}`}>
          <video ref={videoRef} autoPlay muted playsInline />
          <canvas ref={canvasRef} />
        </div>
        <div className="controls">
          <button className="primary" onClick={startCamera} disabled={running}>
            ▶ 카메라 시작
          </button>
          <button onClick={stopCamera} disabled={!running}>
            ■ 정지
          </button>
        </div>
        <div className="status">{status}</div>
      </div>

      {/* 신호등 + 상태 */}
      <div className="card">
        <div className="traffic-light">
          <div className={`lamp red ${signal === "R" ? "on" : ""}`} />
          <div className={`lamp yellow ${signal === "Y" ? "on" : ""}`} />
          <div className={`lamp green ${signal === "G" ? "on" : ""}`} />
        </div>

        <div className="signal-box">
          <div className="label">ESP32로 전송될 신호 (GET /esp)</div>
          <div className="json">{JSON.stringify({ signal })}</div>
        </div>

        <div className="stat">
          <span>현재 상태</span>
          <span className="v">{SIGNAL_NAME[signal]}</span>
        </div>
        <div className="stat">
          <span>감지된 사람 수</span>
          <span className="v">{personCount}</span>
        </div>
        <div className="stat">
          <span>사람 감지</span>
          <span className="v">
            <span className={`badge ${detected ? "on" : "off"}`}>{detected ? "감지됨" : "없음"}</span>
          </span>
        </div>
        <div className="stat">
          <span>추론 FPS</span>
          <span className="v">{fps}</span>
        </div>

        <div className="field">
          <label>
            감지 신뢰도 임계값: {threshold.toFixed(2)}
          </label>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 20px;
}
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
}
.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}
.video-wrap video, .video-wrap canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.video-wrap canvas { pointer-events: none; }
.video-wrap.mirrored video { transform: scaleX(-1); }

.controls { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
button {
  background: #21262d;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
}
button:hover:not(:disabled) { background: #2d333b; }
button:disabled { opacity: .45; cursor: not-allowed; }
button.primary { background: #238636; border-color: #238636; }
button.primary:hover:not(:disabled) { background: #2ea043; }

.traffic-light {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  background: #1c1c1e;
  border: 3px solid #000;
  border-radius: 18px;
  padding: 18px;
  width: fit-content;
  margin: 0 auto 16px;
}
.lamp {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #2a2a2a;
  transition: all .25s;
  border: 2px solid #000;
}
.lamp.red.on    { background: var(--red);    box-shadow: 0 0 28px 6px var(--red); }
.lamp.yellow.on { background: var(--yellow); box-shadow: 0 0 28px 6px var(--yellow); }
.lamp.green.on  { background: var(--green);  box-shadow: 0 0 28px 6px var(--green); }

.signal-box {
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #0d1117;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.signal-box .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
.signal-box .json { font-size: 15px; margin-top: 6px; word-break: break-all; }

.stat { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.stat:last-child { border-bottom: none; }
.stat .v { font-weight: 600; }
.status { font-size: 13px; color: var(--muted); margin-top: 10px; min-height: 18px; }
.field { margin-top: 14px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.field input[type=range] { width: 100%; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge.on { background: rgba(52,199,89,.18); color: var(--green); }
.badge.off { background: rgba(255,59,48,.18); color: var(--red); }
`;
