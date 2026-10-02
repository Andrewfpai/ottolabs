/**
 * Focus soundscapes, synthesised live with the Web Audio API.
 *
 * Nothing is downloaded: every sound is shaped noise. Three looping noise
 * beds (white, pink, brown) are generated once, and each soundscape filters
 * and mixes them, then scatters short events on top — raindrops, cup clinks,
 * fire crackles — on a look-ahead scheduler so they keep time in a
 * background tab (audible tabs are not timer-throttled).
 *
 * One engine per page. `TimerBar` drives it (AGENTS rule 13); Settings may
 * borrow it for a short preview.
 */
import { getAudioContext } from "@/features/sessions/lib/chime";
import type { SoundscapeId } from "@/features/sounds/lib/prefs";

type Beds = { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer };
type Voice = { output: GainNode; stop: () => void };

const BED_SECONDS = 9;
const SEAM_SECONDS = 0.5;
const LOOKAHEAD_S = 1.5;
const TICK_MS = 250;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
/** Seconds until the next event of a Poisson process with this rate per second. */
const nextGap = (perSecond: number) => -Math.log(1 - Math.random()) / perSecond;

// ── Noise beds ─────────────────────────────────────────────────────────────

let beds: Beds | null = null;

/**
 * A stereo noise buffer that loops without a click: generated a little long,
 * with the overhang crossfaded into the start so the last sample runs
 * straight on into the first.
 */
function makeBed(ctx: AudioContext, next: () => () => number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * BED_SECONDS);
  const seam = Math.floor(ctx.sampleRate * SEAM_SECONDS);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    // Each channel its own noise, so the bed sounds wide rather than mono.
    const sample = next();
    const raw = new Float32Array(length + seam);
    for (let i = 0; i < raw.length; i++) raw[i] = sample();
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      if (i < seam) {
        const t = i / seam;
        data[i] = raw[i] * t + raw[length + i] * (1 - t);
      } else {
        data[i] = raw[i];
      }
    }
  }
  return buffer;
}

function getBeds(ctx: AudioContext): Beds {
  beds ??= {
    white: makeBed(ctx, () => () => Math.random() * 2 - 1),
    // Paul Kellet's economy pink-noise filter.
    pink: makeBed(ctx, () => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      return () => {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
        return out;
      };
    }),
    // Integrated (Brownian) noise, leaking back to zero so it never drifts.
    brown: makeBed(ctx, () => {
      let last = 0;
      return () => {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        return last * 3.5;
      };
    }),
  };
  return beds;
}

// ── Building blocks ────────────────────────────────────────────────────────

function loop(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0, Math.random() * BED_SECONDS);
  return source;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function gain(ctx: AudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

function pan(ctx: AudioContext, value: number): StereoPannerNode {
  const node = ctx.createStereoPanner();
  node.pan.value = value;
  return node;
}

/** Wire a chain of nodes in order; returns the last. */
function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

/** A very short filtered noise burst: one raindrop, one crackle, one pop. */
function burst(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  o: { duration: number; type: BiquadFilterType; frequency: number; q: number; level: number; pan: number },
) {
  const source = ctx.createBufferSource();
  source.buffer = getBeds(ctx).white;
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.level, at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.duration);
  const last = chain(source, filter(ctx, o.type, o.frequency, o.q), env, pan(ctx, o.pan));
  last.connect(out);
  source.start(at, Math.random() * (BED_SECONDS - 1), o.duration + 0.05);
  source.onended = () => last.disconnect();
}

/** A small bell-like ping: a spoon on a cup. Inharmonic partials, fast decay. */
function clink(ctx: AudioContext, out: AudioNode, at: number, base: number, level: number, side: number) {
  const panner = pan(ctx, side);
  panner.connect(out);
  for (const [ratio, share] of [
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.25],
  ]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = base * ratio;
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level * share, at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, at + rand(0.35, 0.6));
    osc.connect(env).connect(panner);
    osc.start(at);
    osc.stop(at + 0.7);
  }
  setTimeout(() => panner.disconnect(), (at - ctx.currentTime + 1) * 1000);
}

/**
 * Calls `fill(from, to)` for each slice of time ahead, so events can be
 * placed sample-accurately however late a timer fires.
 */
function schedule(ctx: AudioContext, fill: (from: number, to: number) => void): () => void {
  let cursor = ctx.currentTime + 0.05;
  const tick = () => {
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    if (horizon > cursor) {
      fill(Math.max(cursor, ctx.currentTime), horizon);
      cursor = horizon;
    }
  };
  tick();
  const id = setInterval(tick, TICK_MS);
  return () => clearInterval(id);
}

