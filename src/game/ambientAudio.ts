import type { EnvironmentState } from "./environment";

interface NoiseNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createNoiseLayer(
  context: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  filterType: BiquadFilterType,
  frequency: number,
  q: number
): NoiseNodes {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = context.createGain();
  gain.gain.value = 0;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start();

  return { source, filter, gain };
}

export class AmbientAudioController {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private wind: NoiseNodes | null = null;
  private water: NoiseNodes | null = null;
  private precipitation: NoiseNodes | null = null;
  private nightlife: NoiseNodes | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private melodyGain: GainNode | null = null;
  private melodyOsc: OscillatorNode | null = null;
  private nextToneChangeAt = 0;
  private currentNote = 220;

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      const context = this.context;
      const masterGain = context.createGain();
      masterGain.gain.value = 0.22;
      masterGain.connect(context.destination);
      this.masterGain = masterGain;

      const noiseBuffer = createNoiseBuffer(context);
      this.wind = createNoiseLayer(context, noiseBuffer, masterGain, "bandpass", 240, 0.9);
      this.water = createNoiseLayer(context, noiseBuffer, masterGain, "lowpass", 1200, 0.2);
      this.precipitation = createNoiseLayer(context, noiseBuffer, masterGain, "highpass", 3200, 0.15);
      this.nightlife = createNoiseLayer(context, noiseBuffer, masterGain, "bandpass", 5400, 1.8);

      const droneOsc = context.createOscillator();
      const droneGain = context.createGain();
      droneOsc.type = "triangle";
      droneOsc.frequency.value = 110;
      droneGain.gain.value = 0;
      droneOsc.connect(droneGain);
      droneGain.connect(masterGain);
      droneOsc.start();
      this.droneOsc = droneOsc;
      this.droneGain = droneGain;

      const melodyOsc = context.createOscillator();
      const melodyGain = context.createGain();
      melodyOsc.type = "sine";
      melodyOsc.frequency.value = this.currentNote;
      melodyGain.gain.value = 0;
      melodyOsc.connect(melodyGain);
      melodyGain.connect(masterGain);
      melodyOsc.start();
      this.melodyOsc = melodyOsc;
      this.melodyGain = melodyGain;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  update(environment: EnvironmentState, riverPresence: number): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;
    const timeBrightness = Math.max(0, Math.sin(((environment.timeOfDay - 6) / 24) * Math.PI * 2));
    const weatherWind =
      environment.weather === "windy"
        ? 1
        : environment.weather === "rain"
          ? 0.62
          : environment.weather === "snow"
            ? 0.42
            : environment.weather === "mist"
              ? 0.18
              : 0.28;
    const rainAmount = environment.weather === "rain" ? 1 : 0;
    const snowAmount = environment.weather === "snow" ? 0.85 : 0;
    const quietNight =
      (environment.season === "spring" ||
        environment.season === "summer" ||
        environment.season === "autumn") &&
      environment.weather !== "rain" &&
      environment.weather !== "snow";
    const nightPresence = (1 - timeBrightness) * (quietNight ? 1 : 0.1);

    this.wind?.filter.frequency.linearRampToValueAtTime(180 + weatherWind * 380, now + 0.2);
    this.wind?.gain.gain.linearRampToValueAtTime(0.005 + weatherWind * 0.028, now + 0.3);

    this.water?.filter.frequency.linearRampToValueAtTime(700 + riverPresence * 1800, now + 0.2);
    this.water?.gain.gain.linearRampToValueAtTime(riverPresence * 0.045, now + 0.3);

    this.precipitation?.filter.frequency.linearRampToValueAtTime(
      snowAmount > 0 ? 2200 : 3600,
      now + 0.2
    );
    this.precipitation?.gain.gain.linearRampToValueAtTime(
      rainAmount * 0.035 + snowAmount * 0.018,
      now + 0.3
    );
    this.nightlife?.filter.frequency.linearRampToValueAtTime(
      environment.season === "summer" ? 6200 : 5100,
      now + 0.2
    );
    this.nightlife?.gain.gain.linearRampToValueAtTime(
      nightPresence * 0.012 * (1 - weatherWind * 0.3),
      now + 0.4
    );

    this.droneGain?.gain.linearRampToValueAtTime(
      0.0025 + timeBrightness * 0.006 + nightPresence * 0.002,
      now + 0.4
    );

    if (this.droneOsc) {
      const base =
        environment.season === "winter"
          ? 98
          : environment.season === "autumn"
            ? 104
            : environment.season === "summer"
              ? 116
              : 110;
      this.droneOsc.frequency.linearRampToValueAtTime(base, now + 0.6);
    }

    if (this.melodyOsc && this.melodyGain && now >= this.nextToneChangeAt) {
      const scales: Record<EnvironmentState["season"], number[]> = {
        spring: [220, 247, 294, 330, 392],
        summer: [247, 294, 330, 370, 440],
        autumn: [196, 220, 247, 294, 330],
        winter: [174, 196, 220, 262, 294]
      };

      const notes = scales[environment.season];
      this.currentNote = notes[Math.floor(Math.random() * notes.length)]!;
      this.melodyOsc.frequency.cancelScheduledValues(now);
      this.melodyOsc.frequency.linearRampToValueAtTime(this.currentNote, now + 0.6);
      this.melodyGain.gain.cancelScheduledValues(now);
      this.melodyGain.gain.setValueAtTime(0.0, now);
      this.melodyGain.gain.linearRampToValueAtTime(
        0.009 + (1 - rainAmount - snowAmount) * 0.004,
        now + 1.2
      );
      this.melodyGain.gain.linearRampToValueAtTime(0.0, now + 4.8);
      this.nextToneChangeAt = now + 7 + Math.random() * 6;
    }
  }
}
