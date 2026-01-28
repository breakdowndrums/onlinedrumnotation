export function makeAudioEngine() {
  let audioCtx = null;
  let master = null;

  // Transport
  let isPlaying = false;
  let bpm = 120;
  let resolution = 16;

  // Scheduler state
  let currentStep = 0;
  let nextNoteTime = 0;
  let timerId = null;

  // Lookahead
  const lookaheadMs = 25;
  const scheduleAheadTimeSec = 0.12;

  let buffers = {}; // instId -> AudioBuffer
  let onStep = null; // (stepIndex) => void

  function ensureContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);
  }

  async function resumeIfNeeded() {
    ensureContext();
    if (audioCtx.state !== "running") await audioCtx.resume();
  }

  function getContext() {
    return audioCtx;
  }

  function setBuffers(next) {
    buffers = next || {};
  }

  function setTransport({ nextBpm, nextResolution }) {
    if (typeof nextBpm === "number") bpm = nextBpm;
    if (typeof nextResolution === "number") resolution = nextResolution;
  }

  function secondsPerStep() {
    // BPM is quarter-notes per minute
    return (60 / bpm) * (4 / resolution);
  }

  function trigger(instId, time, velocity = 100) {
    if (!audioCtx || !master) return;
    const buf = buffers[instId];
    if (!buf) return;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const gain = audioCtx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, velocity / 127));

    src.connect(gain);
    gain.connect(master);

    src.start(time);
  }

  function scheduleStep(grid, instruments, stepIndex, time) {
    for (const inst of instruments) {
      const vel = grid[inst.id]?.[stepIndex] ?? 0;
      if (vel > 0) trigger(inst.id, time, vel);
    }
    if (onStep) onStep(stepIndex);
  }

  function scheduler(getGridSnapshot) {
    if (!audioCtx) return;

    const { grid, instruments, columns } = getGridSnapshot();

    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTimeSec) {
      scheduleStep(grid, instruments, currentStep, nextNoteTime);

      nextNoteTime += secondsPerStep();
      currentStep += 1;
      if (currentStep >= columns) currentStep = 0;
    }
  }

  async function play(getGridSnapshot, { startStep = 0 } = {}) {
    await resumeIfNeeded();
    if (isPlaying) return;

    const snap = getGridSnapshot();
    const maxStep = Math.max(0, (snap.columns ?? 1) - 1);
    currentStep = Math.max(0, Math.min(maxStep, startStep));
    nextNoteTime = audioCtx.currentTime + 0.03;

    isPlaying = true;
    timerId = window.setInterval(() => scheduler(getGridSnapshot), lookaheadMs);
  }

  function stop() {
    if (!isPlaying) return;
    isPlaying = false;
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function setOnStep(fn) {
    onStep = fn;
  }

  return {
    ensureContext,
    getContext,
    resumeIfNeeded,
    setBuffers,
    setTransport,
    setOnStep,
    play,
    stop,
  };
}
