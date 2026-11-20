import { logger } from './logger';

// Inline Web Audio API AudioWorkletProcessor script for ultra-low latency real-time PCM audio streaming
// Buffers 128-sample hardware quanta into ~40ms packets (~25fps instead of 375fps) to avoid main-thread & WS congestion
const WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetSize = Math.max(1024, Math.round(sampleRate * 0.04));
    this._buffer = new Float32Array(this._targetSize);
    this._offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        let i = 0;
        while (i < channelData.length) {
          const space = this._targetSize - this._offset;
          const toCopy = Math.min(space, channelData.length - i);
          this._buffer.set(channelData.subarray(i, i + toCopy), this._offset);
          this._offset += toCopy;
          i += toCopy;

          if (this._offset >= this._targetSize) {
            const packet = new Float32Array(this._buffer);
            this.port.postMessage(packet, [packet.buffer]);
            this._offset = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

/**
 * Creates an AudioWorkletNode for the given AudioContext with automatic fallback detection.
 */
export async function createAudioWorkletNode(
  audioCtx: AudioContext,
  onAudioData: (channelData: Float32Array) => void
): Promise<AudioNode | null> {
  try {
    if (audioCtx.audioWorklet && typeof audioCtx.audioWorklet.addModule === 'function') {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');
      workletNode.port.onmessage = (event) => {
        if (event.data && event.data instanceof Float32Array) {
          onAudioData(event.data);
        }
      };
      logger.info("High-performance AudioWorklet processor successfully initialized.");
      return workletNode;
    }
  } catch (err) {
    logger.warn("AudioWorklet module initialization fallback to ScriptProcessor:", err);
  }
  return null;
}
