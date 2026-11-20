import React, { useEffect, useRef } from 'react';
import { PersonaData } from '../types';
import { getTtsLipSyncSnapshot, TtsLipSyncSnapshot } from '../utils/audio';

export interface PersonaHologramTraits {
  hairStyle: 'bald_dome' | 'wild_halo' | 'long_wavy' | 'short_modern' | 'curly_roman' | 'receding_side_tufts' | 'parted_classic';
  beardStyle: 'none' | 'short_goatee' | 'trimmed_pointed' | 'curly_full' | 'long_flowing';
  mustacheStyle: 'none' | 'walrus' | 'bushy' | 'trimmed' | 'connected_beard';
  glasses: 'none' | 'round_wire' | 'rectangular';
  headwear: 'none' | 'turban' | 'renaissance_cap' | 'philosopher_hood';
  attire: 'toga' | 'turtleneck' | 'suit_collar' | 'scholar_robe' | 'renaissance_coat';
  noseStyle: 'snub_broad' | 'aquiline' | 'straight_classic' | 'moderate';
  browStyle: 'furrowed_heavy' | 'arched_sage' | 'focused_modern' | 'calm_stoic';
  ageLines: number;
  faceWidthRatio: number;
  jawWidthRatio: number;
}

export interface PortraitLandmarkMeta {
  faceCenterX: number;
  faceCenterY: number;
  faceRadius: number;
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  mouthLeft: { x: number; y: number };
  mouthRight: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  chinY: number;
  depictionType: 'sculpture' | 'painting' | 'archival_photo' | 'modern_photo';
  depictionLabelAr: string;
  traits?: PersonaHologramTraits;
}

export type HologramRenderMode = 'hologram' | 'hybrid';

interface HolographicAvatarCanvasProps {
  personaName: string;
  personaData?: PersonaData;
  isSpeaking: boolean;
  isThinking: boolean;
  isListening: boolean;
  userMicLevel?: number;
  renderMode?: HologramRenderMode;
  className?: string;
  onTelemetryFrame?: (snapshot: TtsLipSyncSnapshot) => void;
  onMetaLoaded?: (meta: PortraitLandmarkMeta) => void;
}

const DEFAULT_TRAITS: PersonaHologramTraits = {
  hairStyle: 'parted_classic',
  beardStyle: 'none',
  mustacheStyle: 'none',
  glasses: 'none',
  headwear: 'none',
  attire: 'suit_collar',
  noseStyle: 'moderate',
  browStyle: 'calm_stoic',
  ageLines: 0.45,
  faceWidthRatio: 1.0,
  jawWidthRatio: 0.95,
};

const LOCAL_CURATED_TRAITS: Record<string, PersonaHologramTraits> = {
  'سقراط': {
    hairStyle: 'bald_dome',
    beardStyle: 'curly_full',
    mustacheStyle: 'connected_beard',
    glasses: 'none',
    headwear: 'none',
    attire: 'toga',
    noseStyle: 'snub_broad',
    browStyle: 'furrowed_heavy',
    ageLines: 0.85,
    faceWidthRatio: 1.08,
    jawWidthRatio: 1.04,
  },
  'ليوناردو دا فينشي': {
    hairStyle: 'long_wavy',
    beardStyle: 'long_flowing',
    mustacheStyle: 'connected_beard',
    glasses: 'none',
    headwear: 'renaissance_cap',
    attire: 'renaissance_coat',
    noseStyle: 'aquiline',
    browStyle: 'arched_sage',
    ageLines: 0.88,
    faceWidthRatio: 0.96,
    jawWidthRatio: 0.9,
  },
  'ألبرت آينشتاين': {
    hairStyle: 'wild_halo',
    beardStyle: 'none',
    mustacheStyle: 'bushy',
    glasses: 'none',
    headwear: 'none',
    attire: 'suit_collar',
    noseStyle: 'moderate',
    browStyle: 'furrowed_heavy',
    ageLines: 0.82,
    faceWidthRatio: 1.02,
    jawWidthRatio: 0.94,
  },
  'ستيف جوبز': {
    hairStyle: 'receding_side_tufts',
    beardStyle: 'short_goatee',
    mustacheStyle: 'trimmed',
    glasses: 'round_wire',
    headwear: 'none',
    attire: 'turtleneck',
    noseStyle: 'straight_classic',
    browStyle: 'focused_modern',
    ageLines: 0.45,
    faceWidthRatio: 0.92,
    jawWidthRatio: 0.88,
  },
  'إيلون ماسك': {
    hairStyle: 'short_modern',
    beardStyle: 'none',
    mustacheStyle: 'none',
    glasses: 'none',
    headwear: 'none',
    attire: 'suit_collar',
    noseStyle: 'moderate',
    browStyle: 'focused_modern',
    ageLines: 0.25,
    faceWidthRatio: 1.05,
    jawWidthRatio: 1.06,
  },
  'نيتشه': {
    hairStyle: 'parted_classic',
    beardStyle: 'none',
    mustacheStyle: 'walrus',
    glasses: 'none',
    headwear: 'none',
    attire: 'suit_collar',
    noseStyle: 'moderate',
    browStyle: 'furrowed_heavy',
    ageLines: 0.55,
    faceWidthRatio: 0.98,
    jawWidthRatio: 0.96,
  },
  'فريدريك نيتشه': {
    hairStyle: 'parted_classic',
    beardStyle: 'none',
    mustacheStyle: 'walrus',
    glasses: 'none',
    headwear: 'none',
    attire: 'suit_collar',
    noseStyle: 'moderate',
    browStyle: 'furrowed_heavy',
    ageLines: 0.55,
    faceWidthRatio: 0.98,
    jawWidthRatio: 0.96,
  },
  'ابن خلدون': {
    hairStyle: 'parted_classic',
    beardStyle: 'trimmed_pointed',
    mustacheStyle: 'trimmed',
    glasses: 'none',
    headwear: 'turban',
    attire: 'scholar_robe',
    noseStyle: 'aquiline',
    browStyle: 'arched_sage',
    ageLines: 0.62,
    faceWidthRatio: 0.97,
    jawWidthRatio: 0.9,
  },
  'نوام تشومسكي': {
    hairStyle: 'receding_side_tufts',
    beardStyle: 'none',
    mustacheStyle: 'none',
    glasses: 'rectangular',
    headwear: 'none',
    attire: 'suit_collar',
    noseStyle: 'moderate',
    browStyle: 'arched_sage',
    ageLines: 0.85,
    faceWidthRatio: 1.0,
    jawWidthRatio: 0.92,
  },
  'ماركوس أوريليوس': {
    hairStyle: 'curly_roman',
    beardStyle: 'curly_full',
    mustacheStyle: 'connected_beard',
    glasses: 'none',
    headwear: 'none',
    attire: 'toga',
    noseStyle: 'straight_classic',
    browStyle: 'calm_stoic',
    ageLines: 0.52,
    faceWidthRatio: 1.0,
    jawWidthRatio: 0.98,
  },
  'سينيكا': {
    hairStyle: 'receding_side_tufts',
    beardStyle: 'none',
    mustacheStyle: 'none',
    glasses: 'none',
    headwear: 'none',
    attire: 'toga',
    noseStyle: 'aquiline',
    browStyle: 'furrowed_heavy',
    ageLines: 0.86,
    faceWidthRatio: 0.93,
    jawWidthRatio: 0.84,
  },
  'إبكتيتوس': {
    hairStyle: 'parted_classic',
    beardStyle: 'long_flowing',
    mustacheStyle: 'connected_beard',
    glasses: 'none',
    headwear: 'philosopher_hood',
    attire: 'toga',
    noseStyle: 'straight_classic',
    browStyle: 'furrowed_heavy',
    ageLines: 0.78,
    faceWidthRatio: 0.98,
    jawWidthRatio: 0.92,
  },
};

