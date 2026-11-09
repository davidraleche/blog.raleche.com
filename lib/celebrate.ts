"use client";
// Shared celebration effects: synthesized sound (no audio files) plus confetti and fireworks.
import confetti from "canvas-confetti";

/* ---------- Sound: synthesized, no audio files ---------- */
let ctx: AudioContext | null = null;
export function audio() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}
export function tone(freq: number, at: number, dur: number, type: OscillatorType = "triangle", vol = 0.18) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}
export const tick = () => tone(1400, 0, 0.03, "square", 0.05);
export function fanfare() {
  // Rising arpeggio, then a held major chord.
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.18));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.5, 0.9, "triangle", 0.12));
  [1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.55 + i * 0.07, 0.25, "sine", 0.06));
}

/* ---------- Confetti and fireworks ---------- */
export function celebrate() {
  const colors = ["#e1251b", "#f5a623", "#0a0a0a", "#ffffff", "#ffd700"];
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors, zIndex: 10000 });
  const end = Date.now() + 2500;
  const burst = () => {
    // Fireworks: bursts at random spots in the upper half of the screen.
    confetti({ particleCount: 50, startVelocity: 30, spread: 360, ticks: 70, gravity: 0.9, origin: { x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.35 }, colors, shapes: ["star", "circle"], scalar: 1.1, zIndex: 10000 });
    if (Date.now() < end) setTimeout(burst, 280);
  };
  burst();
  confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, zIndex: 10000 });
  confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, zIndex: 10000 });
}

/** Sounds are skipped when the reader muted the wheel. */
export const isMuted = () => { try { return localStorage.getItem("wheel-muted") === "1"; } catch { return false; } };

/** "Treasure unlocked" jingle: a sparkling run up the scale, a fanfare, then a shimmering held chord. */
export function unlockJingle() {
  audio().resume();
  [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, i * 0.06, 0.16, "sine", 0.07));
  fanfare();
  [392, 523.25, 659.25, 783.99].forEach((f) => tone(f, 1.25, 1.4, "triangle", 0.09));
  [2637, 3136, 3520].forEach((f, i) => tone(f, 1.3 + i * 0.12, 0.3, "sine", 0.035));
}
