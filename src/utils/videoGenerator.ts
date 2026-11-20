import JSZip from 'jszip';
import { keys, get } from 'idb-keyval';
import { downloadBlob, base64ToWavBlob, extractAudioFromBase64 } from './audio';
import { logger } from './logger';

export interface VideoSegmentInput {
  text: string;
  personaName?: string;
  avatarUrl?: string;
  base64Audio: string;
  role?: 'user' | 'model' | 'assistant';
}

export interface VideoExportOptions {
  title?: string;
  modeLabel?: string;
  filename?: string;
  onProgress?: (progress: number, statusText: string) => void;
}

/**
 * Decodes raw base64 audio into an AudioBuffer, cleanly stripping any C2PA metadata
 */
export const decodeBase64ToAudioBuffer = (audioCtx: AudioContext, base64: string): AudioBuffer => {
  const { float32Array, sampleRate } = extractAudioFromBase64(base64);
  const buffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
  buffer.copyToChannel(float32Array, 0);
  return buffer;
};

/**
 * Cleans raw text by removing stage directions, bracketed timestamps, markdown, and audio cues.
 */
export const sanitizeSubtitleText = (text: string): string => {
  if (!text) return '';
  return text
    // Remove bracketed instructions / timestamps / stage directions e.g. [1.10 صرير], [1.12], (ضحك)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*\)/g, ' ')
    // Remove markdown characters
    .replace(/[*#_`~=]/g, ' ')
    // Replace multiple spaces/newlines with a single space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Structured Line info with word global index tracking for precise RTL rendering & pagination
 */
interface WordInfo {
  text: string;
  globalIdx: number;
}

interface LineInfo {
  text: string;
  lineWords: WordInfo[];
}

export interface SpokenPhraseInfo {
  text: string;
  words: string[];
  weight: number;
  startProgress: number;
  endProgress: number;
}

/**
 * Splits sanitized text into natural spoken phrases (3-7 words per phrase or split by punctuation).
 */
export const splitTextIntoSpokenPhrases = (text: string): string[] => {
  const clean = sanitizeSubtitleText(text);
  if (!clean) return [];

  // Split by major punctuation marks while keeping clauses intact
  const initialClauses = clean.split(/(?<=[.!؟\n،؛:…])\s+/);
  const phrases: string[] = [];

  for (const clause of initialClauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 8) {
      phrases.push(trimmed);
    } else {
      // Break long clauses into 5-7 word chunks
      let currentChunk: string[] = [];
      for (let i = 0; i < words.length; i++) {
        currentChunk.push(words[i]);
        if (currentChunk.length >= 6 || i === words.length - 1) {
          phrases.push(currentChunk.join(' '));
          currentChunk = [];
        }
      }
    }
  }

  return phrases.length > 0 ? phrases : [clean];
};

/**
 * Maps phrases to precise time progress intervals based on word lengths and punctuation pauses
 */
export const buildSpokenPhrasesMap = (text: string): SpokenPhraseInfo[] => {
  const phraseTexts = splitTextIntoSpokenPhrases(text);
  if (phraseTexts.length === 0) return [];

  let totalWeight = 0;
  const weightedPhrases = phraseTexts.map(pText => {
    const words = pText.split(/\s+/).filter(w => w.length > 0);
    let phraseWeight = 0;
    words.forEach(w => {
      let weight = Math.max(2, w.length);
      if (/[.!؟]/.test(w)) weight += 10;
      else if (/[،,;:؛]/.test(w)) weight += 5;
      else if (/\.{2,}/.test(w)) weight += 12;
      phraseWeight += weight;
    });

    phraseWeight = Math.max(5, phraseWeight);
    totalWeight += phraseWeight;

    return {
      text: pText,
      words,
      weight: phraseWeight,
      startProgress: 0,
      endProgress: 0
    };
  });

  // Calculate normalized time progress ranges [startProgress, endProgress]
  let currentAccumulated = 0;
  return weightedPhrases.map(item => {
    const startProgress = currentAccumulated / totalWeight;
    currentAccumulated += item.weight;
    const endProgress = currentAccumulated / totalWeight;
    return {
      ...item,
      startProgress,
      endProgress: Math.min(1.0, endProgress)
    };
  });
};

/**
 * Computes an adaptive cumulative voice activity energy map for an AudioBuffer.
 * Uses a smooth linear fallback to guarantee freeze-free playback.
 */
export const buildAudioEnergyProgressMap = (audioBuffer: AudioBuffer, numSteps = 500): Float32Array => {
  const progressMap = new Float32Array(numSteps);
  for (let i = 0; i < numSteps; i++) {
    progressMap[i] = i / (numSteps - 1);
  }
  return progressMap;
};

/**
 * Renders a frame on canvas with title, persona, active single subtitle phrase, and audio visualizer
 */
const renderVideoFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segment: VideoSegmentInput,
  segmentProgress: number, // 0 to 1
  currentTime: number,
  title: string,
  modeLabel: string,
  audioData?: Float32Array,
  energyProgressMap?: Float32Array
) => {
  // Clear canvas
  ctx.save();

  // Background gradient
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width);
  bgGrad.addColorStop(0, '#0f172a'); // dark slate
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617'); // obsidian black
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Background subtle decorative animated grid / circles
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 280 + Math.sin(currentTime * 2) * 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 380 + Math.cos(currentTime * 1.5) * 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 1. Header: Mode & Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Mode badge
  ctx.fillStyle = '#4f46e5';
  const badgeWidth = 200;
  const badgeHeight = 32;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 25;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 16);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(modeLabel || 'فيديو مع الكلمات المزامنة', width / 2, badgeY + 8);

  // Main Title
  if (title) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, width / 2, badgeY + 40);
  }

  // 2. Speaker Card / Persona Badge
  const personaName = segment.personaName || (segment.role === 'user' ? 'المستخدم' : 'المساعد الذكي');
  const cardY = 100;
  const cardWidth = 520;
  const cardHeight = 65;
  const cardX = (width - cardWidth) / 2;

  // Glass card
  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.40)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 16);
  ctx.fill();
  ctx.stroke();

  // Speaker Icon / Avatar Circle
  const avatarX = cardX + cardWidth - 40;
  const avatarY = cardY + cardHeight / 2;
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 20, 0, Math.PI * 2);
  ctx.fill();

  // Speaker name
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(personaName, avatarX - 30, cardY + 22);

  // Speaker status
  ctx.fillStyle = '#38bdf8';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('جاري الحديث الآن...', avatarX - 30, cardY + 44);

  // 3. Captions / Subtitles Box: Synchronous Single Active Phrase Display
  const subBoxY = 190;
  const subBoxWidth = 1120;
  const subBoxHeight = 410;
  const subBoxX = (width - subBoxWidth) / 2;

  // Subtitle background glass box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.40)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(subBoxX, subBoxY, subBoxWidth, subBoxHeight, 24);
  ctx.fill();
  ctx.stroke();

  // Smooth linear voice progress
  const voiceProgress = Math.max(0, Math.min(1.0, segmentProgress));

  // Pre-calculate spoken phrases for this segment
  const phrases = buildSpokenPhrasesMap(segment.text);
  
  // Find current active phrase
  let activePhraseIdx = 0;
  if (phrases.length > 0) {
    for (let i = 0; i < phrases.length; i++) {
      if (voiceProgress >= phrases[i].startProgress && voiceProgress <= phrases[i].endProgress) {
        activePhraseIdx = i;
        break;
      }
      if (voiceProgress > phrases[i].endProgress) {
        activePhraseIdx = i;
      }
    }
  }

  const activePhrase = phrases[activePhraseIdx] || { text: sanitizeSubtitleText(segment.text), words: [], startProgress: 0, endProgress: 1 };
  const totalPhrases = Math.max(1, phrases.length);

  // Phrase Badge Header on Subtitle Box
  ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
  ctx.beginPath();
  ctx.roundRect(subBoxX + 30, subBoxY + 20, 180, 36, 12);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`العبارة ${activePhraseIdx + 1} من ${totalPhrases}`, subBoxX + 120, subBoxY + 38);

  // Calculate local word progress inside active phrase
  const phraseRange = Math.max(0.0001, activePhrase.endProgress - activePhrase.startProgress);
  const localProgress = Math.max(0, Math.min(1.0, (voiceProgress - activePhrase.startProgress) / phraseRange));
  const activeWordInPhraseIdx = Math.min(
    activePhrase.words.length - 1,
    Math.floor(localProgress * activePhrase.words.length)
  );

  // Wrap active phrase into lines
  ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
  const words = activePhrase.words;
  const lines: string[][] = [];
  let curLine: string[] = [];
  
  words.forEach((w) => {
    const testLine = [...curLine, w].join(' ');
    if (ctx.measureText(testLine).width > subBoxWidth - 140 && curLine.length > 0) {
      lines.push(curLine);
      curLine = [w];
    } else {
      curLine.push(w);
    }
  });
  if (curLine.length > 0) lines.push(curLine);

  // Center vertical placement
  const centerY = subBoxY + subBoxHeight / 2 + 10;
  const lineSpacing = 68;
  const startY = centerY - ((lines.length - 1) * lineSpacing) / 2;

  let wordGlobalCount = 0;
  const spaceWidth = ctx.measureText(' ').width;

  lines.forEach((lineWordsArr, lineIdx) => {
    const lineY = startY + lineIdx * lineSpacing;

    // Calculate total line width for exact RTL centering
    let totalLineWidth = 0;
    const wordWidths: number[] = [];
    lineWordsArr.forEach(w => {
      const wWidth = ctx.measureText(w).width;
      wordWidths.push(wWidth);
      totalLineWidth += wWidth;
    });
    totalLineWidth += spaceWidth * Math.max(0, lineWordsArr.length - 1);

    // Draw background pill for the active phrase line
    ctx.fillStyle = 'rgba(79, 70, 229, 0.18)';
    ctx.beginPath();
    ctx.roundRect((width - totalLineWidth) / 2 - 24, lineY - 32, totalLineWidth + 48, 64, 18);
    ctx.fill();

    // Draw words from right to left (RTL)
    let currentRightX = (width + totalLineWidth) / 2;

    lineWordsArr.forEach((w, wIdx) => {
      const wWidth = wordWidths[wIdx];
      const wLeftX = currentRightX - wWidth;
      const wCenterX = currentRightX - wWidth / 2;

      const isActive = (wordGlobalCount === activeWordInPhraseIdx);

      if (isActive) {
        // Glowing active word badge
        ctx.fillStyle = '#4f46e5';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(wLeftX - 10, lineY - 28, wWidth + 20, 56, 14);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Active word text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w, wCenterX, lineY);
      } else {
        // Inactive word text
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w, wCenterX, lineY);
      }

      wordGlobalCount++;
      currentRightX = wLeftX - spaceWidth;
    });
  });

  // 4. Audio Spectrum / Waveform Visualizer at bottom
  const waveY = height - 60;
  const numBars = 48;
  const barWidth = 14;
  const barGap = 8;
  const totalWaveWidth = numBars * (barWidth + barGap);
  const startWaveX = (width - totalWaveWidth) / 2;

  for (let i = 0; i < numBars; i++) {
    let amp = 0.15;
    if (audioData && audioData.length > 0) {
      const dataIdx = Math.floor((i / numBars) * audioData.length);
      amp = Math.abs(audioData[dataIdx] || 0) * 2.5;
    } else {
      amp = Math.sin(currentTime * 8 + i * 0.4) * 0.4 + 0.5;
    }
    amp = Math.max(0.1, Math.min(1.0, amp));

    const barHeight = Math.max(8, amp * 45);
    const x = startWaveX + i * (barWidth + barGap);
    const y = waveY - barHeight / 2;

    const barGrad = ctx.createLinearGradient(0, y, 0, y + barHeight);
    barGrad.addColorStop(0, '#38bdf8');
    barGrad.addColorStop(1, '#818cf8');

    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 6);
    ctx.fill();
  }

  // Progress bar along the very bottom
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, height - 6, width, 6);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, height - 6, width * segmentProgress, 6);

  ctx.restore();
};