/** Collects what a soundscape started, so stopping it is one call. */
function voice(ctx: AudioContext) {
  const output = gain(ctx, 0);
  const sources: AudioScheduledSourceNode[] = [];
  const timers: (() => void)[] = [];
  return {
    output,
    bed(buffer: AudioBuffer) {
      const source = loop(ctx, buffer);
      sources.push(source);
      return source;
    },
    every(fill: (from: number, to: number) => void) {
      timers.push(schedule(ctx, fill));
    },
    done(): Voice {
      return {
        output,
        stop() {
          timers.forEach((stop) => stop());
          sources.forEach((s) => {
            try {
              s.stop();
            } catch {
              // Already stopped.
            }
          });
          output.disconnect();
        },
      };
    },
  };
}

// ── The soundscapes ────────────────────────────────────────────────────────

function rain(ctx: AudioContext): Voice {
  const v = voice(ctx);
  const b = getBeds(ctx);
  // The wash of rain everywhere, and the heavier body underneath it.
  chain(v.bed(b.pink), filter(ctx, "highpass", 500), filter(ctx, "lowpass", 6500), gain(ctx, 0.32), v.output);
  chain(v.bed(b.brown), filter(ctx, "lowpass", 800), gain(ctx, 0.42), v.output);

  // Individual drops close by: a Poisson patter, now and then a fat one.
  let next = ctx.currentTime;
  v.every((from, to) => {
    next = Math.max(next, from);
    while (next < to) {
      const heavy = Math.random() < 0.06;
      burst(ctx, v.output, next, {
        duration: heavy ? rand(0.03, 0.06) : rand(0.008, 0.025),
        type: "bandpass",
        frequency: heavy ? rand(600, 1300) : rand(1400, 5200),
        q: rand(3, 8),
        level: heavy ? rand(0.12, 0.22) : rand(0.03, 0.12),
        pan: rand(-0.9, 0.9),
      });
      next += nextGap(28);
    }
  });
  return v.done();
}

function cafe(ctx: AudioContext): Voice {
  const v = voice(ctx);
  const b = getBeds(ctx);
  chain(v.bed(b.brown), filter(ctx, "lowpass", 350), gain(ctx, 0.35), v.output);

  // Murmur: a few "voices" of band-limited noise, each talking in phrases of
  // syllable-rate swells, all heard through a wall (the low-pass).
  const murmurBus = gain(ctx, 1);
  chain(murmurBus, filter(ctx, "lowpass", 1700), gain(ctx, 0.9), v.output);
  for (let i = 0; i < 5; i++) {
    const formant = filter(ctx, "bandpass", rand(280, 720), 1.3);
    const env = gain(ctx, 0);
    chain(v.bed(b.pink), formant, env, pan(ctx, rand(-0.7, 0.7)), murmurBus);
    const base = formant.frequency.value;
    let t = ctx.currentTime + rand(0, 2);
    let talking = Math.random() < 0.6;
    let phraseEnd = t + rand(1.5, 5);
    v.every((from, to) => {
      t = Math.max(t, from);
      while (t < to) {
        if (t >= phraseEnd) {
          talking = !talking;
          phraseEnd = t + (talking ? rand(1.5, 5) : rand(0.6, 3));
        }
        const level = talking ? rand(0.04, 0.28) : 0;
        env.gain.setTargetAtTime(level, t, 0.04);
        formant.frequency.setTargetAtTime(base * rand(0.85, 1.15), t, 0.05);
        t += rand(0.12, 0.3);
      }
    });
  }

  // A cup or a spoon, every few seconds, sometimes twice.
  let next = ctx.currentTime + rand(1, 4);
  v.every((from, to) => {
    next = Math.max(next, from);
    while (next < to) {
      const base = rand(2200, 3600);
      const level = rand(0.015, 0.045);
      const side = rand(-0.8, 0.8);
      clink(ctx, v.output, next, base, level, side);
      if (Math.random() < 0.35) clink(ctx, v.output, next + rand(0.1, 0.18), base * rand(0.97, 1.03), level * 0.7, side);
      next += nextGap(1 / 6);
    }
  });
  return v.done();
}

function brown(ctx: AudioContext): Voice {
  const v = voice(ctx);
  chain(v.bed(getBeds(ctx).brown), filter(ctx, "lowpass", 1100), gain(ctx, 0.85), v.output);
  return v.done();
}

function ocean(ctx: AudioContext): Voice {
  const v = voice(ctx);
  const b = getBeds(ctx);
  // Two wave trains a little left and right, out of step with each other.
  for (const side of [-0.45, 0.45]) {
    const mix = gain(ctx, 1);
    chain(v.bed(b.brown), gain(ctx, 1), mix);
    chain(v.bed(b.pink), gain(ctx, 0.3), mix);
    const tone = filter(ctx, "lowpass", 450);
    const swell = gain(ctx, 0.12);
    chain(mix, tone, swell, pan(ctx, side), v.output);

    let wave = ctx.currentTime + rand(0, 4);
    v.every((from, to) => {
      wave = Math.max(wave, from);
      while (wave < to) {
        const period = rand(7, 12);
        const crest = wave + period * 0.4;
        swell.gain.setValueAtTime(swell.gain.value, wave);
        swell.gain.linearRampToValueAtTime(rand(0.5, 0.78), crest);
        swell.gain.setTargetAtTime(0.1, crest, period * 0.18);
        tone.frequency.setValueAtTime(tone.frequency.value, wave);
        tone.frequency.linearRampToValueAtTime(rand(1300, 2000), crest);
        tone.frequency.setTargetAtTime(420, crest, period * 0.16);
        wave += period;
      }
    });
  }
  return v.done();
}

