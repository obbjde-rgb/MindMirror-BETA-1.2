// PodLive Digital Audio Engineering Engine (2026 Studio Standard)
// Hybrid Architecture: Flash TTS 3.8 + Lyria AI Soundscape + Multi-Track Web Audio DSP + Environmental SFX Sampler

import { applyAntiPopEnvelope, extractAudioFromBase64 } from './audio';

export interface AudioRackSettings {
  // 3-Band Parametric EQ
  lowGain: number;       // dB (-15 to +15)
  midGain: number;       // dB (-15 to +15)
  highGain: number;      // dB (-15 to +15)
  lowCut: boolean;       // 80Hz High-pass

  // Broadcast Compressor
  compThreshold: number; // dB (-60 to 0)
  compRatio: number;     // 1 to 20
  compAttack: number;    // seconds (0.001 to 0.1)
  compRelease: number;   // seconds (0.05 to 0.5)

  // Spatial Reverb
  reverbMix: number;     // 0 to 1
  roomType: 'podcast_booth' | 'athenian_hall' | 'vintage_radio' | 'cosmic_space' | 'fireside_salon';

  // Voice Profiler & Character Timbre
  voiceProfile: 'natural_human' | 'bionic_synth' | 'historical_scholar' | 'broadcast_warmth' | 'quantum_mind';
  pitchShift: number;    // Playback rate modifier (0.8 to 1.3)
  
  // Master & Ducking
  masterVolume: number;  // 0 to 1.5
  ambientVolume: number; // 0 to 1
  sfxVolume: number;     // 0 to 1
  autoDucking: boolean;  // Duck ambient when speech plays
}

export const DEFAULT_RACK_SETTINGS: AudioRackSettings = {
  lowGain: 3,
  midGain: 1,
  highGain: 2,
  lowCut: true,
  compThreshold: -22,
  compRatio: 4,
  compAttack: 0.005,
  compRelease: 0.15,
  reverbMix: 0.12,
  roomType: 'podcast_booth',
  voiceProfile: 'natural_human',
  pitchShift: 1.0,
  masterVolume: 1.0,
  ambientVolume: 0.25,
  sfxVolume: 0.6,
  autoDucking: true,
};

export type AmbientSoundscapeType = 
  | 'none' 
  | 'lofi_thought' 
  | 'cosmic_drone' 
  | 'classical_strings' 
  | 'vinyl_warmth' 
  | 'rain_and_thunder' 
  | 'forest_birds' 
  | 'city_traffic'
  | 'lyria_ai_music';

export type PunctualSFXType = 
  | 'thunder_clap' 
  | 'rain_shower' 
  | 'birds_chirp' 
  | 'car_passing' 
  | 'coffee_cup' 
  | 'gavel_strike' 
  | 'applause'
  | 'feather_quill'
  | 'laughter_burst'
  | 'gasp_sigh';

