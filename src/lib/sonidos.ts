// Sonidos con Web Audio (sin archivos externos)
import { getAjustes } from "./ajustes";

let _ctx: AudioContext | null = null;
const ctx = () => {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  return _ctx;
};

function tono(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

export function beepAdd() {
  if (!getAjustes().sonidoAdd) return;
  tono(880, 0.08, "square", 0.12);
}

export function chimeCobro() {
  if (!getAjustes().sonidoCobro) return;
  tono(660, 0.12, "sine", 0.18);
  setTimeout(() => tono(990, 0.18, "sine", 0.18), 110);
}

export function beepTest() {
  tono(880, 0.12, "square", 0.18);
}