function getInitialTraitsForName(name: string): PersonaHologramTraits {
  const clean = (name || 'سقراط').trim();
  if (LOCAL_CURATED_TRAITS[clean]) return LOCAL_CURATED_TRAITS[clean];
  const alt = clean.replace(/[أإآ]/g, 'ا');
  const found = Object.entries(LOCAL_CURATED_TRAITS).find(([k]) => k.replace(/[أإآ]/g, 'ا') === alt);
  return found?.[1] || DEFAULT_TRAITS;
}

const metaCache = new Map<string, PortraitLandmarkMeta>();

function hexToRgb(hex?: string): { r: number; g: number; b: number } {
  const clean = (hex || '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return { r: 6, g: 182, b: 212 };
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export const HolographicAvatarCanvas: React.FC<HolographicAvatarCanvasProps> = ({
  personaName,
  personaData,
  isSpeaking,
  isThinking,
  isListening,
  userMicLevel = 0,
  renderMode = 'hologram',
  className = '',
  onTelemetryFrame,
  onMetaLoaded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const traitsRef = useRef<PersonaHologramTraits>(getInitialTraitsForName(personaName));

  const stateRef = useRef({
    personaName,
    personaData,
    isSpeaking,
    isThinking,
    isListening,
    userMicLevel,
    renderMode,
    onTelemetryFrame,
    onMetaLoaded,
  });

  stateRef.current = {
    personaName,
    personaData,
    isSpeaking,
    isThinking,
    isListening,
    userMicLevel,
    renderMode,
    onTelemetryFrame,
    onMetaLoaded,
  };

  const pointerRef = useRef({ targetX: 0, targetY: 0, curX: 0, curY: 0 });

  useEffect(() => {
    let cancelled = false;
    const cleanName = (personaName || 'سقراط').trim();
    traitsRef.current = getInitialTraitsForName(cleanName);

    const cached = metaCache.get(cleanName);
    if (cached) {
      if (cached.traits) traitsRef.current = cached.traits;
      stateRef.current.onMetaLoaded?.(cached);
      return;
    }

    fetch(`/api/persona-portrait-meta?name=${encodeURIComponent(cleanName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((meta: PortraitLandmarkMeta | null) => {
        if (cancelled || !meta) return;
        metaCache.set(cleanName, meta);
        if (meta.traits) {
          traitsRef.current = meta.traits;
        }
        stateRef.current.onMetaLoaded?.(meta);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [personaName]);

  // Smooth 60fps Volumetric 3D Sculpted Holographic Character Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 480;
    let height = 480;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);

    const particles = Array.from({ length: 44 }, (_, i) => ({
      angle: (i / 44) * Math.PI * 2 + (i % 5) * 0.27,
      radius: 0.22 + ((i * 19) % 100) / 145,
      y: ((i * 37) % 100) / 100,
      speed: 0.14 + ((i * 13) % 10) * 0.025,
      size: 0.9 + (i % 3) * 0.55,
      alpha: 0.22 + (i % 4) * 0.12,
    }));

    let curOpen = 0;
    let curWide = 0;
    let curRound = 0;
    let curTeeth = 0;
    let curEnergy = 0;
    let curYaw = 0;
    let curPitch = 0;
    let curRoll = 0;
    let curBrowLift = 0;
    let nextBlinkTime = performance.now() + 2200;
    let blinkProgress = 0;
    let lastTelemetryPush = 0;
    let lastTime = performance.now();
    let animId = 0;

    const renderFrame = (now: number) => {
      animId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      const s = stateRef.current;
      const traits = traitsRef.current;
      const snap = getTtsLipSyncSnapshot();
      const speakingActive = s.isSpeaking || snap.isActive;

      if (s.onTelemetryFrame && now - lastTelemetryPush > 80) {
        lastTelemetryPush = now;
        s.onTelemetryFrame(snap);
      }

      const targetOpen = speakingActive ? snap.openness : 0;
      const targetWide = speakingActive ? snap.wide : 0;
      const targetRound = speakingActive ? snap.round : 0;
      const targetTeeth = speakingActive ? snap.teeth : 0;
      const targetEnergy = speakingActive ? snap.energy : 0;

      const openSpeed = targetOpen > curOpen ? 32 : 20;
      curOpen += (targetOpen - curOpen) * Math.min(1, dt * openSpeed);
      curWide += (targetWide - curWide) * Math.min(1, dt * 16);
      curRound += (targetRound - curRound) * Math.min(1, dt * 16);
      curTeeth += (targetTeeth - curTeeth) * Math.min(1, dt * 20);
      curEnergy += (targetEnergy - curEnergy) * Math.min(1, dt * 16);

      if (now >= nextBlinkTime && blinkProgress === 0) {
        blinkProgress = 0.001;
      }
      let eyeOpenness = 1;
      if (blinkProgress > 0) {
        blinkProgress += dt / 0.16;
        if (blinkProgress >= 1) {
          blinkProgress = 0;
          nextBlinkTime = now + 2400 + ((now * 17) % 3200);
          eyeOpenness = 1;
        } else {
          eyeOpenness = Math.abs(Math.cos(blinkProgress * Math.PI));
        }
      }

      const ptr = pointerRef.current;
      ptr.curX += (ptr.targetX - ptr.curX) * Math.min(1, dt * 6);
      ptr.curY += (ptr.targetY - ptr.curY) * Math.min(1, dt * 6);

      const t = now * 0.001;
      const motionScale = prefersReducedMotion ? 0.15 : 1.0;

      // Living 3D head orientation (smooth breathing idle sweep + pointer gaze + lively speech emphasis)
      let targetYaw = ptr.curX * 0.22 * motionScale + Math.sin(t * 0.7) * 0.08 * motionScale;
      let targetPitch = ptr.curY * 0.13 * motionScale + Math.sin(t * 0.95) * 0.03 * motionScale;
      let targetRoll = Math.sin(t * 0.5) * 0.025 * motionScale;
      let targetBrow = Math.sin(t * 0.8) * 0.1;

      if (s.isThinking) {
        targetYaw += 0.16 * motionScale;
        targetPitch -= 0.09 * motionScale;
        targetRoll += 0.04 * motionScale;
        targetBrow = 0.65;
      } else if (speakingActive) {
        targetPitch += (curEnergy * 0.1 + Math.sin(t * 3.8) * 0.045 * (0.4 + curEnergy)) * motionScale;
        targetYaw += Math.sin(t * 1.8) * 0.11 * (0.4 + curEnergy) * motionScale;
        targetRoll += Math.cos(t * 1.4) * 0.04 * curEnergy * motionScale;
        targetBrow = curEnergy * 0.75 + Math.sin(t * 4.5) * 0.25 * curEnergy;
      } else if (s.isListening) {
        targetPitch -= 0.05 * motionScale;
        targetRoll -= 0.045 * motionScale;
        targetBrow = 0.35;
      }

      curYaw += (targetYaw - curYaw) * Math.min(1, dt * 6);
      curPitch += (targetPitch - curPitch) * Math.min(1, dt * 6);
      curRoll += (targetRoll - curRoll) * Math.min(1, dt * 6);
      curBrowLift += (targetBrow - curBrowLift) * Math.min(1, dt * 8);

      const personaRgb = hexToRgb(s.personaData?.color);
      const baseHolo = s.renderMode === 'hybrid'
        ? { r: 245, g: 184, b: 86 }   // Warm golden amber hologram option
        : { r: 34, g: 211, b: 238 };  // Classic futuristic cyan hologram
      const primary = s.renderMode === 'hybrid'
        ? mixRgb(baseHolo, personaRgb, 0.22)
        : mixRgb(baseHolo, personaRgb, 0.34);
      const brightCore = mixRgb(primary, { r: 232, g: 252, b: 255 }, 0.74);
      const deepShadow = mixRgb(primary, { r: 6, g: 20, b: 36 }, 0.86);
      const midTone = mixRgb(primary, { r: 14, g: 72, b: 105 }, 0.45);

      const rgba = (c: { r: number; g: number; b: number }, a: number) =>
        `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Deep Obsidian Optical Projection Chamber
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.44,
        12,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.74
      );
      bgGrad.addColorStop(0, rgba(primary, 0.17 + curEnergy * 0.12));
      bgGrad.addColorStop(0.5, 'rgba(6, 11, 20, 0.96)');
      bgGrad.addColorStop(1, '#04060B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = rgba(primary, 0.055);
      ctx.lineWidth = 1;
      const gridStep = 34;
      for (let gx = (width * 0.5) % gridStep; gx < width; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = (height * 0.5) % gridStep; gy < height; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      const unit = Math.min(width, height);
      const centerX = width * 0.5;
      const emitterY = height * 0.895;
      const sc = unit / 390; // base scale

      // 2. Hologram Emitter Projector Rings & Volumetric Cone Beam
      const micBoost = s.isListening ? Math.min(1, (s.userMicLevel || 0) / 100) : 0;
      const beamStrength = 0.26 + curEnergy * 0.34 + micBoost * 0.24 + (s.isThinking ? 0.16 : 0);

      const coneGrad = ctx.createLinearGradient(centerX, emitterY, centerX, height * 0.05);
      coneGrad.addColorStop(0, rgba(primary, beamStrength * 0.95));
      coneGrad.addColorStop(0.52, rgba(primary, beamStrength * 0.22));
      coneGrad.addColorStop(1, rgba(primary, 0));

      ctx.beginPath();
      ctx.moveTo(centerX - unit * 0.19, emitterY);
      ctx.lineTo(centerX - unit * 0.43, height * 0.05);
      ctx.lineTo(centerX + unit * 0.43, height * 0.05);
      ctx.lineTo(centerX + unit * 0.19, emitterY);
      ctx.closePath();
      ctx.fillStyle = coneGrad;
      ctx.fill();

      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const radX = unit * (0.145 + rIdx * 0.072 + curEnergy * 0.015 * (rIdx + 1));
        const radY = radX * 0.21;
        ctx.beginPath();
        ctx.ellipse(centerX, emitterY, radX, radY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(brightCore, 0.58 - rIdx * 0.15 + curEnergy * 0.24);
        ctx.lineWidth = rIdx === 0 ? 1.9 : 1.0;
        ctx.stroke();
      }

      const ringAngle = t * (s.isThinking ? 2.6 : speakingActive ? 1.7 : 0.55) * motionScale;
      ctx.beginPath();
      ctx.ellipse(centerX, emitterY, unit * 0.255, unit * 0.052, 0, ringAngle, ringAngle + Math.PI * 0.78);
      ctx.strokeStyle = rgba(brightCore, 0.8);
      ctx.lineWidth = 2.1;
      ctx.stroke();

      for (const p of particles) {
        p.y -= dt * p.speed * (0.65 + curEnergy * 1.55 + micBoost * 0.85) * motionScale;
        if (p.y < 0.06) p.y = 0.88;
        const spread = 0.18 + (0.88 - p.y) * 0.36;
        const px = centerX + Math.cos(p.angle + t * 0.35 * motionScale) * unit * p.radius * spread;
        const py = height * p.y;
        const fade = Math.sin(((0.88 - p.y) / 0.82) * Math.PI);
        ctx.fillStyle = rgba(brightCore, p.alpha * Math.max(0, fade) * (0.7 + curEnergy * 0.65));
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Living 3D Volumetric Character Hologram Sculpted to Persona Morphology
      const hoverY = Math.sin(t * 1.75) * 4.2 * sc * motionScale;
      const breath = Math.sin(t * 2.2) * 1.5 * sc * motionScale;
      const headCx = centerX + curYaw * 24 * sc;
      const headCy = height * 0.41 + hoverY + curPitch * 14 * sc;

      // Key anatomical 3D offsets with real depth parallax!
      const pShiftX = Math.sin(curYaw) * 20 * sc;
      const pShiftY = Math.sin(curPitch) * 12 * sc;
      const backShiftX = -pShiftX * 0.55;
      const backShiftY = -pShiftY * 0.45;

      const headRx = 68 * traits.faceWidthRatio * sc;
      const headRyTop = 76 * sc;
      const jawDrop = curOpen * 23 * sc; // Big crisp natural jaw articulation!
      const chinY = headCy + 82 * sc + jawDrop;
      const jawHalfW = 46 * traits.jawWidthRatio * sc;

      // Helper for 3D volumetric glass gradient
      const makeHoloGrad = (cx: number, cy: number, r: number, alphaCore = 0.42) => {
        const g = ctx.createRadialGradient(
          cx + pShiftX * 0.5,
          cy - r * 0.25 + pShiftY * 0.5,
          r * 0.08,
          cx,
          cy,
          r
        );
        g.addColorStop(0, rgba(brightCore, alphaCore + curEnergy * 0.14));
        g.addColorStop(0.55, rgba(midTone, alphaCore * 0.72));
        g.addColorStop(1, rgba(deepShadow, 0.78));
        return g;
      };

      // 3a. Volumetric Shoulders & Character-Specific Draped Attire
      const shY = height * 0.72 + hoverY * 0.45 + breath;
      ctx.save();
      ctx.translate(centerX + pShiftX * 0.2, 0);

      // Shoulders silhouette curving smoothly down toward emitter rings
      ctx.beginPath();
      ctx.moveTo(-125 * sc, shY + 62 * sc);
      ctx.quadraticCurveTo(-116 * sc, shY - 12 * sc, -42 * sc, headCy + 76 * sc);
      ctx.lineTo(42 * sc, headCy + 76 * sc);
      ctx.quadraticCurveTo(116 * sc, shY - 12 * sc, 125 * sc, shY + 62 * sc);
      ctx.quadraticCurveTo(0, shY + 86 * sc, -125 * sc, shY + 62 * sc);
      ctx.closePath();

      const bustGrad = ctx.createLinearGradient(0, headCy + 65 * sc, 0, shY + 75 * sc);
      bustGrad.addColorStop(0, rgba(midTone, 0.55));
      bustGrad.addColorStop(0.65, rgba(primary, 0.24));
      bustGrad.addColorStop(1, rgba(primary, 0));
      ctx.fillStyle = bustGrad;
      ctx.fill();

      ctx.strokeStyle = rgba(brightCore, 0.52);
      ctx.lineWidth = 1.4 * sc;
      ctx.stroke();

      // Attire-specific neck & collar architectural contours
      ctx.strokeStyle = rgba(brightCore, 0.65);
      ctx.lineWidth = 1.5 * sc;
      if (traits.attire === 'turtleneck') {
        // Steve Jobs iconic high minimalist turtleneck cylinder
        ctx.beginPath();
        ctx.roundRect(-34 * sc, headCy + 66 * sc, 68 * sc, 34 * sc, 10 * sc);
        ctx.fillStyle = rgba(deepShadow, 0.65);
        ctx.fill();
        ctx.stroke();
        // Horizontal turtleneck ribbing lines
        ctx.strokeStyle = rgba(primary, 0.45);
        ctx.lineWidth = 1 * sc;
        for (let ri = 0; ri < 3; ri++) {
          const ry = headCy + (74 + ri * 8) * sc;
          ctx.beginPath();
          ctx.moveTo(-31 * sc, ry);
          ctx.quadraticCurveTo(0, ry + 3 * sc, 31 * sc, ry);
          ctx.stroke();
        }
      } else if (traits.attire === 'toga' || traits.attire === 'scholar_robe') {
        // Draped Greco-Roman toga / scholar robe folds across chest
        for (let fi = 0; fi < 4; fi++) {
          ctx.beginPath();
          ctx.moveTo((-58 + fi * 14) * sc, headCy + (84 + fi * 6) * sc);
          ctx.quadraticCurveTo((fi * 10 - 6) * sc, shY + (22 + fi * 9) * sc, (78 - fi * 12) * sc, headCy + (92 + fi * 8) * sc);
          ctx.strokeStyle = rgba(brightCore, 0.55 - fi * 0.1);
          ctx.lineWidth = (1.6 - fi * 0.22) * sc;
          ctx.stroke();
        }
      } else {
        // Structured jacket lapels & V-neck collar (Einstein, Musk, Nietzsche, Chomsky, Da Vinci)
        ctx.beginPath();
        ctx.moveTo(-42 * sc, headCy + 78 * sc);
        ctx.lineTo(-14 * sc, shY + 28 * sc);
        ctx.lineTo(-56 * sc, shY + 12 * sc);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(42 * sc, headCy + 78 * sc);
        ctx.lineTo(14 * sc, shY + 28 * sc);
        ctx.lineTo(56 * sc, shY + 12 * sc);
        ctx.stroke();
        // Inner shirt collar V
        ctx.beginPath();
        ctx.moveTo(-24 * sc, headCy + 82 * sc);
        ctx.lineTo(0, shY + 14 * sc);
        ctx.lineTo(24 * sc, headCy + 82 * sc);
        ctx.strokeStyle = rgba(brightCore, 0.45);
        ctx.stroke();
      }
      ctx.restore();

      // 3b. Back Hair / Philosopher Hood (parallax shifts opposite front face)
      ctx.save();
      ctx.translate(headCx + backShiftX, headCy + backShiftY);
      ctx.rotate(curRoll * 0.8);

      if (traits.hairStyle === 'wild_halo') {
        // Einstein's unmistakable electrified halo of fluffy white hair
        const tufts = 13;
        ctx.beginPath();
        for (let i = 0; i <= tufts; i++) {
          const ang = Math.PI * 1.06 + (i / tufts) * Math.PI * 0.88;
          const bump = (i % 2 === 0 ? 1 : 0.84) * (1.28 + 0.08 * Math.sin(t * 2 + i));
          const x = Math.cos(ang) * headRx * bump;
          const y = Math.sin(ang) * headRyTop * bump - 10 * sc;
          if (i === 0) ctx.moveTo(x, y);
          else {
            const pAng = Math.PI * 1.06 + ((i - 0.5) / tufts) * Math.PI * 0.88;
            const cx = Math.cos(pAng) * headRx * 1.42;
            const cy = Math.sin(pAng) * headRyTop * 1.38 - 12 * sc;
            ctx.quadraticCurveTo(cx, cy, x, y);
          }
        }
        ctx.closePath();
        ctx.fillStyle = rgba(midTone, 0.42);
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.72);
        ctx.lineWidth = 1.5 * sc;
        ctx.stroke();
      } else if (traits.hairStyle === 'long_wavy') {
        // Da Vinci's flowing Renaissance shoulder locks
        for (const side of [-1, 1]) {
          for (let lock = 0; lock < 3; lock++) {
            const xOff = side * (headRx * (0.94 + lock * 0.09));
            ctx.beginPath();
            ctx.moveTo(side * headRx * 0.72, -32 * sc);
            ctx.bezierCurveTo(
              xOff + side * 18 * sc,
              15 * sc,
              xOff - side * 8 * sc,
              64 * sc,
              xOff + side * 12 * sc,
              96 * sc
            );
            ctx.strokeStyle = rgba(brightCore, 0.7 - lock * 0.14);
            ctx.lineWidth = (2.1 - lock * 0.35) * sc;
            ctx.stroke();
          }
        }
      } else if (traits.headwear === 'philosopher_hood') {
        // Epictetus philosopher hood frame
        ctx.beginPath();
        ctx.moveTo(-headRx * 1.24, 72 * sc);
        ctx.bezierCurveTo(-headRx * 1.32, -55 * sc, -headRx * 0.7, -headRyTop * 1.28, 0, -headRyTop * 1.28);
        ctx.bezierCurveTo(headRx * 0.7, -headRyTop * 1.28, headRx * 1.32, -55 * sc, headRx * 1.24, 72 * sc);
        ctx.strokeStyle = rgba(brightCore, 0.75);
        ctx.lineWidth = 2.0 * sc;
        ctx.stroke();
      }
      ctx.restore();

      // 3c. Sculpted 3D Head Shell & Holographic Surface Topology Contours (Jaw Opens Physically!)
      ctx.save();
      ctx.translate(headCx, headCy);
      ctx.rotate(curRoll);

      const relChinY = chinY - headCy;
      const headOffsetX = pShiftX * 0.12;

      ctx.beginPath();
      ctx.moveTo(-headRx + headOffsetX, -14 * sc);
      ctx.bezierCurveTo(
        -headRx * 1.02 + headOffsetX,
        -headRyTop * 1.12,
        headRx * 1.02 + headOffsetX,
        -headRyTop * 1.12,
        headRx + headOffsetX,
        -14 * sc
      );
      // Side cheeks tapering cleanly down to articulated lower jaw
      ctx.bezierCurveTo(
        headRx * 0.96,
        36 * sc,
        jawHalfW * 1.06 + pShiftX * 0.35,
        relChinY * 0.76,
        pShiftX * 0.4,
        relChinY
      );
      ctx.bezierCurveTo(
        -jawHalfW * 1.06 + pShiftX * 0.35,
        relChinY * 0.76,
        -headRx * 0.96,
        36 * sc,
        -headRx + headOffsetX,
        -14 * sc
      );
      ctx.closePath();

      ctx.fillStyle = makeHoloGrad(0, 0, Math.max(headRx, headRyTop) * 1.35, 0.46);
      ctx.fill();

      // Crisp Holographic Fresnel Rim around the head
      ctx.shadowColor = rgba(primary, 0.85);
      ctx.shadowBlur = 12 * sc;
      ctx.strokeStyle = rgba(brightCore, 0.85);
      ctx.lineWidth = 1.9 * sc;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Clipped 3D Holographic Topology Contours inside head (genuine curved mesh ribs curving with 3D yaw!)
      ctx.save();
      ctx.clip();

      // Vertical 3D meridian ribs shifting by sin(curYaw) to create unmistakable 3D sphere/face curvature!
      ctx.strokeStyle = rgba(brightCore, 0.16 + curEnergy * 0.08);
      ctx.lineWidth = 0.85 * sc;
      for (let m = -3; m <= 3; m++) {
        const frac = m / 3.5;
        const arcPeak = frac * headRx * 0.85 + pShiftX * (1 - Math.abs(frac) * 0.45);
        ctx.beginPath();
        ctx.moveTo(frac * headRx * 0.35, -headRyTop);
        ctx.quadraticCurveTo(arcPeak * 1.15, 0, frac * jawHalfW * 0.55 + pShiftX * 0.3, relChinY);
        ctx.stroke();
      }
      // Horizontal curved 3D latitude ribs shifting by curPitch
      for (let l = -3; l <= 3; l++) {
        const ly = l * 22 * sc;
        const yAdj = ly > 28 * sc ? ly + jawDrop * 0.65 : ly;
        ctx.beginPath();
        ctx.moveTo(-headRx * 1.1, yAdj - 5 * sc);
        ctx.quadraticCurveTo(pShiftX * 0.7, yAdj + pShiftY * 0.7 + 7 * sc, headRx * 1.1, yAdj - 5 * sc);
        ctx.stroke();
      }

      // Forehead wisdom furrows & cheekbone/nasolabial contours scaled by traits.ageLines
      if (traits.ageLines > 0.4) {
        ctx.strokeStyle = rgba(brightCore, 0.32 * traits.ageLines);
        ctx.lineWidth = 1.05 * sc;
        const lineCount = traits.ageLines > 0.72 ? 3 : 2;
        for (let fi = 0; fi < lineCount; fi++) {
          const fy = (-42 + fi * 7.5) * sc - curBrowLift * 3 * sc;
          ctx.beginPath();
          ctx.moveTo(-30 * sc + pShiftX * 0.65, fy + 2 * sc);
          ctx.quadraticCurveTo(pShiftX * 0.75, fy - 2.5 * sc, 30 * sc + pShiftX * 0.65, fy + 2 * sc);
          ctx.stroke();
        }
        // Subtle nasolabial & cheek hollows
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * 16 * sc + pShiftX * 0.8, 12 * sc);
          ctx.quadraticCurveTo(side * 28 * sc + pShiftX * 0.75, 28 * sc, side * 23 * sc + pShiftX * 0.7, 44 * sc);
          ctx.strokeStyle = rgba(brightCore, 0.24 * traits.ageLines);
          ctx.stroke();
        }
      }

      // Vertical holographic laser sweep plane across the face
      const scanFrac = ((t * (s.isThinking ? 0.85 : speakingActive ? 0.55 : 0.3)) % 1) * 2 - 1;
      const scanY = scanFrac * 92 * sc;
      const scanG = ctx.createLinearGradient(0, scanY - 12 * sc, 0, scanY + 12 * sc);
      scanG.addColorStop(0, rgba(brightCore, 0));
      scanG.addColorStop(0.5, rgba(brightCore, s.isThinking ? 0.3 : 0.16));
      scanG.addColorStop(1, rgba(brightCore, 0));
      ctx.fillStyle = scanG;
      ctx.fillRect(-headRx * 1.2, scanY - 12 * sc, headRx * 2.4, 24 * sc);

      ctx.restore(); // end head clip

      // Subtle holographic ears tucked properly on head flanks
      for (const side of [-1, 1]) {
        const earVis = Math.max(0.25, 1 - side * Math.sin(curYaw) * 0.75);
        ctx.save();
        ctx.globalAlpha = earVis;
        ctx.beginPath();
        ctx.ellipse(side * (headRx * 0.98) - pShiftX * 0.2, 2 * sc, 7 * sc, 15 * sc, side * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = rgba(deepShadow, 0.7);
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.55);
        ctx.lineWidth = 1.2 * sc;
        ctx.stroke();
        ctx.restore();
      }

      // 3d. Facial Core Features Group (Anchored in 3D Perspective: pShiftX, pShiftY)
      const fX = pShiftX * 0.9;
      const fY = pShiftY * 0.85;
      const eyeY = -14 * sc + fY;
      const eyeSepX = 25 * sc;

      // Expressive Animated Eyebrows styled by persona traits
      for (const side of [-1, 1]) {
        const bx = fX + side * eyeSepX;
        const browBaseY = eyeY - 14 * sc - curBrowLift * 5 * sc;
        ctx.beginPath();
        if (traits.browStyle === 'furrowed_heavy') {
          ctx.moveTo(bx - side * 14 * sc, browBaseY + 3.5 * sc);
          ctx.quadraticCurveTo(bx, browBaseY - 4 * sc, bx + side * 14 * sc, browBaseY + 1 * sc);
          ctx.lineWidth = 3.2 * sc;
        } else if (traits.browStyle === 'arched_sage') {
          ctx.moveTo(bx - side * 12 * sc, browBaseY + 2 * sc);
          ctx.quadraticCurveTo(bx + side * 2 * sc, browBaseY - 7 * sc, bx + side * 14 * sc, browBaseY + 2 * sc);
          ctx.lineWidth = 2.4 * sc;
        } else {
          ctx.moveTo(bx - side * 13 * sc, browBaseY + 1 * sc);
          ctx.quadraticCurveTo(bx, browBaseY - 3 * sc, bx + side * 13 * sc, browBaseY + 1.5 * sc);
          ctx.lineWidth = 2.5 * sc;
        }
        ctx.strokeStyle = rgba(brightCore, 0.9);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Living 3D Eyes with Gaze Tracking + Smooth Real-Time Blinking
      const gazeX = ptr.curX * 3.8 * sc + Math.sin(curYaw) * 2.5 * sc;
      const gazeY = ptr.curY * 2.4 * sc;

      for (const side of [-1, 1]) {
        const ex = fX + side * eyeSepX;
        const eRx = 11.5 * sc;
        const eRy = Math.max(0.8, 6.2 * sc * eyeOpenness);

        ctx.save();
        ctx.translate(ex, eyeY);

        // Eye socket subtle recessed halo
        ctx.beginPath();
        ctx.ellipse(0, 0, eRx * 1.25, 8.5 * sc, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgba(deepShadow, 0.45);
        ctx.fill();

        // Crisp almond eye aperture
        ctx.beginPath();
        ctx.moveTo(-eRx, 0);
        ctx.quadraticCurveTo(0, -eRy * 1.45, eRx, 0);
        ctx.quadraticCurveTo(0, eRy * 1.3, -eRx, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(4, 15, 30, 0.85)';
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.92);
        ctx.lineWidth = 1.4 * sc;
        ctx.stroke();

        if (eyeOpenness > 0.16) {
          ctx.clip();
          const irisR = 5.4 * sc;
          ctx.beginPath();
          ctx.arc(gazeX, gazeY, irisR, 0, Math.PI * 2);
          ctx.fillStyle = rgba(primary, 0.78);
          ctx.fill();
          ctx.strokeStyle = rgba(brightCore, 0.98);
          ctx.lineWidth = 1.2 * sc;
          ctx.stroke();

          // Dark holographic pupil
          ctx.beginPath();
          ctx.arc(gazeX, gazeY, 2.2 * sc, 0, Math.PI * 2);
          ctx.fillStyle = '#030a14';
          ctx.fill();

          // Corneal catchlight sparkle
          ctx.beginPath();
          ctx.arc(gazeX + 1.8 * sc, gazeY - 1.6 * sc, 1.4 * sc, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        ctx.restore();
      }

      // Wireframe Eyeglasses (Steve Jobs round wire / Chomsky rectangular)
      if (traits.glasses !== 'none') {
        ctx.save();
        ctx.strokeStyle = rgba(brightCore, 0.94);
        ctx.lineWidth = 1.55 * sc;
        ctx.shadowColor = rgba(primary, 0.75);
        ctx.shadowBlur = 5 * sc;

        for (const side of [-1, 1]) {
          const gx = fX + side * eyeSepX;
          ctx.beginPath();
          if (traits.glasses === 'round_wire') {
            ctx.arc(gx, eyeY + 1 * sc, 15.5 * sc, 0, Math.PI * 2);
          } else {
            ctx.roundRect(gx - 17 * sc, eyeY - 10 * sc, 34 * sc, 22 * sc, 5 * sc);
          }
          ctx.fillStyle = rgba(brightCore, 0.08);
          ctx.fill();
          ctx.stroke();

          // Temple arm back toward ear
          ctx.beginPath();
          ctx.moveTo(gx + side * 16 * sc, eyeY - 1 * sc);
          ctx.lineTo(side * headRx * 0.92, eyeY - 2 * sc);
          ctx.stroke();
        }
        // Nose bridge wire
        ctx.beginPath();
        ctx.moveTo(fX - 9.5 * sc, eyeY - 1 * sc);
        ctx.quadraticCurveTo(fX, eyeY - 5 * sc, fX + 9.5 * sc, eyeY - 1 * sc);
        ctx.stroke();
        ctx.restore();
      }

      // 3D Sculpted Nose (Extra Z parallax shift so turning head rotates nose tip naturally!)
      const noseTipX = fX + Math.sin(curYaw) * 10 * sc;
      const noseTopY = eyeY - 4 * sc;
      const noseTipY = 18 * sc + fY;
      ctx.save();
      ctx.strokeStyle = rgba(brightCore, 0.85);
      ctx.fillStyle = rgba(midTone, 0.35);
      ctx.lineWidth = 1.6 * sc;
      ctx.lineCap = 'round';

      if (traits.noseStyle === 'snub_broad') {
        // Socrates broad rounded philosopher nose
        ctx.beginPath();
        ctx.moveTo(fX - 2 * sc, noseTopY);
        ctx.quadraticCurveTo(noseTipX - 4 * sc, noseTipY - 7 * sc, noseTipX - 9 * sc, noseTipY + 1 * sc);
        ctx.quadraticCurveTo(noseTipX, noseTipY + 5 * sc, noseTipX + 9 * sc, noseTipY + 1 * sc);
        ctx.quadraticCurveTo(noseTipX + 4 * sc, noseTipY - 7 * sc, fX + 2 * sc, noseTopY);
        ctx.stroke();
      } else if (traits.noseStyle === 'aquiline') {
        // Da Vinci / Seneca / Ibn Khaldun prominent eagle nose bridge
        ctx.beginPath();
        ctx.moveTo(fX + 1 * sc, noseTopY);
        ctx.quadraticCurveTo(noseTipX + 5 * sc, (noseTopY + noseTipY) * 0.5, noseTipX, noseTipY + 3 * sc);
        ctx.quadraticCurveTo(noseTipX - 5 * sc, noseTipY + 2 * sc, noseTipX - 7 * sc, noseTipY - 2 * sc);
        ctx.stroke();
      } else {
        // Classical sculpted straight nose bridge & wings
        ctx.beginPath();
        ctx.moveTo(fX, noseTopY);
        ctx.lineTo(noseTipX, noseTipY + 1 * sc);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(noseTipX - 7.5 * sc, noseTipY);
        ctx.quadraticCurveTo(noseTipX, noseTipY + 4.5 * sc, noseTipX + 7.5 * sc, noseTipY);
        ctx.stroke();
      }
      ctx.restore();

      // 3e. Hyper-Articulated 3D Mouth, Lips, Teeth & Synchronized Vocal Cavity
      const mouthX = fX * 0.92;
      const mouthAnchorY = 39 * sc + fY;
      const mouthHalfW = 19.5 * sc * (0.94 + curWide * 0.16 - curRound * 0.24);
      const mouthOpenPx = curOpen * 22 * sc;

      // Physically displace lower lip & chin attachments!
      const upperLipMidY = mouthAnchorY - Math.min(2.5 * sc, mouthOpenPx * 0.12);
      const lowerLipMidY = mouthAnchorY + 2 * sc + mouthOpenPx;

      ctx.save();
      if (mouthOpenPx > 1.2) {
        // Dark glowing inside-mouth vocal chamber
        ctx.beginPath();
        ctx.moveTo(mouthX - mouthHalfW, mouthAnchorY);
        ctx.quadraticCurveTo(mouthX - mouthHalfW * 0.35, upperLipMidY - 3 * sc, mouthX, upperLipMidY);
        ctx.quadraticCurveTo(mouthX + mouthHalfW * 0.35, upperLipMidY - 3 * sc, mouthX + mouthHalfW, mouthAnchorY);
        ctx.quadraticCurveTo(mouthX, lowerLipMidY + mouthOpenPx * 0.28, mouthX - mouthHalfW, mouthAnchorY);
        ctx.closePath();

        const cavG = ctx.createLinearGradient(0, upperLipMidY, 0, lowerLipMidY);
        cavG.addColorStop(0, 'rgba(2, 8, 16, 0.95)');
        cavG.addColorStop(0.6, rgba(midTone, 0.65));
        cavG.addColorStop(1, rgba(primary, 0.55));
        ctx.fillStyle = cavG;
        ctx.fill();

        ctx.save();
        ctx.clip();

        // Glowing Holographic Upper Teeth Row (moves proportionally with curTeeth / openness)
        if (curTeeth > 0.1 || curOpen > 0.18) {
          ctx.fillStyle = rgba(brightCore, Math.min(0.88, 0.36 + curTeeth * 0.5));
          ctx.beginPath();
          ctx.roundRect(mouthX - mouthHalfW * 0.7, upperLipMidY - 1 * sc, mouthHalfW * 1.4, Math.max(2.5 * sc, mouthOpenPx * 0.32), 2.5 * sc);
          ctx.fill();
        }

        // Subtle lower tongue curve
        if (curOpen > 0.32) {
          ctx.fillStyle = rgba(primary, 0.45);
          ctx.beginPath();
          ctx.ellipse(mouthX, lowerLipMidY - 1 * sc, mouthHalfW * 0.56, Math.max(2 * sc, mouthOpenPx * 0.34), 0, Math.PI, 0);
          ctx.fill();
        }

        // Live pulsating vocal wave inside the mouth cavity
        if (curEnergy > 0.06) {
          ctx.beginPath();
          for (let wi = 0; wi <= 14; wi++) {
            const frac = wi / 14;
            const wx = mouthX - mouthHalfW * 0.78 + frac * mouthHalfW * 1.56;
            const env = Math.sin(frac * Math.PI);
            const wy = (upperLipMidY + lowerLipMidY) * 0.5 + Math.sin(t * 30 + wi) * mouthOpenPx * 0.28 * curEnergy * env;
            if (wi === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.strokeStyle = rgba(brightCore, 0.9 * curEnergy);
          ctx.lineWidth = 1.3 * sc;
          ctx.stroke();
        }
        ctx.restore();

        // Luminous Sculpted Upper & Lower Lips
        ctx.shadowColor = rgba(primary, 0.85);
        ctx.shadowBlur = 7 * sc;
        ctx.strokeStyle = rgba(brightCore, 0.96);
        ctx.lineWidth = 1.95 * sc;

        // Upper lip Cupid's bow
        ctx.beginPath();
        ctx.moveTo(mouthX - mouthHalfW, mouthAnchorY);
        ctx.quadraticCurveTo(mouthX - mouthHalfW * 0.35, upperLipMidY - 3 * sc, mouthX, upperLipMidY);
        ctx.quadraticCurveTo(mouthX + mouthHalfW * 0.35, upperLipMidY - 3 * sc, mouthX + mouthHalfW, mouthAnchorY);
        ctx.stroke();

        // Lower lip moving with jawDrop
        ctx.beginPath();
        ctx.moveTo(mouthX - mouthHalfW, mouthAnchorY);
        ctx.quadraticCurveTo(mouthX, lowerLipMidY + mouthOpenPx * 0.25, mouthX + mouthHalfW, mouthAnchorY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Serene expressive idle holographic mouth line
        ctx.strokeStyle = rgba(brightCore, 0.85);
        ctx.lineWidth = 1.65 * sc;
        ctx.beginPath();
        ctx.moveTo(mouthX - mouthHalfW * 0.9, mouthAnchorY);
        ctx.quadraticCurveTo(mouthX, mouthAnchorY + 2 * sc, mouthX + mouthHalfW * 0.9, mouthAnchorY);
        ctx.stroke();
      }
      ctx.restore();

      // 3f. Mustache (Flexes organically with upper lip & mouth corners)
      if (traits.mustacheStyle !== 'none') {
        ctx.save();
        const mLift = curOpen * 3 * sc;
        ctx.strokeStyle = rgba(brightCore, 0.85);
        ctx.fillStyle = rgba(midTone, 0.45);
        if (traits.mustacheStyle === 'walrus') {
          // Nietzsche massive overarching walrus mustache
          ctx.beginPath();
          ctx.moveTo(mouthX, mouthAnchorY - 9 * sc - mLift);
          ctx.bezierCurveTo(mouthX - 18 * sc, mouthAnchorY - 12 * sc, mouthX - 32 * sc, mouthAnchorY + 10 * sc, mouthX - 24 * sc, mouthAnchorY + 16 * sc);
          ctx.quadraticCurveTo(mouthX - 10 * sc, mouthAnchorY + 4 * sc, mouthX, mouthAnchorY - 1 * sc - mLift);
          ctx.quadraticCurveTo(mouthX + 10 * sc, mouthAnchorY + 4 * sc, mouthX + 24 * sc, mouthAnchorY + 16 * sc);
          ctx.bezierCurveTo(mouthX + 32 * sc, mouthAnchorY + 10 * sc, mouthX + 18 * sc, mouthAnchorY - 12 * sc, mouthX, mouthAnchorY - 9 * sc - mLift);
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 1.5 * sc;
          ctx.stroke();
        } else if (traits.mustacheStyle === 'bushy') {
          // Einstein bushy silver mustache
          ctx.beginPath();
          for (let wi = -5; wi <= 5; wi++) {
            const frac = wi / 5;
            ctx.moveTo(mouthX + frac * 14 * sc, mouthAnchorY - 9 * sc - mLift);
            ctx.quadraticCurveTo(
              mouthX + frac * 22 * sc,
              mouthAnchorY - 3 * sc,
              mouthX + frac * (24 + curWide * 4) * sc,
              mouthAnchorY + 4 * sc - mLift * 0.5
            );
          }
          ctx.lineWidth = 1.75 * sc;
          ctx.stroke();
        } else {
          // Sweeping trimmed / connected philosopher mustache arching smoothly over mouth
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(mouthX, mouthAnchorY - 7 * sc - mLift);
            ctx.quadraticCurveTo(
              mouthX + side * (14 * sc + curWide * 3 * sc),
              mouthAnchorY - 9 * sc - mLift,
              mouthX + side * (24 * sc + curWide * 3 * sc),
              mouthAnchorY + 4 * sc
            );
            ctx.lineWidth = 2.0 * sc;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3g. Character Beard & Chin Hair (Anchored directly to lower jaw: DROPS & MOVES WITH SPEECH!)
      if (traits.beardStyle !== 'none') {
        ctx.save();
        const bTopY = mouthAnchorY + 6 * sc + jawDrop * 0.75;
        const bBotY =
          traits.beardStyle === 'long_flowing'
            ? relChinY + 44 * sc
            : traits.beardStyle === 'curly_full'
              ? relChinY + 26 * sc
              : traits.beardStyle === 'trimmed_pointed'
                ? relChinY + 14 * sc
                : relChinY + 4 * sc;

        if (traits.beardStyle === 'short_goatee') {
          // Steve Jobs crisp goatee/chin beard
          ctx.beginPath();
          ctx.moveTo(mouthX - 18 * sc, bTopY);
          ctx.quadraticCurveTo(mouthX, bBotY, mouthX + 18 * sc, bTopY);
          ctx.strokeStyle = rgba(brightCore, 0.72);
          ctx.lineWidth = 1.5 * sc;
          ctx.stroke();
          for (let gi = -2; gi <= 2; gi++) {
            ctx.beginPath();
            ctx.moveTo(mouthX + gi * 5 * sc, bTopY + 3 * sc);
            ctx.lineTo(mouthX + gi * 3 * sc, bBotY - 2 * sc);
            ctx.strokeStyle = rgba(primary, 0.55);
            ctx.stroke();
          }
        } else if (traits.beardStyle === 'curly_full' || traits.beardStyle === 'long_flowing') {
          // Layered sculpted curly/flowing beard for Socrates, Marcus Aurelius, Da Vinci, Epictetus
          const widthSpread = traits.beardStyle === 'curly_full' ? 1.04 : 0.86;
          ctx.beginPath();
          ctx.moveTo(-headRx * 0.82, 22 * sc);
          ctx.bezierCurveTo(
            -headRx * 0.9 * widthSpread,
            bBotY * 0.78,
            -jawHalfW * 0.65,
            bBotY,
            mouthX * 0.5,
            bBotY + 4 * sc
          );
          ctx.bezierCurveTo(
            jawHalfW * 0.65,
            bBotY,
            headRx * 0.9 * widthSpread,
            bBotY * 0.78,
            headRx * 0.82,
            22 * sc
          );
          ctx.quadraticCurveTo(mouthX, bTopY + 8 * sc, -headRx * 0.82, 22 * sc);
          ctx.closePath();

          const bGrad = ctx.createLinearGradient(0, bTopY, 0, bBotY);
          bGrad.addColorStop(0, rgba(midTone, 0.68));
          bGrad.addColorStop(1, rgba(primary, 0.25));
          ctx.fillStyle = bGrad;
          ctx.fill();
          ctx.strokeStyle = rgba(brightCore, 0.85);
          ctx.lineWidth = 1.65 * sc;
          ctx.stroke();

          // Undulating inner beard curl strands
          const strandCount = traits.beardStyle === 'curly_full' ? 6 : 5;
          for (let bi = -strandCount; bi <= strandCount; bi++) {
            const frac = bi / strandCount;
            const sx = mouthX * 0.6 + frac * jawHalfW * 0.86;
            ctx.beginPath();
            ctx.moveTo(sx, bTopY + (1 - Math.abs(frac)) * 4 * sc);
            const curlWave = Math.sin(bi * 1.4) * 6 * sc;
            ctx.bezierCurveTo(
              sx + curlWave,
              (bTopY + bBotY) * 0.52,
              sx - curlWave,
              bBotY * 0.86,
              sx * 0.82,
              bBotY - Math.abs(frac) * 14 * sc
            );
            ctx.strokeStyle = rgba(brightCore, 0.52 - Math.abs(frac) * 0.22);
            ctx.lineWidth = 1.15 * sc;
            ctx.stroke();
          }
        } else {
          // Trimmed scholar pointed beard (Ibn Khaldun)
          ctx.beginPath();
          ctx.moveTo(-jawHalfW * 0.92, 26 * sc);
          ctx.quadraticCurveTo(-jawHalfW * 0.5, bBotY * 0.92, mouthX * 0.5, bBotY + 3 * sc);
          ctx.quadraticCurveTo(jawHalfW * 0.5, bBotY * 0.92, jawHalfW * 0.92, 26 * sc);
          ctx.fillStyle = rgba(midTone, 0.48);
          ctx.fill();
          ctx.strokeStyle = rgba(brightCore, 0.82);
          ctx.lineWidth = 1.5 * sc;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3h. Crown Hairline & Character Headwear (Turban / Renaissance Cap / Roman Curls / Bald Specular Dome)
      ctx.save();
      if (traits.headwear === 'turban') {
        // Ibn Khaldun sculpted multi-layered traditional scholar turban
        const tCenterY = -headRyTop * 0.72 + pShiftY * 0.35;
        ctx.beginPath();
        ctx.ellipse(0, tCenterY, headRx * 1.24, 38 * sc, 0, Math.PI * 0.88, Math.PI * 2.12);
        ctx.quadraticCurveTo(headRx * 1.04, -36 * sc, 0, -40 * sc);
        ctx.quadraticCurveTo(-headRx * 1.04, -36 * sc, -headRx * 1.16, tCenterY + 6 * sc);
        ctx.closePath();
        ctx.fillStyle = makeHoloGrad(0, tCenterY, headRx * 1.3, 0.62);
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.92);
        ctx.lineWidth = 1.8 * sc;
        ctx.stroke();

        // Criss-crossing glowing turban cloth folds
        for (let ti = -2; ti <= 2; ti++) {
          ctx.beginPath();
          ctx.moveTo(-headRx * 1.05, tCenterY + ti * 8 * sc);
          ctx.quadraticCurveTo(pShiftX * 0.4, tCenterY - (18 - Math.abs(ti) * 5) * sc, headRx * 1.05, tCenterY + (-ti + 1) * 7 * sc);
          ctx.strokeStyle = rgba(brightCore, 0.68);
          ctx.lineWidth = 1.25 * sc;
          ctx.stroke();
        }
      } else if (traits.headwear === 'renaissance_cap') {
        // Leonardo da Vinci classic tilted Renaissance scholar cap
        ctx.beginPath();
        ctx.ellipse(4 * sc, -headRyTop * 0.85, headRx * 1.18, 24 * sc, -0.08, 0, Math.PI * 2);
        ctx.fillStyle = rgba(midTone, 0.58);
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.88);
        ctx.lineWidth = 1.7 * sc;
        ctx.stroke();
      } else if (traits.hairStyle === 'bald_dome') {
        // Socrates glossy cranium dome arc + light temple wispy curls
        ctx.beginPath();
        ctx.arc(-14 * sc + pShiftX * 0.5, -headRyTop * 0.55, 22 * sc, Math.PI * 1.1, Math.PI * 1.65);
        ctx.strokeStyle = rgba(brightCore, 0.55);
        ctx.lineWidth = 2.0 * sc;
        ctx.stroke();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * headRx * 0.94, -18 * sc);
          ctx.quadraticCurveTo(side * headRx * 1.1, -6 * sc, side * headRx * 0.96, 8 * sc);
          ctx.strokeStyle = rgba(brightCore, 0.65);
          ctx.lineWidth = 1.4 * sc;
          ctx.stroke();
        }
      } else if (traits.hairStyle === 'curly_roman') {
        // Marcus Aurelius thick crown of sculpted Roman curls
        for (let ci = -5; ci <= 5; ci++) {
          const ang = -Math.PI * 0.5 + ci * 0.24;
          const cx = Math.cos(ang) * headRx * 0.98 + pShiftX * 0.2;
          const cy = Math.sin(ang) * headRyTop * 0.94 - 6 * sc;
          ctx.beginPath();
          ctx.arc(cx, cy, 10.5 * sc, 0, Math.PI * 2);
          ctx.fillStyle = rgba(midTone, 0.55);
          ctx.fill();
          ctx.strokeStyle = rgba(brightCore, 0.78);
          ctx.lineWidth = 1.2 * sc;
          ctx.stroke();
        }
      } else {
        // Contoured hair crest (short_modern, parted_classic, receding_side_tufts)
        const crownLift = traits.hairStyle === 'receding_side_tufts' ? 12 * sc : 0;
        ctx.beginPath();
        ctx.moveTo(-headRx * 0.95, -24 * sc);
        ctx.bezierCurveTo(
          -headRx * 0.98,
          -headRyTop * 1.15,
          headRx * 0.98,
          -headRyTop * 1.15,
          headRx * 0.95,
          -24 * sc
        );
        ctx.quadraticCurveTo(pShiftX * 0.4, -headRyTop * 0.65 + crownLift, -headRx * 0.95, -24 * sc);
        ctx.fillStyle = rgba(midTone, 0.52);
        ctx.fill();
        ctx.strokeStyle = rgba(brightCore, 0.84);
        ctx.lineWidth = 1.45 * sc;
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore(); // end head space

      // 4. Hologram Scanlines & Audio-Reactive Radial Halo
      ctx.save();
      ctx.fillStyle = rgba(primary, 0.045);
      for (let sy = 0; sy < height; sy += 4) {
        ctx.fillRect(0, sy, width, 1);
      }
      ctx.restore();

      if (speakingActive || s.isListening) {
        const barCount = 44;
        const haloR = unit * 0.395;
        ctx.save();
        for (let bi = 0; bi < barCount; bi++) {
          const ang = (bi / barCount) * Math.PI * 2 - Math.PI / 2;
          const waveAmp = speakingActive
            ? curEnergy * (0.45 + 0.55 * Math.abs(Math.sin(t * 9 + bi * 0.7)))
            : micBoost * (0.4 + 0.6 * Math.abs(Math.sin(t * 7 + bi * 0.6)));
          const len = 3 + waveAmp * 16;
          const x1 = centerX + Math.cos(ang) * haloR;
          const y1 = height * 0.44 + Math.sin(ang) * haloR;
          const x2 = centerX + Math.cos(ang) * (haloR + len);
          const y2 = height * 0.44 + Math.sin(ang) * (haloR + len);
          ctx.strokeStyle = rgba(brightCore, 0.18 + waveAmp * 0.62);
          ctx.lineWidth = 1.65;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerRef.current.targetX = Math.max(-1, Math.min(1, nx));
    pointerRef.current.targetY = Math.max(-1, Math.min(1, ny));
  };

  const handlePointerLeave = () => {
    pointerRef.current.targetX = 0;
    pointerRef.current.targetY = 0;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label={`أفاتار هولوغرافي ثلاثي الأبعاد لشخصية ${personaName}`}
      className={`w-full h-full block cursor-crosshair select-none touch-none ${className}`}
    />
  );
};