function fire(ctx: AudioContext): Voice {
  const v = voice(ctx);
  const b = getBeds(ctx);
  // The roar, flickering.
  const roar = gain(ctx, 0.45);
  chain(v.bed(b.brown), filter(ctx, "lowpass", 450), roar, v.output);
  chain(v.bed(b.pink), filter(ctx, "bandpass", 3000, 0.7), gain(ctx, 0.035), v.output);
  let flicker = ctx.currentTime;
  v.every((from, to) => {
    flicker = Math.max(flicker, from);
    while (flicker < to) {
      roar.gain.setTargetAtTime(rand(0.3, 0.55), flicker, 0.2);
      flicker += rand(0.3, 0.8);
    }
  });

  // Crackles: single pops, and now and then a quick run of them.
  let next = ctx.currentTime;
  v.every((from, to) => {
    next = Math.max(next, from);
    while (next < to) {
      const run = Math.random() < 0.25 ? Math.floor(rand(2, 6)) : 1;
      let t = next;
      for (let i = 0; i < run; i++) {
        burst(ctx, v.output, t, {
          duration: rand(0.002, 0.007),
          type: "highpass",
          frequency: rand(1500, 4000),
          q: 0.7,
          level: rand(0.1, 0.35),
          pan: rand(-0.6, 0.6),
        });
        t += rand(0.01, 0.04);
      }
      next += nextGap(5);
    }
  });
  return v.done();
}

const BUILDERS: Record<SoundscapeId, (ctx: AudioContext) => Voice> = { rain, cafe, brown, ocean, fire };

/**
 * Evens out loudness, so switching soundscape does not jump in volume.
 * Measured: RMS at the same volume setting, scaled to match brown noise.
 */
const LEVEL: Record<SoundscapeId, number> = { rain: 1.8, cafe: 2.4, brown: 1, ocean: 0.9, fire: 1.8 };

// ── The engine ─────────────────────────────────────────────────────────────

type Target = { sound: SoundscapeId | null; volume: number };

const FADE_IN = 0.6;
const FADE_OUT = 0.45;

let master: GainNode | null = null;
let current: { id: SoundscapeId; voice: Voice } | null = null;
let sessionTarget: Target = { sound: null, volume: 0.5 };
let preview: { target: Target; timer: ReturnType<typeof setTimeout> } | null = null;

function getMaster(ctx: AudioContext): GainNode {
  if (!master) {
    master = gain(ctx, 0);
    // A gentle limiter, so a burst of drops can never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
  }
  return master;
}

function apply(target: Target) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const out = getMaster(ctx);
  const now = ctx.currentTime;

  if (current && current.id !== target.sound) {
    // Fade out, then stop it outright so it costs nothing while silent.
    const leaving = current.voice;
    leaving.output.gain.setTargetAtTime(0, now, FADE_OUT);
    setTimeout(() => leaving.stop(), FADE_OUT * 6000);
    current = null;
  }
  if (target.sound && !current) {
    const v = BUILDERS[target.sound](ctx);
    v.output.connect(out);
    v.output.gain.setValueAtTime(0, now);
    v.output.gain.setTargetAtTime(LEVEL[target.sound], now, FADE_IN);
    current = { id: target.sound, voice: v };
  }
  // Squared, because loudness is perceived roughly logarithmically.
  out.gain.setTargetAtTime(target.volume * target.volume, now, 0.15);
}

/** What the running session wants. A preview in progress takes precedence. */
export function setSessionSound(target: Target) {
  sessionTarget = target;
  if (!preview) apply(target);
}

/** Play a soundscape for a few seconds, then hand back to the session. */
export function previewSound(sound: SoundscapeId, volume: number, seconds = 6) {
  if (preview) clearTimeout(preview.timer);
  const target = { sound, volume };
  preview = {
    target,
    timer: setTimeout(() => {
      preview = null;
      apply(sessionTarget);
    }, seconds * 1000),
  };
  apply(target);
}

/** End a preview early (the picker closed, or another one started). */
export function stopPreview() {
  if (!preview) return;
  clearTimeout(preview.timer);
  preview = null;
  apply(sessionTarget);
}

export function isPreviewing(): boolean {
  return preview !== null;
}
