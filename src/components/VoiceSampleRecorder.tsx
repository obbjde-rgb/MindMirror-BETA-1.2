import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, RotateCcw, Upload, CheckCircle2, AlertCircle, Volume2, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface VoiceSampleRecorderProps {
  label: string;
  sublabel: string;
  statementToRead?: string;
  maxDurationSeconds?: number;
  minDurationSeconds?: number;
  file: File | null;
  onAudioReady: (file: File | null) => void;
  type: 'source' | 'consent';
}

// Helper to convert AudioBuffer to compliant 16-bit Mono WAV Blob with exact sample-rate preservation & Offline Resampling
async function convertToHighFidelityWav(buffer: AudioBuffer): Promise<Blob> {
  const targetSampleRate = 24000; // Gemini Voice Replication standard 24kHz
  let finalBuffer = buffer;

  // If native hardware recorded at 48kHz or 44.1kHz, resample using OfflineAudioContext for exact pitch & crystal-clear audio
  if (buffer.sampleRate !== targetSampleRate) {
    try {
      const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
        1,
        Math.max(1, Math.round(buffer.duration * targetSampleRate)),
        targetSampleRate
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      finalBuffer = await offlineCtx.startRendering();
    } catch (e) {
      console.warn('[WAV Resampling] OfflineAudioContext resample fallback to native rate:', e);
      finalBuffer = buffer;
    }
  }

  const numChannels = 1; // Mono for voice replication
  const sampleRate = finalBuffer.sampleRate; // Exact rate matching the PCM buffer length!
  const format = 1; // PCM
  const bitDepth = 16;
  
  // Downmix to mono if multi-channel
  const channelData = finalBuffer.numberOfChannels === 1 
    ? finalBuffer.getChannelData(0)
    : (() => {
        const ch0 = finalBuffer.getChannelData(0);
        const ch1 = finalBuffer.getChannelData(1);
        const mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          mono[i] = (ch0[i] + ch1[i]) / 2;
        }
        return mono;
      })();

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (v: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      v.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples (clamped Float32 to 16-bit Int)
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export const VoiceSampleRecorder: React.FC<VoiceSampleRecorderProps> = ({
  label,
  sublabel,
  statementToRead,
  maxDurationSeconds = 30,
  minDurationSeconds = 5,
  file,
  onAudioReady,
  type
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioWaveLevels, setAudioWaveLevels] = useState<number[]>(new Array(16).fill(10));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedStatement, setCopiedStatement] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStreams();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  // Sync external file updates
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      audioUrlRef.current = url;
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        if (audioUrlRef.current === url) audioUrlRef.current = null;
      };
    } else {
      audioUrlRef.current = null;
      setAudioUrl(null);
      setAudioDuration(null);
      setIsPlaying(false);
    }
  }, [file]);

  const cleanupStreams = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    chunksRef.current = [];
    setElapsedSeconds(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('المتصفح لا يدعم الوصول المباشر للميكروفون.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      // Set up Web Audio Analyser for live visualizer waves
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start animation loop for sound waves
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaves = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Pick 16 sample bands from frequency bins
        const step = Math.max(1, Math.floor(bufferLength / 16));
        const levels = [];
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          // Scale to percentage height (15% to 100%)
          const height = Math.max(15, Math.min(100, Math.round((val / 255) * 100)));
          levels.push(height);
        }
        setAudioWaveLevels(levels);
        animFrameRef.current = requestAnimationFrame(updateWaves);
      };
      updateWaves();

      // Start MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        try {
          // Convert to compliant high-fidelity 24kHz WAV via Web Audio decoding & resampling
          const arrayBuffer = await rawBlob.arrayBuffer();
          const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
          const wavBlob = await convertToHighFidelityWav(audioBuffer);
          decodeCtx.close();

          const finalFile = new File([wavBlob], `${type}_voice_${Date.now()}.wav`, { type: 'audio/wav' });
          onAudioReady(finalFile);
        } catch (convErr) {
          console.warn('[Audio Conversion] Falling back to direct WAV wrapper:', convErr);
          const finalFile = new File([rawBlob], `${type}_voice_${Date.now()}.wav`, { type: 'audio/wav' });
          onAudioReady(finalFile);
        }
        cleanupStreams();
      };

      recorder.start(100);
      setIsRecording(true);

      // Start elapsed timer
      let count = 0;
      timerIntervalRef.current = setInterval(() => {
        count += 1;
        setElapsedSeconds(count);
        if (count >= maxDurationSeconds) {
          stopRecording();
        }
      }, 1000);

    } catch (err: any) {
      console.error('[Voice Recorder Error]', err);
      setErrorMsg(err.name === 'NotAllowedError' 
        ? 'تم رفض إذن الوصول للميكروفون. يرجى تفعيل الإذن من إعدادات المتصفح.' 
        : `تعذر تشغيل الميكروفون: ${err.message || 'خطأ غير معروف'}`);
      cleanupStreams();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupStreams();
    setIsRecording(false);
    setElapsedSeconds(0);
    setAudioWaveLevels(new Array(16).fill(10));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setErrorMsg(null);
    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const DecodeCtx = window.AudioContext || (window as any).webkitAudioContext;
      const decodeCtx = new DecodeCtx();
      try {
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
        const wavBlob = await convertToHighFidelityWav(audioBuffer);
        const convertedFile = new File([wavBlob], `${type}_uploaded_${Date.now()}.wav`, { type: 'audio/wav' });
        onAudioReady(convertedFile);
      } finally {
        decodeCtx.close().catch(() => {});
      }
    } catch (err) {
      console.warn('[Upload WAV Normalization] Using original uploaded file:', err);
      onAudioReady(uploadedFile);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleCopyStatement = () => {
    if (!statementToRead) return;
    copyToClipboard(statementToRead);
    setCopiedStatement(true);
    setTimeout(() => setCopiedStatement(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = Math.min(100, Math.round((elapsedSeconds / maxDurationSeconds) * 100));

  return (
    <div className="bg-surface border border-border/70 rounded-xl p-3.5 space-y-3 transition-all duration-200">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
            <Volume2 size={13} className="text-accent2" />
            {label}
            {file && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <CheckCircle2 size={10} /> تم التجهيز
              </span>
            )}
          </h4>
          <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{sublabel}</p>
        </div>
      </div>

      {/* Teleprompter Box for Consent */}
      {statementToRead && (
        <div className="bg-surface2/80 border border-accent2/30 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-accent2">
            <span>نص الإقرار الصوتي المطلوب قراءته بدقة:</span>
            <button
              type="button"
              onClick={handleCopyStatement}
              className="flex items-center gap-1 text-[9px] text-muted hover:text-text cursor-pointer transition-colors"
            >
              {copiedStatement ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedStatement ? 'تم النسخ' : 'نسخ النص'}</span>
            </button>
          </div>
          <div className="bg-bg/80 border border-border/60 rounded p-2 text-[11px] font-medium text-text leading-relaxed select-all">
            "{statementToRead}"
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-2.5 text-[11px] flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. ACTIVE RECORDING STATE */}
      {isRecording && (
        <div className="bg-accent2/10 border border-accent2/40 rounded-xl p-3.5 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-red-400">جارٍ التسجيل الحي من الميكروفون...</span>
            </div>
            <div className="text-xs font-mono font-bold text-text bg-surface px-2.5 py-1 rounded-md border border-border">
              {formatSeconds(elapsedSeconds)} / {formatSeconds(maxDurationSeconds)}
            </div>
          </div>

          {/* Interactive Sound Wave Bars (Web Audio Real-Time Visualizer) */}
          <div className="bg-bg/90 rounded-lg p-3 border border-border/80 flex items-center justify-center gap-1.5 h-16">
            {audioWaveLevels.map((lvl, idx) => (
              <div
                key={idx}
                className="w-1.5 bg-gradient-to-t from-accent to-accent2 rounded-full transition-all duration-75"
                style={{
                  height: `${lvl}%`,
                  opacity: Math.max(0.3, lvl / 100)
                }}
              />
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-accent2 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Recording Controls */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={stopRecording}
              className="flex-1 bg-accent2 hover:opacity-90 text-bg text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Square size={13} fill="currentColor" />
              <span>إيقاف وحفظ العينة ({formatSeconds(elapsedSeconds)})</span>
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="bg-surface hover:bg-surface2 text-muted hover:text-text text-xs py-2 px-3 rounded-lg border border-border cursor-pointer transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* 2. RECORDED FILE PREVIEW STATE (معاينة الملف الصوتي قبل الإرسال) */}
      {!isRecording && file && audioUrl && (
        <div className="bg-surface2/60 border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onTimeUpdate={() => {
              if (audioPlayerRef.current) {
                const cur = audioPlayerRef.current.currentTime;
                const dur = audioPlayerRef.current.duration || 1;
                setPlaybackProgress((cur / dur) * 100);
              }
            }}
            onLoadedMetadata={() => {
              if (audioPlayerRef.current) {
                setAudioDuration(audioPlayerRef.current.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setPlaybackProgress(0);
            }}
          />

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-bg flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow"
                title={isPlaying ? 'إيقاف مؤقت' : 'استماع للملف'}
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="mr-0.5" fill="currentColor" />}
              </button>
              <div>
                <span className="font-bold text-text block text-[11px] truncate max-w-[170px] sm:max-w-[220px]">
                  {file.name}
                </span>
                <span className="text-[10px] text-muted font-mono">
                  {audioDuration ? formatSeconds(Math.round(audioDuration)) : 'WAV'} • {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={startRecording}
                className="p-1.5 bg-surface hover:bg-surface2 text-muted hover:text-text rounded-lg border border-border cursor-pointer text-[10px] flex items-center gap-1 transition-colors"
                title="إعادة التسجيل"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline">إعادة تسجيل</span>
              </button>
              <button
                type="button"
                onClick={() => onAudioReady(null)}
                className="p-1.5 bg-surface hover:bg-red-500/10 text-muted hover:text-red-400 rounded-lg border border-border cursor-pointer text-[10px] transition-colors"
                title="حذف الملف"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Mini Playback Progress Bar */}
          <div className="w-full bg-surface rounded-full h-1 overflow-hidden">
            <div
              className="bg-emerald-400 h-full transition-all duration-100"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>

          {audioDuration !== null && Math.round(audioDuration) < minDurationSeconds && (
            <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertCircle size={12} className="shrink-0 text-amber-400" />
              <span>
                مدة التسجيل ({Math.round(audioDuration)}ث) أقل من الموصى به ({minDurationSeconds}ث على الأقل). يُفضل إعادة التسجيل لتجنب رفض المطابقة من Google.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. IDLE / READY TO RECORD OR UPLOAD STATE */}
      {!isRecording && !file && (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          {/* Live Mic Button */}
          <button
            type="button"
            onClick={startRecording}
            className="w-full sm:flex-1 bg-gradient-to-r from-accent2/90 to-accent text-bg text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer shadow-md transition-all active:scale-[0.99]"
          >
            <Mic size={14} className="animate-pulse" />
            <span>تسجيل صوتك الآن عبر الميكروفون ({maxDurationSeconds}ث كحد أقصى)</span>
          </button>

          {/* File Upload Alternative */}
          <label className="w-full sm:w-auto bg-surface hover:bg-surface2 text-text text-xs font-medium py-2 px-3 rounded-xl border border-border flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0">
            <Upload size={13} className="text-muted" />
            <span>أو ارفع ملف WAV</span>
            <input
              type="file"
              accept="audio/wav,audio/x-wav,audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}
    </div>
  );
};
