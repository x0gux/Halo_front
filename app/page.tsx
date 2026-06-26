import TrafficLightDetector from "./components/TrafficLightDetector";

export default function Home() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        🚦 신호등 시스템 — COCO-SSD 사람 인식
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        ESP32 신호등(<code>main.cpp</code>)의 R/Y/G 신호 로직을 Next.js로 재현합니다. 기본은 10초마다
        빨강↔초록이 번갈아 켜지고, 초록→빨강으로 바뀌는 순간 카메라에 사람이 잡히면 빨강 대신
        노랑을 켜서 사람이 사라질 때까지 유지합니다. 같은 신호가 <code>/esp</code> API로 전송되어
        ESP32가 폴링할 수 있습니다.
      </p>
      <TrafficLightDetector />
    </main>
  );
}