export class PodLiveAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Rack Nodes
  private lowCutFilter: BiquadFilterNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private midPeak: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Ambient Soundscape Bus
  private ambientGain: GainNode | null = null;
  private ambientDuckingGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private ambientNoiseSource: AudioBufferSourceNode | null = null;
  private currentAmbientMode: AmbientSoundscapeType = 'none';

  // SFX Environmental Sampler Bus
  private sfxGainNode: GainNode | null = null;

  // Active Speech Source
  private activeSpeechSource: AudioBufferSourceNode | null = null;
  private isSpeechActive = false;

  // Master Recorder
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordedMimeType: string = 'audio/webm';

  public getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.isInitialized = false;
      this.analyser = null;
      this.streamDestination = null;
      this.lowCutFilter = null;
      this.ambientGain = null;
      this.ambientDuckingGain = null;
      this.sfxGainNode = null;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public initRack(): AnalyserNode {
    if (this.isInitialized && this.analyser) {
      return this.analyser;
    }

    const ctx = this.getAudioContext();

    // 1. Low Cut Filter (Highpass 80Hz)
    this.lowCutFilter = ctx.createBiquadFilter();
    this.lowCutFilter.type = 'highpass';
    this.lowCutFilter.frequency.setValueAtTime(80, ctx.currentTime);

    // 2. 3-Band Parametric EQ
    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.setValueAtTime(220, ctx.currentTime);
    this.lowShelf.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.lowGain, ctx.currentTime);

    this.midPeak = ctx.createBiquadFilter();
    this.midPeak.type = 'peaking';
    this.midPeak.frequency.setValueAtTime(1400, ctx.currentTime);
    this.midPeak.Q.setValueAtTime(1.2, ctx.currentTime);
    this.midPeak.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.midGain, ctx.currentTime);

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.setValueAtTime(4500, ctx.currentTime);
    this.highShelf.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.highGain, ctx.currentTime);

    // 3. Studio Dynamics Compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(DEFAULT_RACK_SETTINGS.compThreshold, ctx.currentTime);
    this.compressor.ratio.setValueAtTime(DEFAULT_RACK_SETTINGS.compRatio, ctx.currentTime);
    this.compressor.attack.setValueAtTime(DEFAULT_RACK_SETTINGS.compAttack, ctx.currentTime);
    this.compressor.release.setValueAtTime(DEFAULT_RACK_SETTINGS.compRelease, ctx.currentTime);

    // 4. Stereo Panner
    if (ctx.createStereoPanner) {
      this.panner = ctx.createStereoPanner();
    }

    // 5. Spatial Reverb & Wet/Dry Routing
    this.convolver = ctx.createConvolver();
    this.setReverbImpulse(DEFAULT_RACK_SETTINGS.roomType);

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain.gain.setValueAtTime(1 - DEFAULT_RACK_SETTINGS.reverbMix, ctx.currentTime);
    this.wetGain.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.reverbMix, ctx.currentTime);

    // 6. Master Bus & Analyser
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.masterVolume, ctx.currentTime);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    // 7. Ambient Soundscape Sub-Bus
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.ambientVolume, ctx.currentTime);
    this.ambientDuckingGain = ctx.createGain();
    this.ambientDuckingGain.gain.setValueAtTime(1.0, ctx.currentTime);

    this.ambientGain.connect(this.ambientDuckingGain);
    this.ambientDuckingGain.connect(this.masterGain);

    // 8. SFX Sampler Sub-Bus
    this.sfxGainNode = ctx.createGain();
    this.sfxGainNode.gain.setValueAtTime(DEFAULT_RACK_SETTINGS.sfxVolume, ctx.currentTime);
    this.sfxGainNode.connect(this.masterGain);

    // Connect Rack Chain:
    // Speech Source -> lowCut -> lowShelf -> midPeak -> highShelf -> compressor -> [Panner] -> split dry/wet
    this.lowCutFilter.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.compressor);

    if (this.panner) {
      this.compressor.connect(this.panner);
      this.panner.connect(this.dryGain);
      this.panner.connect(this.convolver);
    } else {
      this.compressor.connect(this.dryGain);
      this.compressor.connect(this.convolver);
    }

    this.convolver.connect(this.wetGain);

    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.masterGain);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Recording Bus
    if (ctx.createMediaStreamDestination) {
      this.streamDestination = ctx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDestination);
    }

    this.isInitialized = true;
    return this.analyser;
  }

  public updateRackSettings(settings: AudioRackSettings) {
    if (!this.ctx || !this.isInitialized) return;
    const t = this.ctx.currentTime;

    // EQ updates
    if (this.lowCutFilter) {
      this.lowCutFilter.frequency.setTargetAtTime(settings.lowCut ? 80 : 10, t, 0.05);
    }
    if (this.lowShelf) {
      this.lowShelf.gain.setTargetAtTime(settings.lowGain, t, 0.05);
    }
    if (this.midPeak) {
      this.midPeak.gain.setTargetAtTime(settings.midGain, t, 0.05);
    }
    if (this.highShelf) {
      this.highShelf.gain.setTargetAtTime(settings.highGain, t, 0.05);
    }

    // Compressor updates
    if (this.compressor) {
      this.compressor.threshold.setTargetAtTime(settings.compThreshold, t, 0.05);
      this.compressor.ratio.setTargetAtTime(settings.compRatio, t, 0.05);
      this.compressor.attack.setTargetAtTime(settings.compAttack, t, 0.05);
      this.compressor.release.setTargetAtTime(settings.compRelease, t, 0.05);
    }

    // Reverb wet/dry
    if (this.dryGain && this.wetGain) {
      const wet = Math.max(0, Math.min(1, settings.reverbMix));
      this.dryGain.gain.setTargetAtTime(1 - wet, t, 0.05);
      this.wetGain.gain.setTargetAtTime(wet, t, 0.05);
    }

    // Master, Ambient, and SFX volumes
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(settings.masterVolume, t, 0.05);
    }
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(settings.ambientVolume, t, 0.05);
    }
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.setTargetAtTime(settings.sfxVolume, t, 0.05);
    }
  }

  public setStereoPan(pan: number) {
    if (this.panner && this.ctx) {
      const clamped = Math.max(-1, Math.min(1, pan));
      this.panner.pan.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
  }

  public setReverbImpulse(roomType: AudioRackSettings['roomType']) {
    if (!this.ctx || !this.convolver) return;
    const rate = this.ctx.sampleRate;

    let length = rate * 0.8;
    let decay = 3.0;

    switch (roomType) {
      case 'podcast_booth':
        length = rate * 0.4;
        decay = 4.5;
        break;
      case 'athenian_hall':
        length = rate * 2.8;
        decay = 1.8;
        break;
      case 'vintage_radio':
        length = rate * 0.6;
        decay = 3.8;
        break;
      case 'cosmic_space':
        length = rate * 4.2;
        decay = 1.2;
        break;
      case 'fireside_salon':
        length = rate * 1.4;
        decay = 2.4;
        break;
    }

    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = Math.random() * 2 - 1;
      left[i] = n * Math.pow(1 - i / length, decay);
      right[i] = n * Math.pow(1 - i / length, decay);
    }

    this.convolver.buffer = impulse;
  }

  // Play an isolated, precise environmental SFX sample via Web Audio Synthesizer
  public playPunctualSFX(type: PunctualSFXType, customVol?: number) {
    const ctx = this.getAudioContext();
    this.initRack();

    const now = ctx.currentTime;
    const vol = typeof customVol === 'number' ? customVol : 1.0;

    const sfxGain = ctx.createGain();
    sfxGain.gain.setValueAtTime(vol, now);
    sfxGain.connect(this.sfxGainNode!);

    if (type === 'thunder_clap') {
      // Thunderclap: Low pitch bent rumble + noise burst
      const bufferSize = ctx.sampleRate * 2.5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(400, now);
      lowpass.frequency.exponentialRampToValueAtTime(80, now + 2.0);

      // Sub-oscillator for deep bass punch
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(90, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 1.8);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.5, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      noiseSource.connect(lowpass);
      lowpass.connect(sfxGain);

      subOsc.connect(subGain);
      subGain.connect(sfxGain);

      noiseSource.start(now);
      subOsc.start(now);
      subOsc.stop(now + 2.2);

    } else if (type === 'birds_chirp') {
      // Birds chirping: FM modulated frequency sweeps
      [0, 0.25, 0.55].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';

        const startTime = now + delay;
        const baseFreq = 2400 + idx * 300;

        osc.frequency.setValueAtTime(baseFreq, startTime);
        osc.frequency.linearRampToValueAtTime(baseFreq + 800, startTime + 0.08);
        osc.frequency.linearRampToValueAtTime(baseFreq - 400, startTime + 0.16);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
      });

    } else if (type === 'car_passing') {
      // Car Passing: Doppler-shifted bandpass noise
      const bufferSize = ctx.sampleRate * 3.0;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(2.0, now);

      // Doppler sweep: approach -> pass -> fade away
      bandpass.frequency.setValueAtTime(200, now);
      bandpass.frequency.exponentialRampToValueAtTime(800, now + 1.2);
      bandpass.frequency.exponentialRampToValueAtTime(150, now + 3.0);

      const carGain = ctx.createGain();
      carGain.gain.setValueAtTime(0.01, now);
      carGain.gain.linearRampToValueAtTime(0.35, now + 1.2);
      carGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

      noiseSource.connect(bandpass);
      bandpass.connect(carGain);
      carGain.connect(sfxGain);

      noiseSource.start(now);

    } else if (type === 'rain_shower') {
      // Rain Shower burst: filtered noise with rapid droplet modulation
      const bufferSize = ctx.sampleRate * 2.0;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(1200, now);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.05, now);
      rainGain.gain.linearRampToValueAtTime(0.25, now + 0.4);
      rainGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      noiseSource.connect(highpass);
      highpass.connect(rainGain);
      rainGain.connect(sfxGain);

      noiseSource.start(now);

    } else if (type === 'coffee_cup') {
      // Ceramic clink
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.22);

    } else if (type === 'gavel_strike') {
      // Wood impact
      const subOsc = ctx.createOscillator();
      const gain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(220, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      subOsc.connect(gain);
      gain.connect(sfxGain);
      subOsc.start(now);
      subOsc.stop(now + 0.28);

    } else if (type === 'applause') {
      // Applause chorus
      const bufferSize = ctx.sampleRate * 2.0;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const isClap = Math.random() < 0.08;
        data[i] = isClap ? (Math.random() * 2 - 1) * 0.5 : (Math.random() * 2 - 1) * 0.02;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1800, now);
      bandpass.Q.setValueAtTime(1.0, now);

      const appGain = ctx.createGain();
      appGain.gain.setValueAtTime(0.05, now);
      appGain.gain.linearRampToValueAtTime(0.3, now + 0.3);
      appGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      noiseSource.connect(bandpass);
      bandpass.connect(appGain);
      appGain.connect(sfxGain);

      noiseSource.start(now);

    } else if (type === 'feather_quill') {
      // Quill scratching on parchment: friction noise sweeps
      [0, 0.12, 0.28, 0.42].forEach((delay) => {
        const bufferSize = ctx.sampleRate * 0.12;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(3200 + Math.random() * 800, now + delay);
        bandpass.Q.setValueAtTime(3.5, now + delay);

        const qGain = ctx.createGain();
        qGain.gain.setValueAtTime(0, now + delay);
        qGain.gain.linearRampToValueAtTime(0.4, now + delay + 0.02);
        qGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

        noiseSource.connect(bandpass);
        bandpass.connect(qGain);
        qGain.connect(sfxGain);

        noiseSource.start(now + delay);
      });

    } else if (type === 'laughter_burst') {
      // Chuckle / laughter bursts
      [0, 0.12, 0.24, 0.36].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startTime = now + delay;
        const basePitch = 280 + (idx % 2 === 0 ? 50 : 0);

        osc.frequency.setValueAtTime(basePitch, startTime);
        osc.frequency.exponentialRampToValueAtTime(basePitch - 60, startTime + 0.09);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(startTime);
        osc.stop(startTime + 0.1);
      });

    } else if (type === 'gasp_sigh') {
      // Soft breath / sigh envelope
      const bufferSize = ctx.sampleRate * 0.6;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.12;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(800, now);
      lowpass.frequency.exponentialRampToValueAtTime(300, now + 0.5);

      const sighGain = ctx.createGain();
      sighGain.gain.setValueAtTime(0.01, now);
      sighGain.gain.linearRampToValueAtTime(0.3, now + 0.15);
      sighGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      noiseSource.connect(lowpass);
      lowpass.connect(sighGain);
      sighGain.connect(sfxGain);
      noiseSource.start(now);
    }
  }

  // Play a base64 encoded audio chunk through the studio engineering rack
  public playSpeechChunk(
    base64Audio: string, 
    settings: AudioRackSettings,
    speakerPan: number = 0,
    textContext: string = '',
    onEnded?: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        this.initRack();
        this.updateRackSettings(settings);
        this.setStereoPan(speakerPan);

        // Extract pure speech PCM, completely stripping any trailing C2PA metadata from Gemini 3.8 Flash TTS
        const { float32Array, sampleRate } = extractAudioFromBase64(base64Audio);

        const buffer = ctx.createBuffer(1, float32Array.length, sampleRate);
        buffer.copyToChannel(float32Array, 0);

        // Stop any previous speech source cleanly
        if (this.activeSpeechSource) {
          try { this.activeSpeechSource.stop(); } catch (e) {}
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Apply Voice Profiler Modifications
        let playbackRate = settings.pitchShift || 1.0;
        if (settings.voiceProfile === 'bionic_synth') {
          playbackRate *= 1.05;
        } else if (settings.voiceProfile === 'historical_scholar') {
          playbackRate *= 0.94;
        } else if (settings.voiceProfile === 'broadcast_warmth') {
          playbackRate *= 0.98;
        }
        source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

        // Connect to rack input (lowCutFilter)
        source.connect(this.lowCutFilter!);
        this.activeSpeechSource = source;

        // Auto-Ducking: Smoothly drop ambient volume while speech is playing
        if (settings.autoDucking && this.ambientDuckingGain) {
          this.ambientDuckingGain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.08);
          this.isSpeechActive = true;
        }

        source.onended = () => {
          this.isSpeechActive = false;
          if (this.ambientDuckingGain) {
            this.ambientDuckingGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.4);
          }
          if (onEnded) onEnded();
          resolve();
        };

        source.start();

        // Auto-Trigger SFX and Vocal Cues concurrently as speech begins
        if (textContext) {
          const lowerText = textContext.toLowerCase();
          
          if (lowerText.includes('رعد') || lowerText.includes('thunder')) {
            this.playPunctualSFX('thunder_clap', 0.9);
          }
          if (lowerText.includes('مطر') || lowerText.includes('rain')) {
            this.playPunctualSFX('rain_shower', 0.85);
          }
          if (lowerText.includes('عصافير') || lowerText.includes('طيور') || lowerText.includes('birds')) {
            this.playPunctualSFX('birds_chirp', 0.7);
          }
          if (lowerText.includes('سيارة') || lowerText.includes('محرك') || lowerText.includes('car')) {
            this.playPunctualSFX('car_passing', 0.8);
          }
          if (lowerText.includes('قهوة') || lowerText.includes('فنجان') || lowerText.includes('شاي') || lowerText.includes('coffee')) {
            this.playPunctualSFX('coffee_cup', 0.85);
          }
          if (lowerText.includes('ريشة') || lowerText.includes('ورق') || lowerText.includes('كتابة') || lowerText.includes('quill')) {
            this.playPunctualSFX('feather_quill', 0.85);
          }
          if (lowerText.includes('تصفيق') || lowerText.includes('applause')) {
            this.playPunctualSFX('applause', 0.8);
          }
          if (lowerText.includes('مطرقة') || lowerText.includes('gavel')) {
            this.playPunctualSFX('gavel_strike', 0.85);
          }
          if (lowerText.includes('ضحك') || lowerText.includes('ضحكة') || lowerText.includes('laugh')) {
            this.playPunctualSFX('laughter_burst', 0.75);
          }
          if (lowerText.includes('تنهيدة') || lowerText.includes('شهقة') || lowerText.includes('sigh') || lowerText.includes('gasp')) {
            this.playPunctualSFX('gasp_sigh', 0.7);
          }
        }
      } catch (err) {
        console.error('[PodLive Audio] Error playing speech chunk:', err);
        reject(err);
      }
    });
  }

  public stopSpeech() {
    if (this.activeSpeechSource) {
      try {
        this.activeSpeechSource.stop();
        this.activeSpeechSource.disconnect();
      } catch (e) {}
      this.activeSpeechSource = null;
    }
    this.isSpeechActive = false;
    if (this.ambientDuckingGain && this.ctx) {
      this.ambientDuckingGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.2);
    }
  }

  // Synthesize rich background soundscape & environmental textures
  public setAmbientSoundscape(type: AmbientSoundscapeType) {
    this.stopAmbient();
    this.currentAmbientMode = type;
    if (type === 'none') return;

    const ctx = this.getAudioContext();
    this.initRack();

    const now = ctx.currentTime;

    if (type === 'lofi_thought') {
      const freqs = [174.61, 220.0, 261.63, 329.63];
      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        oscGain.gain.setValueAtTime(0.06, now);

        osc.connect(oscGain);
        oscGain.connect(this.ambientGain!);
        osc.start();
        this.ambientOscs.push(osc);
      });
    } else if (type === 'cosmic_drone') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const droneGain = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(55, now);
      osc2.frequency.setValueAtTime(57.5, now);
      droneGain.gain.setValueAtTime(0.12, now);

      osc1.connect(droneGain);
      osc2.connect(droneGain);
      droneGain.connect(this.ambientGain!);
      osc1.start();
      osc2.start();
      this.ambientOscs.push(osc1, osc2);
    } else if (type === 'classical_strings') {
      const freqs = [108, 162, 216, 270];
      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const stringGain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);

        stringGain.gain.setValueAtTime(0.04, now);

        osc.connect(filter);
        filter.connect(stringGain);
        stringGain.connect(this.ambientGain!);
        osc.start();
        this.ambientOscs.push(osc);
      });
    } else if (type === 'vinyl_warmth') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const isPop = Math.random() < 0.0015;
        output[i] = isPop ? (Math.random() * 2 - 1) * 0.4 : (Math.random() * 2 - 1) * 0.015;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(1.5, now);

      const vinylGain = ctx.createGain();
      vinylGain.gain.setValueAtTime(0.2, now);

      whiteNoise.connect(filter);
      filter.connect(vinylGain);
      vinylGain.connect(this.ambientGain!);

      whiteNoise.start();
      this.ambientNoiseSource = whiteNoise;

    } else if (type === 'rain_and_thunder') {
      // Continuous Rain Soundscape
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.08;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.25, now);

      whiteNoise.connect(filter);
      filter.connect(rainGain);
      rainGain.connect(this.ambientGain!);

      whiteNoise.start();
      this.ambientNoiseSource = whiteNoise;

    } else if (type === 'forest_birds') {
      // Forest Birds ambience
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.02; // soft wind rustle
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);

      const forestGain = ctx.createGain();
      forestGain.gain.setValueAtTime(0.12, now);

      whiteNoise.connect(filter);
      filter.connect(forestGain);
      forestGain.connect(this.ambientGain!);

      whiteNoise.start();
      this.ambientNoiseSource = whiteNoise;

    } else if (type === 'city_traffic' || type === 'lyria_ai_music') {
      // City Traffic / Lyria Ambient Music Texture
      const freqs = [130.81, 164.81, 196.00, 246.94];
      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        oscGain.gain.setValueAtTime(0.05, now);

        osc.connect(oscGain);
        oscGain.connect(this.ambientGain!);
        osc.start();
        this.ambientOscs.push(osc);
      });
    }
  }

  public stopAmbient() {
    this.ambientOscs.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.ambientOscs = [];

    if (this.ambientNoiseSource) {
      try {
        this.ambientNoiseSource.stop();
        this.ambientNoiseSource.disconnect();
      } catch (e) {}
      this.ambientNoiseSource = null;
    }
    this.currentAmbientMode = 'none';
  }

  // Master Session Recording
  public startMasterRecording() {
    if (!this.streamDestination || typeof MediaRecorder === 'undefined') return;
    this.recordedChunks = [];
    try {
      const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const supportedType = typeof MediaRecorder.isTypeSupported === 'function'
        ? candidateTypes.find(t => MediaRecorder.isTypeSupported(t))
        : undefined;
      this.recordedMimeType = supportedType || 'audio/webm';
      this.mediaRecorder = supportedType
        ? new MediaRecorder(this.streamDestination.stream, { mimeType: supportedType })
        : new MediaRecorder(this.streamDestination.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(100);
    } catch (e) {
      console.warn('[PodLive Audio] MediaRecorder start notice:', e);
    }
  }

  public stopMasterRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      const mimeType = this.mediaRecorder.mimeType || this.recordedMimeType || 'audio/webm';
      this.mediaRecorder.onstop = () => {
        const fullBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];
        resolve(fullBlob);
      };
      this.mediaRecorder.stop();
    });
  }
}

export const podLiveEngine = new PodLiveAudioEngine();
