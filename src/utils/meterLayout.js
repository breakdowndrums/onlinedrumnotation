export function resolveBarMeters(bars, timeSig = { n: 4, d: 4 }, overrides = []) {
  return Array.from({ length: Math.max(1, Number(bars) || 1) }, (_, index) => {
    const source = overrides?.[index] || timeSig;
    return {
      n: Math.max(1, Math.round(Number(source?.n) || Number(timeSig.n) || 4)),
      d: Math.max(1, Math.round(Number(source?.d) || Number(timeSig.d) || 4)),
    };
  });
}

export function buildMeterLayout({ bars = 1, resolution = 8, timeSig, timeSigByBar = [], tupletsByBar = [] }) {
  const meters = resolveBarMeters(bars, timeSig, timeSigByBar);
  const tuples = meters.map((meter, bar) => Array.from({ length: meter.n }, (_, beat) => {
    const raw = tupletsByBar?.[bar]?.[beat];
    return raw == null || !Number.isFinite(Number(raw)) ? null : Math.max(1, Math.min(12, Math.round(Number(raw))));
  }));
  const subdivisions = tuples.map((row, bar) => row.map((value) => value ?? Math.max(1, Math.round(resolution / meters[bar].d))));
  const offsets = [0];
  const durations = [];
  const localTimes = [];
  const metronome = [];
  subdivisions.forEach((row, bar) => {
    let localTime = 0;
    row.forEach((subdiv, beat) => {
      const duration = 4 / meters[bar].d / subdiv;
      for (let sub = 0; sub < subdiv; sub++) {
        localTimes.push(localTime);
        durations.push(duration);
        metronome.push(sub === 0 ? beat === 0 ? 2 : 1 : 0);
        localTime += duration;
      }
    });
    offsets.push(durations.length);
  });
  return { meters, tuples, subdivisions, offsets, durations, localTimes, metronome };
}

// Keep musical time within each bar, even when another bar changes length.
export function mapMeterStep(step, before, after) {
  const bar = before.offsets.findIndex((end, index) => index > 0 && step < end) - 1;
  if (bar < 0 || bar >= after.meters.length) return -1;
  const time = before.localTimes[step];
  const meter = after.meters[bar];
  if (time >= meter.n * 4 / meter.d - 1e-8) return -1;
  let nearest = after.offsets[bar];
  for (let target = nearest + 1; target < after.offsets[bar + 1]; target++) {
    if (Math.abs(after.localTimes[target] - time) < Math.abs(after.localTimes[nearest] - time) - 1e-8) nearest = target;
  }
  return nearest;
}
