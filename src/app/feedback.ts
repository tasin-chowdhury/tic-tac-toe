let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, duration: number, delay = 0, type: OscillatorType = "sine", volume = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const start = ctx.currentTime + delay;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

export function playMoveSound(player: "X" | "O") {
  tone(player === "X" ? 520 : 400, 0.12, 0, "sine", 0.12);
}

export function playWinSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.18, i * 0.09, "triangle", 0.14));
}

export function playDrawSound() {
  tone(300, 0.25, 0, "sawtooth", 0.08);
  tone(260, 0.3, 0.08, "sawtooth", 0.08);
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function primeAudio() {
  getAudioContext();
}

const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0];
const PATTERN = [0, 2, 4, 2, 1, 3, 5, 3];
const STEP_DURATION = 0.42;

let musicMasterGain: GainNode | null = null;
let musicTimer: number | null = null;
let stepIndex = 0;
let nextNoteTime = 0;

function ensureMusicGraph(ctx: AudioContext) {
  if (musicMasterGain) return;
  musicMasterGain = ctx.createGain();
  musicMasterGain.gain.value = 0.05;

  const delay = ctx.createDelay();
  delay.delayTime.value = STEP_DURATION * 1.5;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.25;
  delay.connect(feedback);
  feedback.connect(delay);

  musicMasterGain.connect(delay);
  delay.connect(ctx.destination);
  musicMasterGain.connect(ctx.destination);
}

function playMusicNote(ctx: AudioContext, freq: number, time: number) {
  if (!musicMasterGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(1, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + STEP_DURATION * 0.9);
  osc.connect(gain);
  gain.connect(musicMasterGain);
  osc.start(time);
  osc.stop(time + STEP_DURATION);
}

function scheduler(ctx: AudioContext) {
  while (nextNoteTime < ctx.currentTime + 0.2) {
    const freq = SCALE[PATTERN[stepIndex % PATTERN.length]];
    playMusicNote(ctx, freq, nextNoteTime);
    nextNoteTime += STEP_DURATION;
    stepIndex++;
  }
  musicTimer = window.setTimeout(() => scheduler(ctx), 50);
}

export function startMusic() {
  const ctx = getAudioContext();
  if (!ctx || musicTimer !== null) return;
  ensureMusicGraph(ctx);
  stepIndex = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  scheduler(ctx);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
