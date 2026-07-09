import TrafficLightDetector from "./components/TrafficLightDetector";

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <div className="eyebrow">Halo Signal Ops</div>
          <h1 id="page-title">자동차용 신호등과 보행자 보호 방송을 한 화면에.</h1>
          <p>
            COCO-SSD 사람 인식으로 횡단 중인 사용자를 확인하고, 기존 <code>/esp</code> 신호 API에는
            그대로 <code>R</code>, <code>Y</code>, <code>G</code>만 전송합니다. 운전자는 자동차용 신호를 보고,
            보행자는 경고 TTS를 즉시 들을 수 있습니다.
          </p>
        </div>
        <aside className="hero-metrics" aria-label="보행자 사고 기준 통계">
          <div className="metric-tile">
            <span>최근 공식 보행자 사망</span>
            <strong>926명</strong>
          </div>
          <div className="metric-tile">
            <span>하루 평균 환산</span>
            <strong>2.5명</strong>
          </div>
          <div className="metric-tile">
            <span>ESP32 polling</span>
            <code>GET /esp</code>
          </div>
        </aside>
      </section>
      <TrafficLightDetector />
    </main>
  );
}