/**
 * Creates and downloads an MP4/WebM Video file with embedded captions & voiceover audio
 */
export const generateSubtitledVideo = async (
  segments: VideoSegmentInput[],
  options: VideoExportOptions = {}
): Promise<Blob | null> => {
  if (!segments || segments.length === 0) {
    throw new Error('لا توجد مقاطع صوتية أو نصية للتصدير كفيديو.');
  }

  const {
    title = 'محادثة صوتية مرئية',
    modeLabel = 'صوت مع الكلمات',
    filename = `video_captions_${Date.now()}.mp4`,
    onProgress
  } = options;

  onProgress?.(5, 'تحضير البيئة الصوتية والبطاقات المرئية...');

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  // Decode all audio buffers & pre-calculate real voice energy progress maps
  const audioBuffers: AudioBuffer[] = [];
  const energyProgressMaps: Float32Array[] = [];

  for (let i = 0; i < segments.length; i++) {
    onProgress?.(
      10 + Math.floor((i / segments.length) * 20),
      `تحليل وتتبع المسار الصوتي للمقطع ${i + 1} من ${segments.length}...`
    );
    try {
      const buf = decodeBase64ToAudioBuffer(audioCtx, segments[i].base64Audio);
      audioBuffers.push(buf);
      energyProgressMaps.push(buildAudioEnergyProgressMap(buf));
    } catch (err) {
      logger.error('Failed to decode segment audio:', err);
      // Fallback empty 1 sec buffer
      const fallbackBuf = audioCtx.createBuffer(1, 24000, 24000);
      audioBuffers.push(fallbackBuf);
      energyProgressMaps.push(new Float32Array(500).map((_, idx) => idx / 499));
    }
  }

  // Set up Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('فشل إنشاء سياق الرسم المرئي Canvas.');

  // Set up MediaStreamDestination for Web Audio
  const dest = audioCtx.createMediaStreamDestination();

  // Combine Canvas video stream + Audio stream
  const canvasStream = canvas.captureStream(30); // 30 FPS
  const videoTrack = canvasStream.getVideoTracks()[0];
  const audioTrack = dest.stream.getAudioTracks()[0];

  const combinedStream = new MediaStream();
  if (videoTrack) combinedStream.addTrack(videoTrack);
  if (audioTrack) combinedStream.addTrack(audioTrack);

  // Check supported MIME type
  const mimeTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  let selectedMimeType = '';
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
  }

  if (!selectedMimeType) {
    selectedMimeType = 'video/webm';
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMimeType,
    videoBitsPerSecond: 2500000 // 2.5 Mbps crisp quality
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise<Blob | null>((resolve, reject) => {
    recorder.onstop = () => {
      audioCtx.close().catch(() => {});
      const videoBlob = new Blob(recordedChunks, { type: selectedMimeType });
      onProgress?.(100, 'تم إنشاء الفيديو بنجاح!');
      downloadBlob(videoBlob, filename.endsWith('.mp4') || filename.endsWith('.webm') ? filename : `${filename}.mp4`);
      resolve(videoBlob);
    };

    recorder.onerror = (e) => {
      audioCtx.close().catch(() => {});
      reject(new Error(`خطأ أثناء تسجيل الفيديو: ${e}`));
    };

    recorder.start(100);

    // Playback loop
    let currentSegmentIndex = 0;
    const totalSegments = segments.length;

    const playNextSegment = () => {
      if (currentSegmentIndex >= totalSegments) {
        // Finished all segments
        setTimeout(() => {
          recorder.stop();
        }, 300);
        return;
      }

      const segment = segments[currentSegmentIndex];
      const buffer = audioBuffers[currentSegmentIndex];
      const duration = buffer.duration;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      // Connect to destination stream & Analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(dest);

      const audioData = new Float32Array(analyser.frequencyBinCount);
      const startTime = audioCtx.currentTime;

      onProgress?.(
        30 + Math.floor((currentSegmentIndex / totalSegments) * 60),
        `بث وتوليد الفيديو للنص الصوتي (${currentSegmentIndex + 1}/${totalSegments})...`
      );

      const renderLoop = () => {
        const elapsed = audioCtx.currentTime - startTime;
        const progress = Math.min(1.0, elapsed / duration);

        analyser.getFloatFrequencyData(audioData);

        const energyMap = energyProgressMaps[currentSegmentIndex];

        renderVideoFrame(
          ctx,
          canvas.width,
          canvas.height,
          segment,
          progress,
          elapsed,
          title,
          modeLabel,
          audioData,
          energyMap
        );

        if (progress < 1.0) {
          requestAnimationFrame(renderLoop);
        }
      };

      source.onended = () => {
        currentSegmentIndex++;
        playNextSegment();
      };

      source.start(0);
      requestAnimationFrame(renderLoop);
    };

    playNextSegment();
  });
};

