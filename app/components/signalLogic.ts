export type Signal = "R" | "Y" | "G";
export type PedestrianSignal = "R" | "Y" | "G";

export const CYCLE_MS = 10000;
export const CLEAR_GRACE_MS = 2000;
export const DEMO_PHASE_MS = 3500;

type TrafficPhaseInput = {
  signal: Signal;
  phaseStart: number;
  lastSeen: number;
  personPresent: boolean;
  now: number;
};

type TrafficPhaseOutput = {
  signal: Signal;
  phaseStart: number;
  lastSeen: number;
};

export function getPedestrianSignal(carSignal: Signal): PedestrianSignal {
  if (carSignal === "R") return "G";
  if (carSignal === "Y") return "Y";
  return "R";
}

export function shouldAutoSpeakOnPedestrianSignalChange(
  previous: PedestrianSignal,
  next: PedestrianSignal
) {
  return previous !== "Y" && next === "Y";
}

export function getNextDemoSignal(signal: Signal): Signal {
  if (signal === "R") return "G";
  if (signal === "G") return "Y";
  return "R";
}

export function getNextTrafficPhase({
  signal,
  phaseStart,
  lastSeen,
  personPresent,
  now,
}: TrafficPhaseInput): TrafficPhaseOutput {
  if (signal === "G") {
    if (now - phaseStart < CYCLE_MS) {
      return { signal, phaseStart, lastSeen };
    }

    if (personPresent) {
      return { signal: "Y", phaseStart, lastSeen: now };
    }

    return { signal: "R", phaseStart: now, lastSeen };
  }

  if (signal === "R") {
    if (now - phaseStart >= CYCLE_MS) {
      return { signal: "G", phaseStart: now, lastSeen };
    }

    return { signal, phaseStart, lastSeen };
  }

  if (personPresent) {
    return { signal, phaseStart, lastSeen: now };
  }

  if (now - lastSeen >= CLEAR_GRACE_MS) {
    return { signal: "R", phaseStart: now, lastSeen };
  }

  return { signal, phaseStart, lastSeen };
}
