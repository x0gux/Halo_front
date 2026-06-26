import { NextResponse } from "next/server";

// ESP32(main.cpp)가 폴링하는 신호 상태를 메모리에 보관.
// 브라우저(사람 인식 클라이언트)가 POST 로 갱신하고,
// ESP32 가 GET 으로 읽어간다.  형식: {"signal":"R"|"Y"|"G"}
type Signal = "R" | "Y" | "G";

// 모듈 스코프 = 서버 프로세스 내 단순 인메모리 저장소
const state: { signal: Signal; updatedAt: number } = {
  signal: "R",
  updatedAt: 0,
};

// CORS (브라우저가 다른 포트/호스트에서 POST 할 수 있도록 허용)
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  // ESP32 의 parseSignalFromJson 이 "\"signal\":\"" 를 찾으므로 이 형식 유지
  return NextResponse.json(
    { signal: state.signal, updatedAt: state.updatedAt },
    { headers: cors }
  );
}

export async function POST(req: Request) {
  let body: { signal?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: cors });
  }

  const sig = String(body.signal ?? "").toUpperCase();
  if (sig !== "R" && sig !== "Y" && sig !== "G") {
    return NextResponse.json({ error: "signal must be R|Y|G" }, { status: 400, headers: cors });
  }

  state.signal = sig as Signal;
  state.updatedAt = Date.now();
  return NextResponse.json({ signal: state.signal, updatedAt: state.updatedAt }, { headers: cors });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}