/**
 * Downloads all cached audio files stored in IndexedDB (`tts_*`) as a ZIP archive
 */
export const downloadAllCachedAudioZip = async (
  onProgress?: (progress: number, statusText: string) => void
): Promise<void> => {
  onProgress?.(10, 'البحث عن ملفات الصوت المخزنة في الكاش...');
  const allKeys = await keys();
  const ttsKeys = allKeys.filter((k: IDBValidKey) => typeof k === 'string' && k.startsWith('tts_')) as string[];

  if (ttsKeys.length === 0) {
    throw new Error('لا توجد ملفات صوتية مخزنة سابقاً في الكاش للتنزيل.');
  }

  const zip = new JSZip();
  const folder = zip.folder('audio_cache');

  for (let i = 0; i < ttsKeys.length; i++) {
    const key = ttsKeys[i];
    onProgress?.(
      15 + Math.floor((i / ttsKeys.length) * 70),
      `تجميع الملف الصوتي ${i + 1} من ${ttsKeys.length}...`
    );
    try {
      const base64Data = await get<string>(key);
      if (base64Data) {
        const wavBlob = base64ToWavBlob([base64Data]);
        if (wavBlob) {
          const cleanName = key.replace(/[^a-zA-Z0-9_]/g, '_');
          folder?.file(`${cleanName}.wav`, wavBlob);
        }
      }
    } catch (err) {
      logger.warn(`Failed to package key ${key} into ZIP`, err);
    }
  }

  onProgress?.(90, 'ضغط ملفات الصوت إلى أرشيف ZIP...');
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `all_cached_audios_${Date.now()}.zip`);
  onProgress?.(100, 'تم تحميل جميع الملفات الصوتية بنجاح!');
};
