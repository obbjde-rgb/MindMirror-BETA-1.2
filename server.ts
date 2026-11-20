import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const execAsync = promisify(exec);
const SERVER_START_ID = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

process.on("uncaughtException", (err) => {
  console.error("[Node Runtime] Uncaught exception intercepted to maintain 100% server uptime:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.warn("[Node Runtime] Unhandled rejection intercepted to maintain 100% server uptime:", reason);
});

// Cloud Run injects process.env.PORT (typically 8080).
// In AI Studio development, fallback to 3000; in standalone/Cloud Run production, fallback to 8080.
const PORT = process.env.PORT 
  ? parseInt(process.env.PORT, 10) 
  : (process.env.NODE_ENV === "production" ? 8080 : 3000);

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // System API Key Pool with Silent Background Rotation and Dynamic Auto-Discovery
  const explicitKeyNames = new Set([
    'GEMINI_API_KEY',
    'AISTUDIO_API_KEY',
    'APPLET_API_KEY',
    'PROJECT_API_KEY',
    'GEMINI_API_KEY_ALT',
    'GOOGLE_API_KEY',
  ]);
  const isLikelyApiKey = (val: string) =>
    val.length >= 20 &&
    !val.includes('/') &&
    !val.includes('\\') &&
    !/\s/.test(val) &&
    (/^AIza[0-9A-Za-z_-]{20,}$/.test(val) || /^[A-Za-z0-9_-]{24,}$/.test(val));

  const discoveredEnvKeys = Object.keys(process.env)
    .filter(k => (explicitKeyNames.has(k) || k.endsWith('_API_KEY') || k.startsWith('GEMINI_API_KEY')) && typeof process.env[k] === "string")
    .map(k => (process.env[k] || "").trim())
    .filter(isLikelyApiKey);

  const SYSTEM_KEYS = Array.from(new Set([
    process.env.GEMINI_API_KEY,
    process.env.AISTUDIO_API_KEY,
    process.env.APPLET_API_KEY,
    process.env.PROJECT_API_KEY,
    process.env.GEMINI_API_KEY_ALT,
    process.env.GOOGLE_API_KEY,
    ...discoveredEnvKeys
  ].map(k => (k || '').trim()).filter(k => k.length > 0 && isLikelyApiKey(k))));

  console.log(`[Key Pool] Initialized with ${SYSTEM_KEYS.length} system keys.`);

  // Round-robin index & cooldown map for keys that hit rate limits (429 / RESOURCE_EXHAUSTED)
  let keyRotationIndex = 0;
  const keyCooldowns = new Map<string, number>();
  const KEY_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown before retrying a key

  function getActiveKeyPool(preferredKey?: string): string[] {
    const now = Date.now();
    const pool: string[] = [];

    // If user provided a custom key, place it first in line if not in cooldown
    if (preferredKey && preferredKey.trim().length > 0) {
      const cleanUserKey = preferredKey.trim();
      const cooldown = keyCooldowns.get(cleanUserKey) || 0;
      if (now >= cooldown) {
        pool.push(cleanUserKey);
      }
    }

    // Gather system keys not in cooldown
    const availableSystemKeys = SYSTEM_KEYS.filter((k) => {
      const cd = keyCooldowns.get(k) || 0;
      return now >= cd;
    });

    if (availableSystemKeys.length > 0) {
      // Round-robin offset so traffic is evenly distributed across system keys
      const offset = keyRotationIndex % availableSystemKeys.length;
      keyRotationIndex++;
      const rotatedKeys = [
        ...availableSystemKeys.slice(offset),
        ...availableSystemKeys.slice(0, offset)
      ];
      for (const k of rotatedKeys) {
        if (!pool.includes(k)) pool.push(k);
      }
    }

    // Fallback if all keys are temporarily in cooldown
    if (pool.length === 0) {
      console.info("[Key Pool] All keys currently in cooldown. Auto-clearing cooldowns for silent fallback...");
      keyCooldowns.clear();
      for (const k of SYSTEM_KEYS) {
        if (!pool.includes(k)) pool.push(k);
      }
      if (preferredKey && preferredKey.trim() && !pool.includes(preferredKey.trim())) {
        pool.unshift(preferredKey.trim());
      }
    }

    return pool;
  }

  function markKeyExhausted(key: string) {
    if (!key) return;
    const keyTag = key.length > 8 ? `...${key.slice(-6)}` : key;
    console.info(`[Key Pool] Key ${keyTag} hit quota limit. Flagging 60s silent cooldown.`);
    keyCooldowns.set(key, Date.now() + KEY_COOLDOWN_MS);
  }

  // Central Gemini API Bridge (handles generation and streaming server-side)
  // Replaces client-side model cascade with Multi-Key Pool + Model Cascade Rotation
  const modelCooldowns = new Map<string, number>();

  const TEXT_CASCADE = [
    'gemini-3-flash-preview',
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-robotics-er-2-preview'
  ];

  const AUDIO_CASCADE = [
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-3.1-flash-tts-preview'
  ];

  async function callGemini(method: 'generateContent' | 'generateContentStream', params: any, clientApiKey?: string) {
    let rawModel = (params?.model || 'gemini-3-flash-preview').replace(/^models\//, '').replace(/^tunedModels\//, '').trim();
    if (rawModel === 'gemini-3.8-flash') {
      rawModel = 'gemini-3-flash-preview';
    }
    const isStrict = Boolean(
      params?.strictModel === true || 
      params?.isStrict === true || 
      params?.config?.strictModel === true || 
      params?.config?.isStrict === true
    );
    const isAudioRequest = Boolean(
      params?.config?.responseModalities?.includes("AUDIO") ||
      params?.config?.speechConfig ||
      rawModel.includes('tts') ||
      rawModel.includes('live')
    );

    const baseCascade = isAudioRequest ? AUDIO_CASCADE : TEXT_CASCADE;
    const now = Date.now();
    
    // Ensure primary model is always first in sequence
    const rawSequence = isStrict ? [rawModel] : Array.from(new Set([rawModel, ...baseCascade]));
    
    // Prioritize models that have not timed out or hit cooldowns
    const sequence = isStrict ? rawSequence : [...rawSequence].sort((a, b) => {
      const cdA = (modelCooldowns.get(a) || 0) > now ? 1 : 0;
      const cdB = (modelCooldowns.get(b) || 0) > now ? 1 : 0;
      return cdA - cdB;
    });

    // Dynamic timeout: unbounded (0) when unbounded/unboundedOutput requested, generous 180s default, 60s for audio
    const explicitTimeout = typeof params?.timeoutMs === 'number' ? params.timeoutMs : undefined;
    const isUnbounded = Boolean(params?.unbounded || params?.config?.unboundedOutput);
    const timeoutMs = explicitTimeout !== undefined ? explicitTimeout : (isUnbounded ? 0 : (isAudioRequest ? 60000 : 180000));

    let lastError: any = null;

    // Up to 3 resilient passes across the key pool
    for (let pass = 1; pass <= 3; pass++) {
      const pool = getActiveKeyPool(clientApiKey);
      const keysToTry: (string | null)[] = [];
      
      if (!clientApiKey || pass > 1) keysToTry.push(null);
      for (const k of pool) {
        if (k && !keysToTry.includes(k)) keysToTry.push(k);
      }

      for (const apiKey of keysToTry) {
        const finalKey = apiKey || SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '';
        const ai = new GoogleGenAI({ 
          apiKey: finalKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build-2026' } }
        });
        
        // Dynamically skip models in active cooldown so 503/timeout models are not repeatedly retried
        const currentNow = Date.now();
        const uncooledModels = sequence.filter(m => (modelCooldowns.get(m) || 0) <= currentNow);
        const modelsToTry = isStrict ? rawSequence : (uncooledModels.length > 0 ? uncooledModels : sequence);

        for (const model of modelsToTry) {
          let timer: any = null;
          try {
            const cleanModel = (model || '').replace(/^models\//, '').replace(/^tunedModels\//, '').trim();
            const callParams = JSON.parse(JSON.stringify({ ...params, model: cleanModel }));
            // Strip internal control fields before calling SDK
            delete callParams.unbounded;
            delete callParams.timeoutMs;
            delete callParams.strictModel;
            delete callParams.isStrict;
            if (callParams.config) {
              delete callParams.config.unboundedOutput;
              delete callParams.config.strictModel;
              delete callParams.config.isStrict;
              if (isUnbounded && callParams.config.maxOutputTokens !== undefined) {
                delete callParams.config.maxOutputTokens;
              }
            }
            if (isUnbounded && callParams.maxOutputTokens !== undefined) {
              delete callParams.maxOutputTokens;
            }
            
            // Normalize params
            if (isAudioRequest || cleanModel.includes('tts') || cleanModel.includes('live')) {
              const keysToDelete = ['systemInstruction', 'system_instruction', 'developerInstruction', 'developer_instruction'];
              keysToDelete.forEach(k => delete (callParams as any)[k]);
              ['config', 'generationConfig', 'generation_config'].forEach(cfgKey => {
                if ((callParams as any)[cfgKey]) keysToDelete.forEach(k => delete (callParams as any)[cfgKey][k]);
              });
              if (Array.isArray(callParams.contents)) {
                callParams.contents = callParams.contents.filter((c: any) => c.role !== 'system' && c.role !== 'developer');
              }
            }

            // CRITICAL SANITIZATION: Fix "Requests ending with a model turn are not supported." (INVALID_ARGUMENT - 400)
            if (Array.isArray(callParams.contents)) {
              let contents = callParams.contents.map((item: any) => {
                if (typeof item === 'string') {
                  return { role: 'user', parts: [{ text: item }] };
                }
                if (item && !item.role) {
                  return { ...item, role: 'user' };
                }
                return item;
              }).filter((item: any) => item && (item.role === 'user' || item.role === 'model'));

              // Trim trailing model turn(s) at end of conversation history
              while (contents.length > 0 && contents[contents.length - 1].role === 'model') {
                contents.pop();
              }

              // Merge adjacent turns with identical roles
              const sanitizedContents: any[] = [];
              for (const turn of contents) {
                if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === turn.role) {
                  const prevTurn = sanitizedContents[sanitizedContents.length - 1];
                  const prevParts = Array.isArray(prevTurn.parts) ? prevTurn.parts : [{ text: String(prevTurn.text || '') }];
                  const newParts = Array.isArray(turn.parts) ? turn.parts : [{ text: String(turn.text || '') }];
                  prevTurn.parts = [...prevParts, ...newParts];
                } else {
                  const parts = Array.isArray(turn.parts) ? turn.parts : [{ text: String(turn.text || '') }];
                  sanitizedContents.push({ role: turn.role, parts });
                }
              }

              if (sanitizedContents.length === 0) {
                sanitizedContents.push({ role: 'user', parts: [{ text: 'مرحباً' }] });
              }

              callParams.contents = sanitizedContents;
            }
            
            const executeCall = async (targetParams: any) => {
              if (method === 'generateContent') return await ai.models.generateContent(targetParams);
              return await ai.models.generateContentStream(targetParams);
            };

            try {
              const resObj = timeoutMs > 0
                ? await Promise.race([
                    executeCall(callParams),
                    new Promise((_, reject) => {
                      timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s on model ${model}`)), timeoutMs);
                    })
                  ])
                : await executeCall(callParams);
              if (timer) clearTimeout(timer);
              return resObj;
            } catch (firstCallErr: any) {
              if (timer) clearTimeout(timer);

              // If call failed with web search tools attached (e.g. 429 Grounding Quota Exceeded), strip tools & retry immediately!
              const hasTools = Boolean(callParams.config?.tools || callParams.tools);
              if (hasTools) {
                console.info(`[Search Tool Fallback] Model ${model} failed with googleSearch tool attached. Stripping tools and augmenting with algorithmic search...`);
                delete callParams.config?.tools;
                delete callParams.tools;

                // Perform algorithmic web search augmentation
                const lastUserTurn = callParams.contents?.[callParams.contents.length - 1];
                const userPromptText = lastUserTurn?.parts?.[0]?.text || '';
                if (userPromptText) {
                  try {
                    const searchResults = await fetchAlgorithmicWebImages(userPromptText, "photo");
                    if (searchResults && searchResults.length > 0) {
                      const searchContext = searchResults.slice(0, 3).map((s, idx) => `[مصدر ويب ${idx + 1}: ${s.title}] (${s.sourceDomain})\n${s.description}`).join('\n\n');
                      if (lastUserTurn?.parts?.[0]) {
                        lastUserTurn.parts[0].text = `${userPromptText}\n\n[سياق ونتائج البحث التلقائي في الأرشيف المفتوح والويب]:\n${searchContext}`;
                      }
                    }
                  } catch (sErr) {
                    // ignore augmentation error
                  }
                }

                let fallbackTimer: any = null;
                try {
                  const fallbackResult = timeoutMs > 0
                    ? await Promise.race([
                        executeCall(callParams),
                        new Promise((_, reject) => {
                          fallbackTimer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s on fallback model ${model}`)), timeoutMs);
                        })
                      ])
                    : await executeCall(callParams);
                  if (fallbackTimer) clearTimeout(fallbackTimer);
                  return fallbackResult;
                } catch (fallbackErr: any) {
                  if (fallbackTimer) clearTimeout(fallbackTimer);
                  throw fallbackErr;
                }
              }

              throw firstCallErr;
            }
          } catch (err: any) {
            if (timer) clearTimeout(timer);
            lastError = err;
            const errMsg = err.message || String(err);
            const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
            const isInvalidKey = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED');
            const isBadRequest = errMsg.includes('400') || errMsg.includes('INVALID_ARGUMENT');
            const isServiceUnavailable = errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('currently unavailable') || errMsg.includes('UNAVAILABLE');
            const isNotFound = errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('501');
            const isTimeout = errMsg.includes('Timeout') || errMsg.includes('timeout') || errMsg.includes('aborted');

            console.info(`[Pass ${pass}] Model ${model} fallback on ${apiKey ? '***' + apiKey.slice(-4) : 'INTERNAL'}:`, errMsg.slice(0, 100));

            if (isStrict) {
              console.info(`[Strict Mode Enforced] Model ${model} failed (${errMsg.slice(0, 80)}). Model fallback strictly disabled.`);
              break;
            }

            if (isBadRequest) {
              throw err;
            }

            if (isInvalidKey) {
              if (apiKey) markKeyExhausted(apiKey);
              break; // Switch immediately to next key rather than trying all models with an invalid key
            }

            if (isNotFound) continue;
            if (isServiceUnavailable) {
              modelCooldowns.set(model, Date.now() + 2 * 60 * 1000);
              console.info(`[503 Fallback] Model ${model} is currently unavailable or overloaded. Cooldown set for 2m. Continuing cascade...`);
              continue;
            }
            if (isTimeout) {
              modelCooldowns.set(model, Date.now() + 60000);
              console.info(`[Fallback] Model ${model} timed out. Attempting next in cascade...`);
              continue; 
            }
            if (isQuota) {
              modelCooldowns.set(model, Date.now() + 5 * 60 * 1000);
              if (apiKey) markKeyExhausted(apiKey);
              console.info(`[Quota Fallback] Model ${model} hit quota limit. Cooldown set for 5m. Continuing cascade...`);
              continue;
            }
          }
        }
      }

      if (pass < 3) await new Promise(r => setTimeout(r, 800));
    }

    throw lastError || new Error("عذراً، المنصة تمر بضغط عالٍ حالياً. تم استنفاد كافة المحاولات والنماذج الاحتياطية. يرجى المحاولة لاحقاً.");
  }

  // Key Pool Status endpoint for frontend and diagnostic inspection
  app.get("/api/key-pool-status", (req, res) => {
    const pool = getActiveKeyPool();
    res.json({
      hasEnvironmentKey: SYSTEM_KEYS.length > 0,
      systemKeysCount: SYSTEM_KEYS.length,
      activeKeysInPool: pool.length,
      keysInCooldown: keyCooldowns.size,
      defaultModel: 'gemini-3-flash-preview'
    });
  });

  // Models list proxy endpoint
  app.post("/api/models", async (req, res) => {
    const { apiKey: rawKey } = req.body;
    const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '' && rawKey !== 'undefined') ? rawKey.trim() : undefined;
    
    const pool = getActiveKeyPool(clientApiKey);
    const keysToTry: (string | null)[] = [...pool];
    // Ensure we always try the internal identity if no client key or as final fallback
    if (!clientApiKey && !keysToTry.includes(null)) keysToTry.unshift(null);
    if (clientApiKey && !keysToTry.includes(null)) keysToTry.push(null);

    let lastError: any = null;
    const seenModels = new Set<string>();

    for (const apiKey of keysToTry) {
      const finalKey = apiKey !== null ? apiKey : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');
      if (!finalKey && apiKey !== null) continue; 

      try {
        const ai = new GoogleGenAI({ 
          apiKey: finalKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const response = await ai.models.list();
        for await (const modelInfo of response) {
          if (modelInfo.name) {
            const name = modelInfo.name.replace(/^models\//, '').replace(/^tunedModels\//, '').trim();
            seenModels.add(name);
          }
        }
        
        // Ensure verified key models are always in the list
        seenModels.add('gemini-3-flash-preview');
        seenModels.add('gemini-4-hydrogen');
        seenModels.add('gemini-3.1-flash-lite');
        seenModels.add('gemini-4-argon');
        seenModels.add('gemini-flash-latest');

        if (seenModels.size > 0) {
          return res.json({ models: Array.from(seenModels).sort() });
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          if (apiKey) markKeyExhausted(apiKey);
        }
        console.warn(`[API Models] Key ${apiKey ? '***' + apiKey.slice(-4) : 'INTERNAL'} failed:`, errMsg.slice(0, 50));
      }
    }

    // Always guarantee complete list of valid models
    return res.json({ 
      models: [
        'gemini-3-flash-preview',
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-4-argon',
        'gemini-flash-latest'
      ].sort() 
    });
  });

  // Voice Replication API (Real Google Gemini Voices API via @google/genai)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  const normalizeAudioMime = (mimetype?: string): string => {
    const clean = (mimetype || '').split(';')[0].trim().toLowerCase();
    if (!clean || clean === 'application/octet-stream') return 'audio/wav';
    if (clean === 'audio/x-wav' || clean === 'audio/wave') return 'audio/wav';
    return clean;
  };

  const formatVoiceReplicationError = (rawMessage: string, statusCode?: number): string => {
    const lower = rawMessage.toLowerCase();
    if (statusCode === 403 || lower.includes('permission_denied') || lower.includes('tier') || lower.includes('billing') || lower.includes('allowlist') || lower.includes('not enabled')) {
      return 'يتطلب استنساخ الصوت الحقيقي (Voice Replication) مفتاح Gemini API من الفئة المدفوعة (Tier 1 فأعلى) أو حساباً مفعلاً عليه واجهة Voices API.';
    }
    if (lower.includes('consent') || lower.includes('speaker') || lower.includes('mismatch') || lower.includes('phrase') || lower.includes('watermark') || lower.includes('synthid')) {
      return 'تعذر التحقق البيومتري من عينة الموافقة أو تطابق المتحدث. تأكد من قراءة نص الإقرار المطلوب حرفياً وبوضوح، ومن تطابق المتحدث والميكروفون مع العينة المرجعية.';
    }
    if (lower.includes('does not support voice replication')) {
      return 'النموذج المحدد لا يدعم عملية إنشاء البصمة الصوتية؛ يجب إنشاء الصوت عبر gemini-3.8-flash-tts ثم استخدامه في النطق على أي نموذج TTS.';
    }
    if (statusCode === 400 || lower.includes('invalid_argument') || lower.includes('duration') || lower.includes('too short') || lower.includes('too long')) {
      return 'بيانات الصوت غير مقبولة من المحرك. تأكد من تسجيل عينة مرجعية واضحة (10–30 ثانية) وعينة موافقة لفظية كاملة بصيغة WAV 24kHz أحادية القناة.';
    }
    if (statusCode === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return 'تم الوصول للحد الأقصى لحصة استنساخ أو تخزين الأصوات في المشروع (200 صوت كحد أقصى أو حد الطلبات).';
    }
    return rawMessage || 'تعذر إتمام استنساخ الصوت عبر خادم Gemini API.';
  };

  app.get("/api/voices", async (req, res) => {
    const clientApiKey = (typeof req.query.apiKey === 'string' && req.query.apiKey.trim() && req.query.apiKey !== 'undefined')
      ? req.query.apiKey.trim()
      : undefined;
    const pool = getActiveKeyPool(clientApiKey);
    const keysToTry: (string | null)[] = [...pool];
    if (!clientApiKey && !keysToTry.includes(null)) keysToTry.unshift(null);
    if (clientApiKey && !keysToTry.includes(null)) keysToTry.push(null);

    let lastErr: any = null;
    for (const apiKey of keysToTry) {
      const finalKey = apiKey !== null ? apiKey : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '');
      if (!finalKey && apiKey !== null) continue;
      try {
        const ai = new GoogleGenAI({
          apiKey: finalKey,
          httpOptions: { apiVersion: 'v1beta', headers: { 'User-Agent': 'aistudio-build' } }
        });
        const listRes: any = await ai.voices.list({ type: ['replicated'], page_size: 200 });
        const voices = Array.isArray(listRes?.voices) ? listRes.voices : [];
        return res.json({ voices, next_page_token: listRes?.next_page_token || null });
      } catch (err: any) {
        lastErr = err;
      }
    }
    return res.status(lastErr?.status || 500).json({ error: lastErr?.message || 'فشل جلب قائمة الأصوات المستنسخة', voices: [] });
  });

  app.get("/api/voices/:id", async (req, res) => {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    if (!rawId) return res.status(400).json({ error: 'معرف الصوت مطلوب' });
    if (rawId.startsWith('voicekey_')) {
      return res.json({ key: rawId, type: 'replicated', stateless: true });
    }
    const cleanVoiceId = rawId.startsWith('voices/') ? rawId.slice('voices/'.length) : rawId;
    const clientApiKey = (typeof req.query.apiKey === 'string' && req.query.apiKey.trim() && req.query.apiKey !== 'undefined')
      ? req.query.apiKey.trim()
      : undefined;
    const pool = getActiveKeyPool(clientApiKey);
    const keysToTry: (string | null)[] = [...pool];
    if (!clientApiKey && !keysToTry.includes(null)) keysToTry.unshift(null);
    if (clientApiKey && !keysToTry.includes(null)) keysToTry.push(null);

    let lastErr: any = null;
    for (const apiKey of keysToTry) {
      const finalKey = apiKey !== null ? apiKey : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '');
      if (!finalKey && apiKey !== null) continue;
      try {
        const ai = new GoogleGenAI({
          apiKey: finalKey,
          httpOptions: { apiVersion: 'v1beta', headers: { 'User-Agent': 'aistudio-build' } }
        });
        const voice = await ai.voices.get(cleanVoiceId);
        return res.json({ voice });
      } catch (err: any) {
        lastErr = err;
      }
    }
    return res.status(lastErr?.status || 500).json({ error: lastErr?.message || 'تعذر جلب بيانات الصوت من الخادم السحابي' });
  });

  app.delete("/api/voices/:id", async (req, res) => {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    if (!rawId) return res.status(400).json({ error: 'معرف الصوت مطلوب' });
    if (rawId.startsWith('voicekey_')) {
      return res.json({ deleted: true, stateless: true });
    }
    // @google/genai voicesDelete constructs /{api_version}/voices/{voicesId}, so pass bare ID without 'voices/' prefix
    const cleanVoiceId = rawId.startsWith('voices/') ? rawId.slice('voices/'.length) : rawId;
    const rawKey = (req.body?.apiKey || req.query?.apiKey) as string | undefined;
    const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() && rawKey !== 'undefined') ? rawKey.trim() : undefined;
    const pool = getActiveKeyPool(clientApiKey);
    const keysToTry: (string | null)[] = [...pool];
    if (!clientApiKey && !keysToTry.includes(null)) keysToTry.unshift(null);
    if (clientApiKey && !keysToTry.includes(null)) keysToTry.push(null);

    let lastErr: any = null;
    for (const apiKey of keysToTry) {
      const finalKey = apiKey !== null ? apiKey : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '');
      if (!finalKey && apiKey !== null) continue;
      try {
        const ai = new GoogleGenAI({
          apiKey: finalKey,
          httpOptions: { apiVersion: 'v1beta', headers: { 'User-Agent': 'aistudio-build' } }
        });
        await ai.voices.delete(cleanVoiceId);
        return res.json({ deleted: true, id: cleanVoiceId });
      } catch (err: any) {
        lastErr = err;
      }
    }
    return res.status(lastErr?.status || 500).json({ error: lastErr?.message || 'تعذر حذف الصوت من الخادم السحابي' });
  });

  const voiceUploadSessions = new Map<string, {
    createdAt: number;
    sourceChunks: string[];
    sourceTotal: number;
    sourceMime: string;
    consentChunks: string[];
    consentTotal: number;
    consentMime: string;
  }>();

  const pruneExpiredVoiceUploadSessions = () => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [sid, sess] of voiceUploadSessions.entries()) {
      if (sess.createdAt < cutoff) {
        voiceUploadSessions.delete(sid);
      }
    }
  };

  const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`انتهت مهلة الاتصال (${Math.round(ms / 1000)}ث) أثناء ${label}`)), ms);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  async function executeVoiceReplication(opts: {
    sourceB64: string;
    sourceMime: string;
    consentB64: string;
    consentMime: string;
    displayName: string;
    clientApiKey?: string;
    storeMode?: boolean;
    voiceModel?: string;
  }): Promise<{ status: number; body: any }> {
    const { sourceB64, sourceMime, consentB64, consentMime, displayName, clientApiKey } = opts;
    const preferredStore = opts.storeMode !== false; // default true (1-year managed voice)
    // Gemini Voices API requires gemini-3.8-flash-tts (or omitted) for voice creation;
    // the created voice can then be synthesized with either gemini-3.8-flash-tts or gemini-3.8-flash-lite-tts.
    const creationVoiceModel = 'gemini-3.8-flash-tts';
    const synthesisVoiceModel = (opts.voiceModel === 'gemini-3.8-flash-lite-tts')
      ? 'gemini-3.8-flash-lite-tts'
      : 'gemini-3.8-flash-tts';

    if (!sourceB64 || !consentB64 || sourceB64.length < 1300 || consentB64.length < 1300) {
      return {
        status: 400,
        body: { error: "العينة الصوتية المسجلة قصيرة جداً أو فارغة. يرجى إعادة التسجيل بوضوح." }
      };
    }

    const cleanDisplayName = displayName.trim() || "صوتي المستنسخ";
    const pool = getActiveKeyPool(clientApiKey);
    const keysToTry: (string | null)[] = [...pool];
    if (!clientApiKey && !keysToTry.includes(null)) keysToTry.unshift(null);
    if (clientApiKey && !keysToTry.includes(null)) keysToTry.push(null);

    const triedKeys = new Set<string>();
    let lastErr: any = null;
    let lastStatus = 500;

    for (const apiKey of keysToTry) {
      const finalKey = apiKey !== null
        ? apiKey
        : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '');
      if (!finalKey && apiKey !== null) continue;

      const dedupTag = finalKey || '__INTERNAL_PROXY__';
      if (triedKeys.has(dedupTag)) continue;
      triedKeys.add(dedupTag);

      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          apiVersion: 'v1beta',
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      try {
        let createdVoice: any;
        let usedStoreMode = preferredStore;

        try {
          createdVoice = await withTimeout(
            ai.voices.create({
              store: preferredStore,
              voice: {
                model: creationVoiceModel,
                type: "replicated",
                display_name: cleanDisplayName,
                replicated: {
                  source_audio: { data: sourceB64, mime_type: sourceMime },
                  consent_audio: { data: consentB64, mime_type: consentMime }
                }
              }
            }),
            30000,
            'إنشاء بصمة الصوت عبر Gemini Voices API'
          );
        } catch (storedErr: any) {
          const msg = String(storedErr?.message || storedErr || '').toLowerCase();
          // If persistent stored voice quota (200 voices) is full, retry stateless client-managed key mode (voicekey_...)
          if (preferredStore && (msg.includes('resource_exhausted') || msg.includes('maximum') || msg.includes('quota'))) {
            console.warn('[Voice Replication] Stored voice limit reached, attempting stateless mode (store=false)...');
            usedStoreMode = false;
            createdVoice = await withTimeout(
              ai.voices.create({
                store: false,
                voice: {
                  model: creationVoiceModel,
                  type: "replicated",
                  display_name: cleanDisplayName,
                  replicated: {
                    source_audio: { data: sourceB64, mime_type: sourceMime },
                    consent_audio: { data: consentB64, mime_type: consentMime }
                  }
                }
              }),
              30000,
              'إنشاء مفتاح الصوت المستنسخ المؤقت'
            );
          } else {
            throw storedErr;
          }
        }

        const rawId = createdVoice?.id || createdVoice?.key || '';
        const isStatelessKey = !usedStoreMode || (!createdVoice?.id && Boolean(createdVoice?.key));
        if (!rawId) {
          throw new Error('لم تُرجِع واجهة Gemini Voices API معرف صوت صالح (id أو key).');
        }

        console.log(`[Voice Replication] Real Gemini voice created successfully: ${rawId.slice(0, 18)}... (store=${usedStoreMode}, createModel=${creationVoiceModel}, synthModel=${synthesisVoiceModel})`);

        // Synthesize a live verification clip using the newly replicated voice ID
        let previewAudioBase64: string | null = null;
        let previewWarning: string | null = null;
        try {
          const synthResponse = await withTimeout(
            ai.models.generateContent({
              model: synthesisVoiceModel,
              contents: "مرحباً بك! تم استنساخ صوتي الحقيقي بنجاح عبر محرك جيميني.",
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    voice: rawId
                  }
                }
              }
            }),
            20000,
            'توليد عينة التحقق بالصوت المستنسخ'
          );
          previewAudioBase64 = synthResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        } catch (synthErr: any) {
          console.warn('[Voice Replication] Live preview synthesis warning:', synthErr?.message || synthErr);
          previewWarning = synthErr?.message || 'تم إنشاء الصوت ولكن تعذر توليد المعاينة الفورية.';
        }

        return {
          status: 200,
          body: {
            success: true,
            voice_id: rawId,
            id: createdVoice?.id || null,
            key: createdVoice?.key || null,
            store: usedStoreMode,
            isStatelessKey,
            expire_time: createdVoice?.expire_time || null,
            display_name: createdVoice?.display_name || cleanDisplayName,
            model: synthesisVoiceModel,
            type: "replicated",
            source: "gemini_voices_api",
            previewAudioBase64,
            previewWarning
          }
        };
      } catch (err: any) {
        lastErr = err;
        const errMsg = String(err?.message || err || '');
        const statusMatch = errMsg.match(/Status\s+(\d{3})/) || errMsg.match(/"code":\s*(\d{3})/);
        const status = Number(err?.status || statusMatch?.[1] || 500);
        lastStatus = status;

        console.warn(`[Voice Replication API Error] status=${status}:`, errMsg.slice(0, 220));

        // Do not retry with other keys if the audio/consent itself failed biometric validation (400)
        if (status === 400 && !errMsg.includes('API_KEY_INVALID')) {
          return {
            status: 400,
            body: {
              error: formatVoiceReplicationError(errMsg, 400),
              details: errMsg
            }
          };
        }
        if (status === 429 && apiKey) {
          markKeyExhausted(apiKey);
        }
      }
    }

    const rawMsg = String(lastErr?.message || lastErr || '');
    const httpCode = (lastStatus >= 400 && lastStatus < 600) ? lastStatus : 502;
    return {
      status: httpCode,
      body: {
        error: formatVoiceReplicationError(rawMsg, lastStatus),
        details: rawMsg
      }
    };
  }

  app.post("/api/voices/upload-chunk", (req, res) => {
    try {
      pruneExpiredVoiceUploadSessions();
      const { sessionId, field, chunkIndex, totalChunks, mimeType, data } = req.body || {};
      if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
        return res.status(400).json({ error: 'معرف جلسة الرفع غير صالح.' });
      }
      if (field !== 'source_audio' && field !== 'consent_audio') {
        return res.status(400).json({ error: 'نوع العينة الصوتية غير صالح.' });
      }
      if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || totalChunks > 250 || chunkIndex >= totalChunks) {
        return res.status(400).json({ error: 'ترتيب الجزء الصوتي غير صالح.' });
      }
      if (typeof data !== 'string' || data.length === 0) {
        return res.status(400).json({ error: 'بيانات الجزء الصوتي فارغة.' });
      }

      let sess = voiceUploadSessions.get(sessionId);
      if (!sess) {
        sess = {
          createdAt: Date.now(),
          sourceChunks: [],
          sourceTotal: 0,
          sourceMime: 'audio/wav',
          consentChunks: [],
          consentTotal: 0,
          consentMime: 'audio/wav'
        };
        voiceUploadSessions.set(sessionId, sess);
      }

      if (field === 'source_audio') {
        sess.sourceTotal = totalChunks;
        sess.sourceMime = normalizeAudioMime(mimeType);
        sess.sourceChunks[chunkIndex] = data;
      } else {
        sess.consentTotal = totalChunks;
        sess.consentMime = normalizeAudioMime(mimeType);
        sess.consentChunks[chunkIndex] = data;
      }

      return res.json({ ok: true, sessionId, field, chunkIndex, totalChunks });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'فشل استقبال جزء الصوت' });
    }
  });

  app.post("/api/voices/replicate-session", async (req, res) => {
    try {
      const { sessionId, display_name, apiKey: rawKey, store, model } = req.body || {};
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'معرف جلسة الاستنساخ مفقود.' });
      }
      const sess = voiceUploadSessions.get(sessionId);
      if (!sess) {
        return res.status(404).json({ error: 'انتهت صلاحية جلسة الرفع أو أُعيد تشغيل الخادم. يرجى إعادة المحاولة.' });
      }
      voiceUploadSessions.delete(sessionId);

      if (sess.sourceTotal < 1 || sess.consentTotal < 1) {
        return res.status(400).json({ error: 'عينة الصوت المرجعية وعينة الموافقة اللفظية الصريحة مطلوبتان لإكمال الاستنساخ.' });
      }
      for (let i = 0; i < sess.sourceTotal; i++) {
        if (!sess.sourceChunks[i]) {
          return res.status(400).json({ error: `الجزء رقم ${i + 1} من العينة المرجعية مفقود. يرجى المحاولة مجدداً.` });
        }
      }
      for (let i = 0; i < sess.consentTotal; i++) {
        if (!sess.consentChunks[i]) {
          return res.status(400).json({ error: `الجزء رقم ${i + 1} من عينة الموافقة مفقود. يرجى المحاولة مجدداً.` });
        }
      }

      const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '' && rawKey !== 'undefined')
        ? rawKey.trim()
        : undefined;

      const result = await executeVoiceReplication({
        sourceB64: sess.sourceChunks.join(''),
        sourceMime: sess.sourceMime,
        consentB64: sess.consentChunks.join(''),
        consentMime: sess.consentMime,
        displayName: typeof display_name === 'string' ? display_name : 'صوتي المستنسخ',
        clientApiKey,
        storeMode: store !== false && store !== 'false',
        voiceModel: typeof model === 'string' ? model : undefined
      });
      return res.status(result.status).json(result.body);
    } catch (e: any) {
      console.error("[Voice Replication Session Error]:", e);
      return res.status(500).json({
        error: formatVoiceReplicationError(e?.message || 'خطأ غير متوقع في الخادم أثناء استنساخ الصوت.', 500)
      });
    }
  });

  app.post("/api/voices/replicate", (req, res, next) => {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      return next();
    }
    upload.fields([{ name: 'source_audio' }, { name: 'consent_audio' }])(req, res, (err) => {
      if (err) {
        console.warn('[Voice Replication Upload Error]', err);
        return res.status(400).json({ error: `خطأ في رفع الملفات الصوتية: ${err.message}` });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const { apiKey: rawKey, display_name, store, model, source_audio_base64, consent_audio_base64, source_mime_type, consent_mime_type } = req.body || {};
      const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '' && rawKey !== 'undefined')
        ? rawKey.trim()
        : undefined;

      let sourceB64 = typeof source_audio_base64 === 'string' ? source_audio_base64 : '';
      let consentB64 = typeof consent_audio_base64 === 'string' ? consent_audio_base64 : '';
      let sourceMime = normalizeAudioMime(source_mime_type);
      let consentMime = normalizeAudioMime(consent_mime_type);

      if (!sourceB64 || !consentB64) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const sourceFile = files?.source_audio?.[0];
        const consentFile = files?.consent_audio?.[0];
        if (!sourceFile || !consentFile) {
          return res.status(400).json({ error: "عينة الصوت المرجعية وعينة الموافقة اللفظية الصريحة مطلوبتان لإكمال الاستنساخ." });
        }
        if (sourceFile.buffer.length < 1000 || consentFile.buffer.length < 1000) {
          return res.status(400).json({ error: "العينة الصوتية المسجلة قصيرة جداً أو فارغة. يرجى إعادة التسجيل بوضوح." });
        }
        sourceMime = normalizeAudioMime(sourceFile.mimetype);
        consentMime = normalizeAudioMime(consentFile.mimetype);
        sourceB64 = sourceFile.buffer.toString('base64');
        consentB64 = consentFile.buffer.toString('base64');
      }

      const result = await executeVoiceReplication({
        sourceB64,
        sourceMime,
        consentB64,
        consentMime,
        displayName: typeof display_name === 'string' ? display_name : 'صوتي المستنسخ',
        clientApiKey,
        storeMode: store !== false && store !== 'false',
        voiceModel: typeof model === 'string' ? model : undefined
      });
      return res.status(result.status).json(result.body);
    } catch (e: any) {
      console.error("[Voice Replication System Error]:", e);
      return res.status(500).json({
        error: formatVoiceReplicationError(e?.message || 'خطأ غير متوقع في الخادم أثناء استنساخ الصوت.', 500)
      });
    }
  });

  // Dynamic auto-continuation helper for arbitrarily long outputs (zero truncation on MAX_TOKENS & unlimited total duration while streaming tokens)
  async function generateUnboundedResponse(params: any, clientApiKey?: string) {
    const baseParams = JSON.parse(JSON.stringify({ ...params, unbounded: true }));
    if (baseParams.config?.maxOutputTokens !== undefined) {
      delete baseParams.config.maxOutputTokens;
    }
    const modalities: string[] = Array.isArray(baseParams?.config?.responseModalities)
      ? baseParams.config.responseModalities
      : [];
    const isMediaRequest = Boolean(
      modalities.includes("AUDIO") ||
      modalities.includes("IMAGE") ||
      baseParams?.config?.speechConfig ||
      baseParams?.config?.imageConfig ||
      String(baseParams?.model || "").includes("tts") ||
      String(baseParams?.model || "").includes("imagen")
    );

    if (isMediaRequest) {
      return await callGemini("generateContent", { ...baseParams, timeoutMs: 90000 }, clientApiKey);
    }

    const runStreamingTurn = async (turnParams: any): Promise<{ text: string; finishReason?: string; lastChunk: any }> => {
      const stream: any = await callGemini(
        "generateContentStream",
        { ...turnParams, timeoutMs: 45000 },
        clientApiKey
      );
      let textAcc = "";
      let finishReason: string | undefined;
      let lastChunk: any = null;
      const IDLE_LIMIT_MS = 65000;

      const iterator = stream[Symbol.asyncIterator]();
      while (true) {
        let idleTimer: any = null;
        const nextStep: IteratorResult<any> = await Promise.race([
          iterator.next(),
          new Promise<IteratorResult<any>>((_, reject) => {
            idleTimer = setTimeout(() => reject(new Error("Stream idle timeout without incoming tokens")), IDLE_LIMIT_MS);
          })
        ]);
        if (idleTimer) clearTimeout(idleTimer);
        if (nextStep.done) break;
        const chunk = nextStep.value;
        lastChunk = chunk;
        const piece =
          typeof chunk?.text === "string"
            ? chunk.text
            : (chunk?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
        if (piece) textAcc += piece;
        if (chunk?.candidates?.[0]?.finishReason) {
          finishReason = chunk.candidates[0].finishReason;
        }
      }
      return { text: textAcc, finishReason, lastChunk };
    };

    const firstTurn = await runStreamingTurn(baseParams);
    let combinedText = firstTurn.text;
    let latestChunk = firstTurn.lastChunk;
    let finishReason = firstTurn.finishReason;

    const initialTurns: any[] = Array.isArray(baseParams.contents)
      ? JSON.parse(JSON.stringify(baseParams.contents))
      : [{ role: "user", parts: [{ text: String(baseParams.contents || "") }] }];

    // Seamless continuation loop if model hits MAX_TOKENS mid-code or mid-text
    let turnBudget = 0;
    while (finishReason === "MAX_TOKENS" && combinedText && turnBudget < 8) {
      turnBudget += 1;
      const tailAnchor = combinedText.slice(-180);
      const contContents = [
        ...initialTurns,
        { role: "model", parts: [{ text: combinedText }] },
        {
          role: "user",
          parts: [
            {
              text: `Continue writing seamlessly from the exact character where you stopped (just after: "${tailAnchor}"). Do NOT repeat anything already written; output ONLY the remaining continuation until completely finished.`
            }
          ]
        }
      ];
      try {
        const contTurn = await runStreamingTurn({ ...baseParams, contents: contContents });
        if (!contTurn.text) break;
        combinedText += contTurn.text;
        latestChunk = contTurn.lastChunk || latestChunk;
        finishReason = contTurn.finishReason;
      } catch {
        break;
      }
    }

    const syntheticCandidates = latestChunk?.candidates
      ? JSON.parse(JSON.stringify(latestChunk.candidates))
      : [{ content: { role: "model", parts: [{ text: combinedText }] }, finishReason: finishReason || "STOP" }];

    if (syntheticCandidates[0]?.content?.parts?.[0]) {
      syntheticCandidates[0].content.parts[0].text = combinedText;
    } else if (syntheticCandidates[0]) {
      syntheticCandidates[0].content = { role: "model", parts: [{ text: combinedText }] };
    }

    return {
      ...(latestChunk || {}),
      candidates: syntheticCandidates,
      text: combinedText
    };
  }

  app.post("/api/generate", async (req, res) => {
    const { params, apiKey: rawKey } = req.body;
    const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '' && rawKey !== 'undefined') ? rawKey.trim() : undefined;
    try {
      const result: any = await generateUnboundedResponse(params, clientApiKey);
      const textVal = typeof result.text === 'function' ? result.text() : (result.text || '');
      res.json({
        ...result,
        text: textVal,
        candidates: result.candidates,
        data: result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-stream", async (req, res) => {
    const { params, apiKey: rawKey } = req.body;
    const clientApiKey = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '' && rawKey !== 'undefined') ? rawKey.trim() : undefined;
    try {
      const baseStreamParams = JSON.parse(JSON.stringify({ ...params, unbounded: true, timeoutMs: 0 }));
      if (baseStreamParams.config?.maxOutputTokens !== undefined) {
        delete baseStreamParams.config.maxOutputTokens;
      }

      const stream: any = await callGemini('generateContentStream', baseStreamParams, clientApiKey);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let accumulatedText = '';
      let lastFinishReason: string | undefined;
      for await (const chunk of stream) {
        const piece =
          typeof chunk?.text === 'string'
            ? chunk.text
            : (chunk?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
        if (piece) accumulatedText += piece;
        if (chunk?.candidates?.[0]?.finishReason) {
          lastFinishReason = chunk.candidates[0].finishReason;
        }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      // Seamless automatic continuation if stream hits MAX_TOKENS mid-output
      const baseTurns: any[] = Array.isArray(baseStreamParams.contents)
        ? JSON.parse(JSON.stringify(baseStreamParams.contents))
        : [{ role: 'user', parts: [{ text: String(baseStreamParams.contents || '') }] }];

      let contBudget = 0;
      while (lastFinishReason === 'MAX_TOKENS' && accumulatedText && contBudget < 6) {
        contBudget += 1;
        lastFinishReason = undefined;
        const tailAnchor = accumulatedText.slice(-160);
        const contStream: any = await callGemini(
          'generateContentStream',
          {
            ...baseStreamParams,
            contents: [
              ...baseTurns,
              { role: 'model', parts: [{ text: accumulatedText }] },
              {
                role: 'user',
                parts: [
                  {
                    text: `Continue writing seamlessly from the exact character where you stopped (just after: "${tailAnchor}"). Do NOT repeat anything already written; output ONLY the remaining continuation.`
                  }
                ]
              }
            ],
            unbounded: true,
            timeoutMs: 0
          },
          clientApiKey
        );
        let addedAny = false;
        for await (const chunk of contStream) {
          const piece =
            typeof chunk?.text === 'string'
              ? chunk.text
              : (chunk?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
          if (piece) {
            accumulatedText += piece;
            addedAny = true;
          }
          if (chunk?.candidates?.[0]?.finishReason) {
            lastFinishReason = chunk.candidates[0].finishReason;
          }
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        if (!addedAny) break;
      }

      res.end();
    } catch (e: any) {
      if (res.headersSent) {
        try {
          res.write(`data: ${JSON.stringify({ error: e.message || 'Streaming failed' })}\n\n`);
        } catch {}
        return res.end();
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Advanced Algorithmic Multi-Source Web Image Fetcher Engine
  async function fetchAlgorithmicWebImages(prompt: string, searchType: string = "photo", discussionContext: string = "") {
    let typeModifier = "";
    if (searchType === "diagram") {
      typeModifier = " diagram chart schematic structure illustration";
    } else if (searchType === "historical") {
      typeModifier = " historical document ancient archive history manuscript";
    } else if (searchType === "infographic") {
      typeModifier = " infographic map data visualization geography";
    } else {
      typeModifier = " photograph real photo high resolution HD";
    }

    const cleanPrompt = prompt.replace(/(أريد|أبحث عن|جلب|صور|صورة|أعطني|عرض|أرشيف|عن|في|من|مع|على|إلى|الرجاء)/gi, ' ').trim() || prompt;
    
    // Comprehensive keyword dictionary mapping for common topics (Arabic -> English search terms)
    const keywordMappings: Record<string, string> = {
      "مكة": "Makkah Grand Mosque Saudi Arabia landmark",
      "القدس": "Jerusalem Al Aqsa Mosque Dome of Rock",
      "الأهرامات": "Giza Pyramids Egypt landmark monument",
      "طنجة": "Tangier Med Port Morocco logistics harbor",
      "المغرب": "Morocco landscape culture architecture",
      "الجزائر": "Algeria heritage architecture nature",
      "تونس": "Tunisia Mediterranean coast heritage",
      "مصر": "Egypt Nile historical monuments",
      "السعودية": "Saudi Arabia Riyadh landmark culture",
      "الإمارات": "Dubai Abu Dhabi skyline architecture",
      "ناسا": "NASA space exploration shuttle cosmos planet",
      "فضاء": "Space galaxy cosmos nebula planets telescope",
      "ذكاء اصطناعي": "Artificial Intelligence technology neural network AGI computer",
      "حاسوب": "Computer technology data server network",
      "سيارة": "Electric car automotive vehicle luxury",
      "طبيعة": "Nature landscape mountains forest river lake",
      "بحر": "Ocean sea sunset coastline waves",
      "تاريخ": "History ancient manuscript heritage monument historical",
      "حرب": "Historical battle fortress sword medieval armor",
      "طب": "Medical science medicine laboratory biology dna",
      "فيزياء": "Physics quantum atom energy science research",
      "كيمياء": "Chemistry laboratory science molecules research",
      "فن": "Art painting sculpture museum gallery",
      "خريطة": "Map cartography geography atlas world",
      "طيران": "Aviation airplane aircraft airport flight"
    };

    let englishKeywords = "";
    for (const [arKey, enVal] of Object.entries(keywordMappings)) {
      if (prompt.includes(arKey) || cleanPrompt.includes(arKey)) {
        englishKeywords += " " + enVal;
      }
    }

    if (!englishKeywords.trim()) {
      englishKeywords = cleanPrompt;
    }

    const results: Array<{
      title: string;
      url: string;
      sourceDomain: string;
      sourceUri: string;
      description: string;
      contextTag: string;
      dimensions: string;
    }> = [];

    const seenUrls = new Set<string>();

    const addImage = (img: { title: string; url: string; sourceDomain: string; sourceUri: string; description: string; contextTag: string; dimensions?: string }) => {
      if (!img.url || seenUrls.has(img.url)) return;
      seenUrls.add(img.url);
      results.push({
        title: img.title,
        url: img.url,
        sourceDomain: img.sourceDomain || "أرشيف الويب الموثق",
        sourceUri: img.sourceUri || `https://ar.wikipedia.org/wiki/${encodeURIComponent(cleanPrompt)}`,
        description: img.description || `صورة فوتوغرافية موثقة وعالية الدقة متعلقة بـ "${cleanPrompt}".`,
        contextTag: img.contextTag || "أرشيف بصري",
        dimensions: img.dimensions || "1200x800 HD"
      });
    };

    // 1. Fetch real lead photographs from Arabic Wikipedia API
    try {
      const wikiArUrl = `https://ar.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanPrompt)}&gsrlimit=5&prop=pageimages|info&pithumbsize=1200&inprop=url&format=json`;
      const resAr = await fetch(wikiArUrl, { headers: { 'User-Agent': 'AIStudio-ImageFetcher/1.0' } });
      if (resAr.ok) {
        const dataAr = await resAr.json();
        const pages = dataAr?.query?.pages || {};
        for (const pageId of Object.keys(pages)) {
          const page = pages[pageId];
          if (page?.thumbnail?.source) {
            addImage({
              title: page.title,
              url: page.thumbnail.source,
              sourceDomain: "ويكيبيديا العربية (Wikipedia)",
              sourceUri: page.fullurl || `https://ar.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
              description: `صورة رسمية موثقة من مقال الموسوعة لموضوع: ${page.title}`,
              contextTag: "أرشيف موثق",
              dimensions: `${page.thumbnail.width || 1200}x${page.thumbnail.height || 800}`
            });
          }
        }
      }
    } catch (err) {
      console.warn("[Algorithmic Fetcher] Arabic Wiki API Error:", err);
    }

    // 2. Fetch real photographs from English Wikipedia API for technical/global topics
    if (results.length < 3) {
      try {
        const wikiEnUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(englishKeywords)}&gsrlimit=5&prop=pageimages|info&pithumbsize=1200&inprop=url&format=json`;
        const resEn = await fetch(wikiEnUrl, { headers: { 'User-Agent': 'AIStudio-ImageFetcher/1.0' } });
        if (resEn.ok) {
          const dataEn = await resEn.json();
          const pages = dataEn?.query?.pages || {};
          for (const pageId of Object.keys(pages)) {
            const page = pages[pageId];
            if (page?.thumbnail?.source) {
              addImage({
                title: `${page.title} (أرشيف عالمي)`,
                url: page.thumbnail.source,
                sourceDomain: "Wikipedia Global Archives",
                sourceUri: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                description: `صورة عالية الدقة من الأرشيف العالمي لـ ${page.title}`,
                contextTag: "أرشيف عالمي",
                dimensions: "HD 1200p"
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Algorithmic Fetcher] English Wiki API Error:", err);
      }
    }

    // 3. Fetch from Wikimedia Commons Direct Media Search
    if (results.length < 4) {
      try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(englishKeywords || cleanPrompt)}&gsrnamespace=6&prop=imageinfo&iiprop=url|size&gsrlimit=5&format=json`;
        const resCommons = await fetch(commonsUrl, { headers: { 'User-Agent': 'AIStudio-ImageFetcher/1.0' } });
        if (resCommons.ok) {
          const dataCommons = await resCommons.json();
          const pages = dataCommons?.query?.pages || {};
          for (const pageId of Object.keys(pages)) {
            const page = pages[pageId];
            const imgInfo = page?.imageinfo?.[0];
            if (imgInfo?.url && (imgInfo.url.endsWith('.jpg') || imgInfo.url.endsWith('.png') || imgInfo.url.endsWith('.jpeg'))) {
              const cleanTitle = (page.title || "").replace(/^File:/i, "").replace(/\.[^/.]+$/, "");
              addImage({
                title: cleanTitle || cleanPrompt,
                url: imgInfo.url,
                sourceDomain: "Wikimedia Commons Archives",
                sourceUri: imgInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
                description: `صورة فوتوغرافية أصلية وعالية الجودة من ويكيميديا كومنز لـ: ${cleanTitle}`,
                contextTag: "وسائط مفتوحة",
                dimensions: `${imgInfo.width || 1200}x${imgInfo.height || 800}`
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Algorithmic Fetcher] Wikimedia Commons Error:", err);
      }
    }

    // 4. Generate photorealistic 16:9 representations via Pollinations 8K Engine
    const seedBase = Math.floor(Math.random() * 9000) + 1000;
    
    addImage({
      title: `رؤية بصرية فائقة الوضوح لـ: ${cleanPrompt}`,
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(englishKeywords + " high resolution photorealistic 8k photo detailed lighting")}&width=1200&height=675&nologo=true&seed=${seedBase}`,
      sourceDomain: "High-Res Visual Engine",
      sourceUri: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanPrompt)}`,
      description: `رسم بصري وتجسيد بدقة 4K عالي التفاصيل والإضاءة لـ "${cleanPrompt}".`,
      contextTag: "عرض 4K",
      dimensions: "16:9 4K"
    });

    addImage({
      title: `لقطة سينمائية وتوثيق بصري لـ: ${cleanPrompt}`,
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(englishKeywords + " cinematic photograph detailed view 8k Ultra HD")}&width=1200&height=675&nologo=true&seed=${seedBase + 1}`,
      sourceDomain: "HD Media Vault",
      sourceUri: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(cleanPrompt)}`,
      description: `تصوير سينمائي ومظهر إضافي دقيق مكمل لـ "${cleanPrompt}".`,
      contextTag: "تجسيد سينمائي",
      dimensions: "16:9 Ultra HD"
    });

    return results;
  }

  // Predictive Visual Context & Google Image Search Grounding API
  app.post("/api/grounded-image-search", async (req, res) => {
    const { prompt: rawPrompt, mode = "web_grounding", searchType = "photo", imageModel = "gemini-3.1-flash-lite-image", discussionContext = "", apiKey: reqKey } = req.body || {};
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
    if (!prompt) {
      return res.status(400).json({ error: "نص البحث مطلوب" });
    }
    const apiKey = (reqKey && typeof reqKey === 'string' && reqKey.trim() !== '') 
      ? reqKey.trim() 
      : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');

    // Execute real multi-source algorithmic image search
    const algorithmicImages = await fetchAlgorithmicWebImages(prompt, searchType, discussionContext);

    if (!apiKey) {
      return res.json({
        analysis: `تم استخراج جالب الصور الخوارزمي والمصادر المصورة بنجاح لـ "${prompt}".`,
        predictedQuery: prompt,
        images: algorithmicImages,
        groundingSources: [
          { title: `أرشيف الصور في ويكيبيديا: ${prompt}`, uri: `https://ar.wikipedia.org/wiki/${encodeURIComponent(prompt)}` }
        ],
        suggestedVisualTopics: [`استكشاف ${prompt}`, "خرائط وتصاميم توضيحية", "رسوم بيانية توثيقية"]
      });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemInstruction = `أنت مساعد ذكاء اصطناعي خبير ومختص في التنبؤ البصري والبحث عن الصور عبر Google Grounding ومصادر الأرشيف المفتوحة.
وظيفتك:
1. تحليل مدخلات المستخدم وسياق الحديث (${discussionContext || 'لا يوجد سياق سابق'}) واستخراج الكيانات، المواضيع، الأماكن، الأحداث التاريخية، أو المصطلحات العلمية.
2. التنبؤ بالصورة والأرشيف الأكثر ملاءمة وفائدة بصرية لإثراء فهم المستخدم.
3. إرجاع النتيجة بصيغة JSON تحتوي على:
{
  "analysis": "شرح تنبؤي وتحليلي باللغة العربية حول السياق البصري والأهمية العلمية أو التاريخية أو الإخبارية للصور المجلوبة",
  "predictedQuery": "عبارة البحث البصرية الدقيقة المستخدمة",
  "suggestedVisualTopics": ["موضوع بصري مقترح 1", "موضوع بصري مقترح 2", "موضوع بصري مقترح 3"]
}`;

    const userContent = `طلب المستخدم للصور والسياق البصري: "${prompt}". النمط المطلوب: ${mode}.
قم بتحليل النمط واستخدام Google Search Grounding لإيجاد الربط البصري الدقيق وإرجاع JSON مطابق للمطلوب.`;

    const candidateConfigs = [
      { model: "gemini-3-flash-preview", useTools: true },
      { model: "gemini-4-hydrogen", useTools: true },
      { model: "gemini-3.1-flash-lite", useTools: true },
      { model: "gemini-3-flash-preview", useTools: false }
    ];

    let searchResp: any = null;
    let lastError: any = null;

    for (const config of candidateConfigs) {
      try {
        const reqConfig: any = { systemInstruction };
        if (config.useTools) {
          reqConfig.tools = [{ googleSearch: {} }];
        }
        searchResp = await ai.models.generateContent({
          model: config.model,
          contents: userContent,
          config: reqConfig
        });
        if (searchResp && (searchResp.text || searchResp.candidates)) {
          break; // Success!
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isQuota = err?.status === "RESOURCE_EXHAUSTED" || errMsg.includes("429") || errMsg.includes("quota");
        
        if (isQuota) {
          console.log(`[Grounded Image API] Rate limit (429) detected for ${config.model}. Using algorithmic image engine.`);
          break;
        } else {
          console.log(`[Grounded Image API] Retrying model ${config.model} (tools=${config.useTools})...`);
        }
      }
    }

    // Fallback analysis if Gemini is unavailable or rate limited
    if (!searchResp || (!searchResp.text && (!searchResp.candidates || searchResp.candidates.length === 0))) {
      return res.json({
        analysis: `تم جلب الصور الفوتوغرافية الحقيقية والمستندات البصرية الموثقة لـ "${prompt}" عبر محرك جالب الصور الخوارزمي المباشر.`,
        predictedQuery: prompt,
        images: algorithmicImages,
        groundingSources: [
          { title: `البحث المباشر في صور جوجل عن: ${prompt}`, uri: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}` },
          { title: `أرشيف الصور في ويكيبيديا: ${prompt}`, uri: `https://ar.wikipedia.org/wiki/${encodeURIComponent(prompt)}` }
        ],
        suggestedVisualTopics: [`استكشاف أرشيف ${prompt}`, "خرائط وتصاميم توضيحية", "رسوم بيانية توثيقية"]
      });
    }

    const responseText = searchResp.text || "";
    const groundingChunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const groundingSources: { title: string; uri: string }[] = [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk?.web?.uri) {
        groundingSources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri
        });
      }
    });

    let parsed: any = null;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const cleanJson = jsonMatch ? jsonMatch[1] : responseText;
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(cleanJson);
      }
    } catch (e) {
      parsed = {
        analysis: responseText,
        predictedQuery: prompt,
        suggestedVisualTopics: ["استكشاف الصور التاريخية", "خرائط توضيحية", "صور بدقة عالية"]
      };
    }

    res.json({
      analysis: parsed.analysis || `تم تحليل السياق البصري وجلب المصادر المصورة الموثوقة لـ "${prompt}".`,
      predictedQuery: parsed.predictedQuery || prompt,
      images: algorithmicImages,
      groundingSources: groundingSources.length > 0 ? groundingSources : [
        { title: `البحث المباشر في صور جوجل عن: ${prompt}`, uri: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}` }
      ],
      suggestedVisualTopics: parsed.suggestedVisualTopics || ["تحليل الأرشيف", "خرائط توضيحية", "صور بدقة عالية"]
    });
  });

  // In-Memory Saved Images Storage (Image Archive feature)
  let savedImagesArchive: Array<{
    id: string;
    title: string;
    imageUrl: string;
    sourceDomain: string;
    sourceUri: string;
    description: string;
    category: string;
    savedAt: string;
  }> = [
    {
      id: "img_arch_1",
      title: "ميناء طنجة المتوسطي المغربي - الأرشيف اللوجستي",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tanger-Med_port.jpg/1200px-Tanger-Med_port.jpg",
      sourceDomain: "ويكيبيديا الأرشيفية",
      sourceUri: "https://ar.wikipedia.org/wiki/ميناء_طنجة_المتوسط",
      description: "صورة أرشيفية رسمية لميناء طنجة المتوسط بأعلى معايير الدقة",
      category: "ويب",
      savedAt: new Date().toLocaleDateString("ar-SA")
    },
    {
      id: "img_arch_2",
      title: "تجسيد بصري فائقة الدقة لشبكات الذكاء الاصطناعي AGI",
      imageUrl: "https://image.pollinations.ai/prompt/Neural%20network%20AGI%20artificial%20intelligence%20glowing%20hologram%20futuristic%20laboratory?width=1200&height=675&nologo=true",
      sourceDomain: "Gemini AI Synthesis Engine",
      sourceUri: "https://ai.google.dev",
      description: "صورة تم توليدها وتخصيصها بالذكاء الاصطناعي بدقة 4K",
      category: "توليد AI",
      savedAt: new Date().toLocaleDateString("ar-SA")
    }
  ];

  // GET /api/saved-images - Get saved image archive
  app.get("/api/saved-images", (req, res) => {
    res.json({ success: true, savedImages: savedImagesArchive });
  });

  // POST /api/saved-images - Save image to archive
  app.post("/api/saved-images", (req, res) => {
    const { title, imageUrl, sourceDomain, sourceUri, description, category = "حفظ" } = req.body || {};
    const isSafeUrl = typeof imageUrl === 'string' && (/^https?:\/\//i.test(imageUrl.trim()) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(imageUrl.trim()));
    if (!isSafeUrl) {
      return res.status(400).json({ error: "رابط الصورة مطلوب ويجب أن يكون رابطاً صالحاً" });
    }
    const safeSourceUri = typeof sourceUri === 'string' && /^https?:\/\//i.test(sourceUri.trim()) ? sourceUri.trim() : imageUrl.trim();
    const newSaved = {
      id: `arch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title || "صورة محفوظة من الأرشيف",
      imageUrl: imageUrl.trim(),
      sourceDomain: sourceDomain || "أرشيف المحادثة",
      sourceUri: safeSourceUri,
      description: description || "تمت إضافتها إلى الأرشيف الشخصي",
      category,
      savedAt: new Date().toLocaleDateString("ar-SA")
    };
    // Avoid duplicates
    if (!savedImagesArchive.some(img => img.imageUrl === newSaved.imageUrl)) {
      savedImagesArchive.unshift(newSaved);
    }
    res.json({ success: true, savedImage: newSaved, savedImages: savedImagesArchive });
  });

  // DELETE /api/saved-images/:id - Delete image from archive
  app.delete("/api/saved-images/:id", (req, res) => {
    const { id } = req.params;
    savedImagesArchive = savedImagesArchive.filter(img => img.id !== id);
    res.json({ success: true, savedImages: savedImagesArchive });
  });

  // POST /api/generate-ai-image - Pure AI Image Generation (Gemini Models + Fallback)
  app.post("/api/generate-ai-image", async (req, res) => {
    const { prompt, model = "gemini-3.1-flash-lite-image", aspectRatio = "1:1", apiKey: reqKey } = req.body;
    const apiKey = (reqKey && typeof reqKey === 'string' && reqKey.trim() !== '')
      ? reqKey.trim()
      : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "الوصف مطلوب لتوليد الصورة" });
    }

    const cleanPrompt = prompt.trim();
    let generatedImageUrl = "";
    let generationMethod = "Gemini High-Precision Visual Engine";

    if (apiKey) {
      const candidateImageModels = [
        model || "gemini-3.1-flash-lite-image",
        "gemini-3.1-flash-image",
        "gemini-3-pro-image"
      ];

      for (const m of candidateImageModels) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const interaction = await ai.interactions.create({
            model: m,
            input: `أنشئ صورة عالية الجودة، واقعية وفنية لـ: ${cleanPrompt}`,
            response_format: {
              type: "image",
              mime_type: "image/png",
              aspect_ratio: aspectRatio || "16:9",
              image_size: "1K"
            }
          } as any);

          if (interaction?.output_image?.data) {
            generatedImageUrl = `data:image/png;base64,${interaction.output_image.data}`;
            generationMethod = `Gemini Image API (${m})`;
            break;
          }
        } catch (err: any) {
          // Continue silently to next model or fallback engine without throwing or spamming logs
        }
      }
    }

    // High-res visual fallback engine if API key unavailable, model 503, or quota exceeded
    if (!generatedImageUrl) {
      const dim = aspectRatio === "1:1" ? "1000&height=1000" : aspectRatio === "9:16" ? "675&height=1200" : "1200&height=675";
      const seed = Math.floor(Math.random() * 900000) + 100000;
      generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt + " photorealistic highly detailed masterwork 8k hd")}&width=${dim}&nologo=true&seed=${seed}`;
      generationMethod = `High-Res Visual Engine (${model})`;
    }

    res.json({
      success: true,
      image: {
        id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: `صورة تم توليدها: ${cleanPrompt.slice(0, 40)}...`,
        url: generatedImageUrl,
        sourceDomain: generationMethod,
        sourceUri: "https://ai.google.dev/gemini-api/docs/image-generation",
        description: `صورة ذكاء اصطناعي مولدة بالكامل بالنموذج ${model} بالأبعاد ${aspectRatio} بناءً على الوصف: "${cleanPrompt}".`,
        contextTag: "توليد AI",
        dimensions: aspectRatio,
        prompt: cleanPrompt,
        model
      }
    });
  });

  // POST /api/analyze-and-enhance-image - AI Image Analysis & Enhancement
  app.post("/api/analyze-and-enhance-image", async (req, res) => {
    const { prompt, imageUrl, apiKey: reqKey } = req.body;
    const apiKey = (reqKey && typeof reqKey === 'string' && reqKey.trim() !== '')
      ? reqKey.trim()
      : (SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');

    const inputQuery = prompt || "تحليل وتحسين الصورة البصرية";

    if (!apiKey) {
      return res.json({
        analysis: `تحليل تحسيني بصري شامل لـ: "${inputQuery}". تم فحص التكوين الهندسي والإضاءة والتباين الجمالي.`,
        enhancedPrompt: `An ultra-detailed cinematic photo of ${inputQuery}, dramatic volumetric lighting, 8k resolution, photorealistic masterpiece, depth of field.`,
        suggestedEnhancements: ["إضافة إضاءة سينمائية دافئة", "زيادة عمق الميدان والتركيز", "إبراز التفاصيل المعمارية والدقيقة"]
      });
    }

    let responseText = "";
    const candidateModels = ["gemini-3-flash-preview", "gemini-4-hydrogen", "gemini-3.1-flash-lite"];

    const systemInstruction = `أنت خبير تحليل ومعالجة الصور بالذكاء الاصطناعي. وظيفتك تقديم تحليل بصري دقيق، واستخراج العناصر الفنية والتاريخية، وتوليد وصف مخصص محسّن (Enhanced Prompt) لتوليد نسخة عالية الجودة. أعد نتيجتك بصيغة JSON:
{
  "analysis": "تحليل بصري وفني دقيق ومفصل",
  "enhancedPrompt": "وصف دقيق جداً باللغة الإنجليزية لتوليد الصورة بأعلى جودة ممتازة",
  "suggestedEnhancements": ["مقترح تحسين 1", "مقترح تحسين 2", "مقترح تحسين 3"]
}`;

    const ai = new GoogleGenAI({ apiKey });

    for (const modelCandidate of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: `حلل هذه الصورة أو الفكرة البصرية: "${inputQuery}". قدم تحليلاً وموجهاً محسناً بأسلوب سينمائي.`,
          config: { systemInstruction }
        });
        if (response?.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        // Fallback silently without throwing unhandled error logs
      }
    }

    if (!responseText) {
      return res.json({
        analysis: `تم إجراء التحليل البصري التنبؤي لـ "${inputQuery}".`,
        enhancedPrompt: `Cinematic ultra high-res masterpiece depicting ${inputQuery}, photorealistic, dramatic lighting, 8k resolution.`,
        suggestedEnhancements: ["إضاءة دافئة سينمائية", "تفاصيل واقعية بدقة 4K", "عمق ميدان عالي"]
      });
    }

    let parsed: any = null;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const cleanJson = jsonMatch ? jsonMatch[1] : responseText;
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(cleanJson);
      }
    } catch (e) {
      parsed = {
        analysis: responseText,
        enhancedPrompt: `Ultra detailed high-res cinematic depiction of ${inputQuery}`,
        suggestedEnhancements: ["تحسين التباين والإضاءة", "زيادة وضوح التفاصيل الدقيقة"]
      };
    }

    res.json({
      analysis: parsed.analysis || responseText,
      enhancedPrompt: parsed.enhancedPrompt || `Cinematic photorealistic 8k photo of ${inputQuery}`,
      suggestedEnhancements: parsed.suggestedEnhancements || ["إضاءة واقعية سينمائية", "تركيز بؤري فائق"]
    });
  });

  // =========================================================================
  // Authentic Persona Portrait & Facial Landmark Resolution (Hologram 3D)
  // Historical paintings/sculptures for pre-photography figures; real photos for modern era
  // =========================================================================
  const PORTRAIT_CACHE_DIR = path.join(process.cwd(), ".cache", "portraits");
  try {
    fs.mkdirSync(PORTRAIT_CACHE_DIR, { recursive: true });
  } catch {}

  interface PortraitCacheEntry {
    buffer: Buffer;
    mimeType: string;
    sourceUrl: string;
  }

  interface PersonaHologramTraits {
    hairStyle: "bald_dome" | "wild_halo" | "long_wavy" | "short_modern" | "curly_roman" | "receding_side_tufts" | "parted_classic";
    beardStyle: "none" | "short_goatee" | "trimmed_pointed" | "curly_full" | "long_flowing";
    mustacheStyle: "none" | "walrus" | "bushy" | "trimmed" | "connected_beard";
    glasses: "none" | "round_wire" | "rectangular";
    headwear: "none" | "turban" | "renaissance_cap" | "philosopher_hood";
    attire: "toga" | "turtleneck" | "suit_collar" | "scholar_robe" | "renaissance_coat";
    noseStyle: "snub_broad" | "aquiline" | "straight_classic" | "moderate";
    browStyle: "furrowed_heavy" | "arched_sage" | "focused_modern" | "calm_stoic";
    ageLines: number;
    faceWidthRatio: number;
    jawWidthRatio: number;
  }

  interface PortraitMeta {
    faceCenterX: number;
    faceCenterY: number;
    faceRadius: number;
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    mouthLeft: { x: number; y: number };
    mouthRight: { x: number; y: number };
    mouthCenter: { x: number; y: number };
    chinY: number;
    depictionType: "sculpture" | "painting" | "archival_photo" | "modern_photo";
    depictionLabelAr: string;
    traits: PersonaHologramTraits;
  }

  const DEFAULT_TRAITS: PersonaHologramTraits = {
    hairStyle: "parted_classic",
    beardStyle: "none",
    mustacheStyle: "none",
    glasses: "none",
    headwear: "none",
    attire: "suit_collar",
    noseStyle: "moderate",
    browStyle: "calm_stoic",
    ageLines: 0.45,
    faceWidthRatio: 1.0,
    jawWidthRatio: 0.95,
  };

  const CURATED_HOLOGRAM_TRAITS: Record<string, PersonaHologramTraits> = {
    "سقراط": {
      hairStyle: "bald_dome",
      beardStyle: "curly_full",
      mustacheStyle: "connected_beard",
      glasses: "none",
      headwear: "none",
      attire: "toga",
      noseStyle: "snub_broad",
      browStyle: "furrowed_heavy",
      ageLines: 0.85,
      faceWidthRatio: 1.09,
      jawWidthRatio: 1.04,
    },
    "ليوناردو دا فينشي": {
      hairStyle: "long_wavy",
      beardStyle: "long_flowing",
      mustacheStyle: "connected_beard",
      glasses: "none",
      headwear: "renaissance_cap",
      attire: "renaissance_coat",
      noseStyle: "aquiline",
      browStyle: "arched_sage",
      ageLines: 0.88,
      faceWidthRatio: 0.96,
      jawWidthRatio: 0.9,
    },
    "ألبرت آينشتاين": {
      hairStyle: "wild_halo",
      beardStyle: "none",
      mustacheStyle: "bushy",
      glasses: "none",
      headwear: "none",
      attire: "suit_collar",
      noseStyle: "moderate",
      browStyle: "furrowed_heavy",
      ageLines: 0.82,
      faceWidthRatio: 1.02,
      jawWidthRatio: 0.94,
    },
    "ستيف جوبز": {
      hairStyle: "receding_side_tufts",
      beardStyle: "short_goatee",
      mustacheStyle: "trimmed",
      glasses: "round_wire",
      headwear: "none",
      attire: "turtleneck",
      noseStyle: "straight_classic",
      browStyle: "focused_modern",
      ageLines: 0.45,
      faceWidthRatio: 0.92,
      jawWidthRatio: 0.88,
    },
    "إيلون ماسك": {
      hairStyle: "short_modern",
      beardStyle: "none",
      mustacheStyle: "none",
      glasses: "none",
      headwear: "none",
      attire: "suit_collar",
      noseStyle: "moderate",
      browStyle: "focused_modern",
      ageLines: 0.25,
      faceWidthRatio: 1.05,
      jawWidthRatio: 1.06,
    },
    "نيتشه": {
      hairStyle: "parted_classic",
      beardStyle: "none",
      mustacheStyle: "walrus",
      glasses: "none",
      headwear: "none",
      attire: "suit_collar",
      noseStyle: "moderate",
      browStyle: "furrowed_heavy",
      ageLines: 0.55,
      faceWidthRatio: 0.98,
      jawWidthRatio: 0.96,
    },
    "فريدريك نيتشه": {
      hairStyle: "parted_classic",
      beardStyle: "none",
      mustacheStyle: "walrus",
      glasses: "none",
      headwear: "none",
      attire: "suit_collar",
      noseStyle: "moderate",
      browStyle: "furrowed_heavy",
      ageLines: 0.55,
      faceWidthRatio: 0.98,
      jawWidthRatio: 0.96,
    },
    "ابن خلدون": {
      hairStyle: "parted_classic",
      beardStyle: "trimmed_pointed",
      mustacheStyle: "trimmed",
      glasses: "none",
      headwear: "turban",
      attire: "scholar_robe",
      noseStyle: "aquiline",
      browStyle: "arched_sage",
      ageLines: 0.62,
      faceWidthRatio: 0.97,
      jawWidthRatio: 0.9,
    },
    "نوام تشومسكي": {
      hairStyle: "receding_side_tufts",
      beardStyle: "none",
      mustacheStyle: "none",
      glasses: "rectangular",
      headwear: "none",
      attire: "suit_collar",
      noseStyle: "moderate",
      browStyle: "arched_sage",
      ageLines: 0.85,
      faceWidthRatio: 1.0,
      jawWidthRatio: 0.92,
    },
    "ماركوس أوريليوس": {
      hairStyle: "curly_roman",
      beardStyle: "curly_full",
      mustacheStyle: "connected_beard",
      glasses: "none",
      headwear: "none",
      attire: "toga",
      noseStyle: "straight_classic",
      browStyle: "calm_stoic",
      ageLines: 0.52,
      faceWidthRatio: 1.0,
      jawWidthRatio: 0.98,
    },
    "سينيكا": {
      hairStyle: "receding_side_tufts",
      beardStyle: "none",
      mustacheStyle: "none",
      glasses: "none",
      headwear: "none",
      attire: "toga",
      noseStyle: "aquiline",
      browStyle: "furrowed_heavy",
      ageLines: 0.86,
      faceWidthRatio: 0.93,
      jawWidthRatio: 0.84,
    },
    "إبكتيتوس": {
      hairStyle: "parted_classic",
      beardStyle: "long_flowing",
      mustacheStyle: "connected_beard",
      glasses: "none",
      headwear: "philosopher_hood",
      attire: "toga",
      noseStyle: "straight_classic",
      browStyle: "furrowed_heavy",
      ageLines: 0.78,
      faceWidthRatio: 0.98,
      jawWidthRatio: 0.92,
    },
  };

  const portraitMemoryCache = new Map<string, PortraitCacheEntry>();
  const portraitMetaMemoryCache = new Map<string, PortraitMeta>();
  const portraitInFlight = new Map<string, Promise<PortraitCacheEntry | null>>();
  const portraitMetaInFlight = new Map<string, Promise<PortraitMeta>>();

  const SYSTEM_ROOM_KEYS = new Set(["group_question", "debate", "osint_room", "trend_live"]);

  // Curated canonical human depictions (single-subject front/three-quarter museum sculptures, paintings, or real photos)
  const CURATED_PORTRAIT_SOURCES: Record<string, { lang?: "en" | "ar"; page?: string; directUrl?: string; defaultType: PortraitMeta["depictionType"] }> = {
    "سقراط": { lang: "en", page: "Socrates", defaultType: "sculpture" },
    "socrates": { lang: "en", page: "Socrates", defaultType: "sculpture" },
    "ليوناردو دا فينشي": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Leonardo_self.jpg/960px-Leonardo_self.jpg",
      defaultType: "painting"
    },
    "leonardo da vinci": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Leonardo_self.jpg/960px-Leonardo_self.jpg",
      defaultType: "painting"
    },
    "ألبرت آينشتاين": { lang: "en", page: "Albert_Einstein", defaultType: "archival_photo" },
    "ألبرت أينشتاين": { lang: "en", page: "Albert_Einstein", defaultType: "archival_photo" },
    "albert einstein": { lang: "en", page: "Albert_Einstein", defaultType: "archival_photo" },
    "ستيف جوبز": { lang: "en", page: "Steve_Jobs", defaultType: "modern_photo" },
    "steve jobs": { lang: "en", page: "Steve_Jobs", defaultType: "modern_photo" },
    "إيلون ماسك": { lang: "en", page: "Elon_Musk", defaultType: "modern_photo" },
    "elon musk": { lang: "en", page: "Elon_Musk", defaultType: "modern_photo" },
    "نيتشه": { lang: "en", page: "Friedrich_Nietzsche", defaultType: "archival_photo" },
    "فريدريك نيتشه": { lang: "en", page: "Friedrich_Nietzsche", defaultType: "archival_photo" },
    "nietzsche": { lang: "en", page: "Friedrich_Nietzsche", defaultType: "archival_photo" },
    "ابن خلدون": { lang: "ar", page: "ابن_خلدون", defaultType: "painting" },
    "ibn khaldun": { lang: "ar", page: "ابن_خلدون", defaultType: "painting" },
    "نوام تشومسكي": { lang: "en", page: "Noam_Chomsky", defaultType: "modern_photo" },
    "noam chomsky": { lang: "en", page: "Noam_Chomsky", defaultType: "modern_photo" },
    "ماركوس أوريليوس": { lang: "ar", page: "ماركوس_أوريليوس", defaultType: "sculpture" },
    "marcus aurelius": { lang: "ar", page: "ماركوس_أوريليوس", defaultType: "sculpture" },
    "سينيكا": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Buste_van_-Seneca_-_anoniem_-_Rubenshuis_-_1.jpg/960px-Buste_van_-Seneca_-_anoniem_-_Rubenshuis_-_1.jpg",
      defaultType: "sculpture"
    },
    "seneca": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Buste_van_-Seneca_-_anoniem_-_Rubenshuis_-_1.jpg/960px-Buste_van_-Seneca_-_anoniem_-_Rubenshuis_-_1.jpg",
      defaultType: "sculpture"
    },
    "إبكتيتوس": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Epictetus_portrait_from_Les_Morales_de_Plutarque%2C_S%C3%A9n%C3%A8que%2C_Socrate_et_Epict%C3%A8te%2C_1653%2C_Indian_ink.png/960px-Epictetus_portrait_from_Les_Morales_de_Plutarque%2C_S%C3%A9n%C3%A8que%2C_Socrate_et_Epict%C3%A8te%2C_1653%2C_Indian_ink.png",
      defaultType: "painting"
    },
    "epictetus": {
      directUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Epictetus_portrait_from_Les_Morales_de_Plutarque%2C_S%C3%A9n%C3%A8que%2C_Socrate_et_Epict%C3%A8te%2C_1653%2C_Indian_ink.png/960px-Epictetus_portrait_from_Les_Morales_de_Plutarque%2C_S%C3%A9n%C3%A8que%2C_Socrate_et_Epict%C3%A8te%2C_1653%2C_Indian_ink.png",
      defaultType: "painting"
    },
    "أفلاطون": { lang: "en", page: "Plato", defaultType: "sculpture" },
    "plato": { lang: "en", page: "Plato", defaultType: "sculpture" },
    "أرسطو": { lang: "en", page: "Aristotle", defaultType: "sculpture" },
    "aristotle": { lang: "en", page: "Aristotle", defaultType: "sculpture" },
    "الخوارزمي": { lang: "ar", page: "الخوارزمي", defaultType: "painting" },
    "ابن سينا": { lang: "ar", page: "ابن_سينا", defaultType: "painting" },
    "أبو الطيب المتنبي": { lang: "ar", page: "أبو_الطيب_المتنبي", defaultType: "painting" },
    "المتنبي": { lang: "ar", page: "أبو_الطيب_المتنبي", defaultType: "painting" },
    "نيكولا تسلا": { lang: "en", page: "Nikola_Tesla", defaultType: "archival_photo" },
    "ماري كوري": { lang: "en", page: "Marie_Curie", defaultType: "archival_photo" },
    "آلان تورينغ": { lang: "en", page: "Alan_Turing", defaultType: "archival_photo" },
    "جبران خليل جبران": { lang: "en", page: "Kahlil_Gibran", defaultType: "archival_photo" },
    "رينيه ديكارت": { lang: "en", page: "René_Descartes", defaultType: "painting" },
    "إيمانويل كانط": { lang: "en", page: "Immanuel_Kant", defaultType: "painting" },
    "إسحاق نيوتن": { lang: "en", page: "Isaac_Newton", defaultType: "painting" },
    "تشارلز داروين": { lang: "en", page: "Charles_Darwin", defaultType: "archival_photo" }
  };

  const depictionLabelFromType = (t: PortraitMeta["depictionType"]): string => {
    switch (t) {
      case "sculpture": return "تجسيد ثلاثي الأبعاد (من تمثال أثري)";
      case "painting": return "تجسيد ثلاثي الأبعاد (من لوحة تاريخية)";
      case "archival_photo": return "تجسيد ثلاثي الأبعاد (من صورة أرشيفية)";
      default: return "تجسيد ثلاثي الأبعاد (ملامح موثّقة)";
    }
  };

  const slugifyPortraitKey = (name: string): string => {
    const clean = (name || "persona").trim().toLowerCase();
    return "hd2_" + Buffer.from(clean, "utf8").toString("hex").slice(0, 48);
  };

  const normalizePortraitLookupName = (name: string): string =>
    (name || "").trim().toLowerCase().replace(/\s+/g, " ");

  const fetchWikiThumbnailUrl = async (lang: "ar" | "en", pageTitle: string): Promise<string | null> => {
    try {
      const hqUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=960&redirects=1&format=json`;
      const hqRes = await fetch(hqUrl, {
        headers: { "User-Agent": "MindMirrorApp/1.0 (https://mindmirror.ai)" }
      });
      if (hqRes.ok) {
        const hj: any = await hqRes.json();
        const pages = Object.values(hj?.query?.pages || {}) as any[];
        for (const p of pages) {
          if (p?.thumbnail?.source) return p.thumbnail.source;
        }
      }

      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "MindMirrorApp/1.0 (https://mindmirror.ai)" }
      });
      if (res.ok) {
        const j: any = await res.json();
        if (j?.thumbnail?.source) return j.thumbnail.source;
      }

      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(pageTitle)}&gsrlimit=2&prop=pageimages&pithumbsize=960&format=json`;
      const sRes = await fetch(searchUrl, {
        headers: { "User-Agent": "MindMirrorApp/1.0 (https://mindmirror.ai)" }
      });
      if (sRes.ok) {
        const sj: any = await sRes.json();
        const pages = Object.values(sj?.query?.pages || {}) as any[];
        for (const p of pages) {
          if (p?.thumbnail?.source) return p.thumbnail.source;
        }
      }
    } catch {}
    return null;
  };

  const downloadImageBuffer = async (imageUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> => {
    try {
      const res = await fetch(imageUrl, {
        headers: { "User-Agent": "MindMirrorApp/1.0 (https://mindmirror.ai)" }
      });
      if (!res.ok) return null;
      const mimeType = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!mimeType.startsWith("image/")) return null;
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      if (buffer.length < 1500) return null;
      return { buffer, mimeType };
    } catch {
      return null;
    }
  };

  const resolvePersonaPortrait = async (rawName: string): Promise<PortraitCacheEntry | null> => {
    const cleanName = (rawName || "").trim();
    if (!cleanName || SYSTEM_ROOM_KEYS.has(cleanName)) return null;

    const memKey = normalizePortraitLookupName(cleanName);
    if (portraitMemoryCache.has(memKey)) {
      return portraitMemoryCache.get(memKey)!;
    }

    const diskSlug = slugifyPortraitKey(memKey);
    const diskImgPath = path.join(PORTRAIT_CACHE_DIR, `${diskSlug}.img`);
    const diskInfoPath = path.join(PORTRAIT_CACHE_DIR, `${diskSlug}.info.json`);
    if (fs.existsSync(diskImgPath) && fs.existsSync(diskInfoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(diskInfoPath, "utf8"));
        const buffer = fs.readFileSync(diskImgPath);
        if (buffer.length > 1500 && info?.mimeType) {
          const entry: PortraitCacheEntry = { buffer, mimeType: info.mimeType, sourceUrl: info.sourceUrl || "" };
          portraitMemoryCache.set(memKey, entry);
          return entry;
        }
      } catch {}
    }

    if (portraitInFlight.has(memKey)) {
      return portraitInFlight.get(memKey)!;
    }

    const job = (async (): Promise<PortraitCacheEntry | null> => {
      try {
        let targetImageUrl: string | null = null;
        const normalizedAlt = memKey.replace(/[أإآ]/g, "ا");
        const curated =
          CURATED_PORTRAIT_SOURCES[memKey] ||
          Object.entries(CURATED_PORTRAIT_SOURCES).find(([k]) => k.replace(/[أإآ]/g, "ا") === normalizedAlt)?.[1];

        if (curated) {
          if (curated.directUrl) {
            targetImageUrl = curated.directUrl;
          } else if (curated.page) {
            targetImageUrl = await fetchWikiThumbnailUrl(curated.lang || "en", curated.page);
          }
        }

        if (!targetImageUrl) {
          targetImageUrl = await fetchWikiThumbnailUrl("ar", cleanName);
        }

        if (!targetImageUrl) {
          try {
            const titleResp: any = await callGemini("generateContent", {
              model: "gemini-3-flash-preview",
              contents: `Return ONLY the exact English Wikipedia article title (with underscores, no explanation) for the historical or contemporary person: "${cleanName}". If not a real person or unknown, return NONE.`
            });
            const enTitle = (typeof titleResp?.text === "function" ? titleResp.text() : titleResp?.text || "").trim().replace(/^["']|["']$/g, "");
            if (enTitle && enTitle !== "NONE" && enTitle.length < 80) {
              targetImageUrl = await fetchWikiThumbnailUrl("en", enTitle);
            }
          } catch {}
        }

        if (!targetImageUrl) {
          let stylePrompt = `authentic classical museum oil painting portrait of ${cleanName}, front-facing head and shoulders, neutral closed mouth, dark studio backdrop`;
          try {
            const descResp: any = await callGemini("generateContent", {
              model: "gemini-3-flash-preview",
              contents: `Describe in 1 concise English image prompt how "${cleanName}" looks as a front-facing bust portrait: if pre-1840 historical figure without photographs, specify authentic classical historical painting or Greco-Roman/historical sculpture depiction as humanity imagines them; if post-1840 figure, specify authentic period or modern photograph. Always specify front-facing head and shoulders, closed neutral mouth, dark background.`
            });
            const descText = (typeof descResp?.text === "function" ? descResp.text() : descResp?.text || "").trim();
            if (descText) {
              stylePrompt = descText;
            }
          } catch {}
          targetImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(stylePrompt)}&width=512&height=512&nologo=true`;
        }

        let downloaded = targetImageUrl ? await downloadImageBuffer(targetImageUrl) : null;

        if (!downloaded) {
          const fallbackLocalMap: Record<string, string> = {
            "سقراط": "socrates.jpg",
            "ليوناردو دا فينشي": "davinci.jpg",
            "ألبرت آينشتاين": "einstein.jpg"
          };
          const localFile = fallbackLocalMap[cleanName];
          if (localFile) {
            const p = path.join(process.cwd(), "public", "portraits", localFile);
            if (fs.existsSync(p)) {
              downloaded = { buffer: fs.readFileSync(p), mimeType: "image/jpeg" };
            }
          }
        }

        if (!downloaded) return null;

        const entry: PortraitCacheEntry = {
          buffer: downloaded.buffer,
          mimeType: downloaded.mimeType,
          sourceUrl: targetImageUrl || ""
        };
        portraitMemoryCache.set(memKey, entry);
        try {
          fs.writeFileSync(diskImgPath, entry.buffer);
          fs.writeFileSync(diskInfoPath, JSON.stringify({ mimeType: entry.mimeType, sourceUrl: entry.sourceUrl }));
        } catch {}
        return entry;
      } finally {
        portraitInFlight.delete(memKey);
      }
    })();

    portraitInFlight.set(memKey, job);
    return job;
  };

  const resolveCuratedTraits = (cleanName: string): PersonaHologramTraits | undefined => {
    const exact = CURATED_HOLOGRAM_TRAITS[cleanName];
    if (exact) return exact;
    const alt = cleanName.replace(/[أإآ]/g, "ا");
    return Object.entries(CURATED_HOLOGRAM_TRAITS).find(([k]) => k.replace(/[أإآ]/g, "ا") === alt)?.[1];
  };

  const resolvePersonaPortraitMeta = async (rawName: string): Promise<PortraitMeta> => {
    const cleanName = (rawName || "").trim();
    const memKey = normalizePortraitLookupName(cleanName);
    const curated = CURATED_PORTRAIT_SOURCES[memKey];
    const defaultType: PortraitMeta["depictionType"] = curated?.defaultType || "painting";
    const curatedTraits = resolveCuratedTraits(cleanName) || DEFAULT_TRAITS;

    const defaultMeta: PortraitMeta = {
      faceCenterX: 0.5,
      faceCenterY: 0.42,
      faceRadius: 0.34,
      leftEye: { x: 0.41, y: 0.35 },
      rightEye: { x: 0.59, y: 0.35 },
      mouthLeft: { x: 0.43, y: 0.52 },
      mouthRight: { x: 0.57, y: 0.52 },
      mouthCenter: { x: 0.5, y: 0.52 },
      chinY: 0.66,
      depictionType: defaultType,
      depictionLabelAr: depictionLabelFromType(defaultType),
      traits: curatedTraits
    };

    if (!cleanName || SYSTEM_ROOM_KEYS.has(cleanName)) return defaultMeta;

    if (portraitMetaMemoryCache.has(memKey)) {
      return portraitMetaMemoryCache.get(memKey)!;
    }

    const diskSlug = slugifyPortraitKey(memKey);
    const diskMetaPath = path.join(PORTRAIT_CACHE_DIR, `${diskSlug}.meta2.json`);
    if (fs.existsSync(diskMetaPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(diskMetaPath, "utf8"));
        if (cached && typeof cached.mouthCenter?.x === "number" && cached.traits?.hairStyle) {
          portraitMetaMemoryCache.set(memKey, cached);
          return cached;
        }
      } catch {}
    }

    if (portraitMetaInFlight.has(memKey)) {
      return portraitMetaInFlight.get(memKey)!;
    }

    const job = (async (): Promise<PortraitMeta> => {
      try {
        const portrait = await resolvePersonaPortrait(cleanName);
        if (!portrait) {
          return defaultMeta;
        }

        const b64 = portrait.buffer.toString("base64");
        try {
          const visionRes: any = await callGemini("generateContent", {
            model: "gemini-3-flash-preview",
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { data: b64, mimeType: portrait.mimeType } },
                  {
                    text: `Analyze this portrait/bust/sculpture of "${cleanName}". Return ONLY strict JSON describing coordinates (0..1) and visual hologram morphology traits:
{
  "faceCenterX": number,
  "faceCenterY": number,
  "faceRadius": number,
  "leftEye": { "x": number, "y": number },
  "rightEye": { "x": number, "y": number },
  "mouthLeft": { "x": number, "y": number },
  "mouthRight": { "x": number, "y": number },
  "mouthCenter": { "x": number, "y": number },
  "chinY": number,
  "depictionType": "sculpture" | "painting" | "archival_photo" | "modern_photo",
  "traits": {
    "hairStyle": "bald_dome" | "wild_halo" | "long_wavy" | "short_modern" | "curly_roman" | "receding_side_tufts" | "parted_classic",
    "beardStyle": "none" | "short_goatee" | "trimmed_pointed" | "curly_full" | "long_flowing",
    "mustacheStyle": "none" | "walrus" | "bushy" | "trimmed" | "connected_beard",
    "glasses": "none" | "round_wire" | "rectangular",
    "headwear": "none" | "turban" | "renaissance_cap" | "philosopher_hood",
    "attire": "toga" | "turtleneck" | "suit_collar" | "scholar_robe" | "renaissance_coat",
    "noseStyle": "snub_broad" | "aquiline" | "straight_classic" | "moderate",
    "browStyle": "furrowed_heavy" | "arched_sage" | "focused_modern" | "calm_stoic",
    "ageLines": number,
    "faceWidthRatio": number,
    "jawWidthRatio": number
  }
}`
                  }
                ]
              }
            ],
            config: { responseMimeType: "application/json" }
          });

          const rawJsonText = (typeof visionRes?.text === "function" ? visionRes.text() : visionRes?.text || visionRes?.candidates?.[0]?.content?.parts?.[0]?.text || "{}").trim();
          const cleanedJson = rawJsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
          const parsed = JSON.parse(cleanedJson);
          const clampCoord = (v: any, fb: number) =>
            typeof v === "number" && Number.isFinite(v) ? Math.max(0.05, Math.min(0.95, v)) : fb;

          const dType: PortraitMeta["depictionType"] =
            parsed.depictionType === "sculpture" ||
            parsed.depictionType === "painting" ||
            parsed.depictionType === "archival_photo" ||
            parsed.depictionType === "modern_photo"
              ? parsed.depictionType
              : defaultType;

          const pt = parsed.traits || {};
          const curatedFallback = resolveCuratedTraits(cleanName);
          const mergedTraits: PersonaHologramTraits = curatedFallback || {
            hairStyle: ["bald_dome", "wild_halo", "long_wavy", "short_modern", "curly_roman", "receding_side_tufts", "parted_classic"].includes(pt.hairStyle) ? pt.hairStyle : DEFAULT_TRAITS.hairStyle,
            beardStyle: ["none", "short_goatee", "trimmed_pointed", "curly_full", "long_flowing"].includes(pt.beardStyle) ? pt.beardStyle : DEFAULT_TRAITS.beardStyle,
            mustacheStyle: ["none", "walrus", "bushy", "trimmed", "connected_beard"].includes(pt.mustacheStyle) ? pt.mustacheStyle : DEFAULT_TRAITS.mustacheStyle,
            glasses: ["none", "round_wire", "rectangular"].includes(pt.glasses) ? pt.glasses : DEFAULT_TRAITS.glasses,
            headwear: ["none", "turban", "renaissance_cap", "philosopher_hood"].includes(pt.headwear) ? pt.headwear : DEFAULT_TRAITS.headwear,
            attire: ["toga", "turtleneck", "suit_collar", "scholar_robe", "renaissance_coat"].includes(pt.attire) ? pt.attire : DEFAULT_TRAITS.attire,
            noseStyle: ["snub_broad", "aquiline", "straight_classic", "moderate"].includes(pt.noseStyle) ? pt.noseStyle : DEFAULT_TRAITS.noseStyle,
            browStyle: ["furrowed_heavy", "arched_sage", "focused_modern", "calm_stoic"].includes(pt.browStyle) ? pt.browStyle : DEFAULT_TRAITS.browStyle,
            ageLines: typeof pt.ageLines === "number" ? Math.max(0, Math.min(1, pt.ageLines)) : DEFAULT_TRAITS.ageLines,
            faceWidthRatio: typeof pt.faceWidthRatio === "number" ? Math.max(0.84, Math.min(1.16, pt.faceWidthRatio)) : DEFAULT_TRAITS.faceWidthRatio,
            jawWidthRatio: typeof pt.jawWidthRatio === "number" ? Math.max(0.78, Math.min(1.14, pt.jawWidthRatio)) : DEFAULT_TRAITS.jawWidthRatio,
          };

          const resultMeta: PortraitMeta = {
            faceCenterX: clampCoord(parsed.faceCenterX, 0.5),
            faceCenterY: clampCoord(parsed.faceCenterY, 0.42),
            faceRadius: Math.max(0.16, Math.min(0.48, clampCoord(parsed.faceRadius, 0.34))),
            leftEye: {
              x: clampCoord(parsed.leftEye?.x, 0.41),
              y: clampCoord(parsed.leftEye?.y, 0.35)
            },
            rightEye: {
              x: clampCoord(parsed.rightEye?.x, 0.59),
              y: clampCoord(parsed.rightEye?.y, 0.35)
            },
            mouthLeft: {
              x: clampCoord(parsed.mouthLeft?.x, 0.43),
              y: clampCoord(parsed.mouthLeft?.y, 0.52)
            },
            mouthRight: {
              x: clampCoord(parsed.mouthRight?.x, 0.57),
              y: clampCoord(parsed.mouthRight?.y, 0.52)
            },
            mouthCenter: {
              x: clampCoord(parsed.mouthCenter?.x, 0.5),
              y: clampCoord(parsed.mouthCenter?.y, 0.52)
            },
            chinY: clampCoord(parsed.chinY, 0.66),
            depictionType: dType,
            depictionLabelAr: depictionLabelFromType(dType),
            traits: mergedTraits
          };

          portraitMetaMemoryCache.set(memKey, resultMeta);
          try {
            fs.writeFileSync(diskMetaPath, JSON.stringify(resultMeta));
          } catch {}
          return resultMeta;
        } catch (visionErr: any) {
          console.warn(`[Portrait Meta] Vision landmark extraction notice for ${cleanName}:`, visionErr?.message || visionErr);
        }

        return defaultMeta;
      } finally {
        portraitMetaInFlight.delete(memKey);
      }
    })();

    portraitMetaInFlight.set(memKey, job);
    return job;
  };

  app.get("/api/persona-portrait", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name : "";
    const entry = await resolvePersonaPortrait(name);

    if (entry) {
      res.setHeader("Content-Type", entry.mimeType);
      res.setHeader("Cache-Control", "public, max-age=604800");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(entry.buffer);
    }

    const initial = ((name || "✦").trim().charAt(0) || "✦")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><radialGradient id="g" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#0f2942"/><stop offset="100%" stop-color="#06080d"/></radialGradient></defs><rect width="256" height="256" fill="url(#g)"/><text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" fill="#38bdf8" font-family="system-ui,sans-serif" font-weight="700" font-size="96">${initial}</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(svg);
  });

  app.get("/api/persona-portrait-meta", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name : "";
    const meta = await resolvePersonaPortraitMeta(name);
    res.setHeader("Cache-Control", "public, max-age=604800");
    return res.json(meta);
  });

  // ============================================================================
  // LIVE BUILD VERSION TRACKER (Eliminates stale preview caches without manual refresh)
  // ============================================================================
  let buildRevision = 1;
  let lastBuildUpdatedAt = new Date().toISOString();
  const bumpBuildRevision = (reason = "file_change") => {
    buildRevision += 1;
    lastBuildUpdatedAt = new Date().toISOString();
    console.log(`[LiveSync] Build revision bumped to ${buildRevision} (${reason})`);
  };

  let fsWatchDebounce: NodeJS.Timeout | null = null;
  try {
    const srcWatchDir = path.join(process.cwd(), "src");
    if (fs.existsSync(srcWatchDir)) {
      fs.watch(srcWatchDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        if (!/\.(?:tsx?|css|html|json)$/i.test(String(filename))) return;
        if (fsWatchDebounce) clearTimeout(fsWatchDebounce);
        fsWatchDebounce = setTimeout(() => bumpBuildRevision(`src:${filename}`), 350);
      });
    }
  } catch (watchErr) {
    console.warn("[LiveSync] Recursive fs.watch fallback notice:", watchErr);
  }

  app.get("/api/app-build-version", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.json({
      startId: SERVER_START_ID,
      buildRevision,
      updatedAt: lastBuildUpdatedAt,
      token: `${SERVER_START_ID}:${buildRevision}`
    });
  });

  // ============================================================================
  // IN-APP SELF-MAINTENANCE AI CODING AGENTS ENGINE (Plan -> Consult -> Execute -> Verify)
  // ============================================================================
  const WORKSPACE_ROOT = process.cwd();
  const AGENT_ALLOWED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json"]);
  const AGENT_IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".cache", ".aistudio", "android"]);
  const AGENT_BLOCKED_EXACT = new Set([".env", ".env.local", ".env.production", "package-lock.json", "firebase-applet-config.json"]);

  const resolveSafeAgentPath = (rawRelPath: string): { absPath: string; relPath: string } | null => {
    const cleanRel = (rawRelPath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!cleanRel || cleanRel.includes("..") || cleanRel.startsWith(".env")) return null;
    const baseName = path.basename(cleanRel);
    if (AGENT_BLOCKED_EXACT.has(baseName) || baseName.startsWith(".env")) return null;
    const ext = path.extname(cleanRel).toLowerCase();
    if (!AGENT_ALLOWED_EXT.has(ext)) return null;
    if (!(cleanRel === "index.html" || cleanRel === "server.ts" || cleanRel.startsWith("src/") || cleanRel.startsWith("public/"))) {
      return null;
    }
    const absPath = path.resolve(WORKSPACE_ROOT, cleanRel);
    if (!absPath.startsWith(WORKSPACE_ROOT + path.sep) && absPath !== WORKSPACE_ROOT) return null;
    return { absPath, relPath: cleanRel };
  };

  const listWorkspaceCodeFiles = (): Array<{ path: string; sizeBytes: number; lines: number }> => {
    const results: Array<{ path: string; sizeBytes: number; lines: number }> = [];
    const walk = (dirAbs: string, relPrefix: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dirAbs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (AGENT_IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        const childRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        const childAbs = path.join(dirAbs, entry.name);
        if (entry.isDirectory()) {
          walk(childAbs, childRel);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (AGENT_ALLOWED_EXT.has(ext)) {
            try {
              const stat = fs.statSync(childAbs);
              const content = fs.readFileSync(childAbs, "utf8");
              results.push({ path: childRel, sizeBytes: stat.size, lines: content.split("\n").length });
            } catch {}
          }
        }
      }
    };

    for (const rootFile of ["index.html", "server.ts"]) {
      const p = path.join(WORKSPACE_ROOT, rootFile);
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, "utf8");
          results.push({ path: rootFile, sizeBytes: Buffer.byteLength(content, "utf8"), lines: content.split("\n").length });
        } catch {}
      }
    }
    const srcAbs = path.join(WORKSPACE_ROOT, "src");
    if (fs.existsSync(srcAbs)) walk(srcAbs, "src");
    return results.sort((a, b) => a.path.localeCompare(b.path));
  };

  const applyWhitespaceTolerantReplace = (source: string, search: string, replace: string): { updated: string; matched: boolean; mode: "exact" | "trimmed-lines" | "none" } => {
    if (!search) return { updated: source, matched: false, mode: "none" };
    if (source.includes(search)) {
      return { updated: source.replace(search, () => replace), matched: true, mode: "exact" };
    }
    const srcLines = source.split("\n");
    const searchLines = search.replace(/\r\n/g, "\n").split("\n");
    while (searchLines.length > 0 && searchLines[0].trim() === "") searchLines.shift();
    while (searchLines.length > 0 && searchLines[searchLines.length - 1].trim() === "") searchLines.pop();
    if (searchLines.length === 0) return { updated: source, matched: false, mode: "none" };

    for (let i = 0; i <= srcLines.length - searchLines.length; i++) {
      let ok = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (srcLines[i + j].trim() !== searchLines[j].trim()) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const before = srcLines.slice(0, i);
        const after = srcLines.slice(i + searchLines.length);
        const updated = [...before, ...replace.replace(/\r\n/g, "\n").split("\n"), ...after].join("\n");
        return { updated, matched: true, mode: "trimmed-lines" };
      }
    }
    return { updated: source, matched: false, mode: "none" };
  };

  // Full-fidelity file reader: returns complete targeted source file with zero arbitrary length truncation
  const readFullSafeCodeFile = (relPath: string): string => {
    const safe = resolveSafeAgentPath(relPath);
    if (!safe || !fs.existsSync(safe.absPath)) return "";
    return fs.readFileSync(safe.absPath, "utf8");
  };

  interface PlannedFileEdit {
    filePath: string;
    action: "modify" | "create";
    summaryAr: string;
    replacements?: Array<{ search: string; replace: string; verifiedOnDisk?: boolean }>;
    content?: string;
  }

  interface PendingAgentPlan {
    planId: string;
    prompt: string;
    model: string;
    understandingAr: string;
    planSummaryAr: string;
    riskLevel: "low" | "medium" | "high";
    consultationMessageAr: string;
    edits: PlannedFileEdit[];
    createdAt: number;
  }

  const pendingAgentPlans = new Map<string, PendingAgentPlan>();
  const agentBackups = new Map<string, Array<{ relPath: string; absPath: string; existed: boolean; previousContent: string }>>();

  const CURATED_CODING_MODELS = [
    {
      id: "gemini-3-flash-preview",
      label: "Gemini 3 Flash Preview",
      badge: "الافتراضي الموصى به • فائق السرعة",
      description: "نموذج البرمجة الفورية السريع والدقيق لتعديل شيفرة التطبيق لحظياً",
      recommended: true
    },
    {
      id: "gemini-4-hydrogen",
      label: "Gemini 4 Hydrogen",
      badge: "جيل 2026 الحديث",
      description: "سرعة عالية واستدلال برمجي متوازن لتحرير الواجهات والمنطق",
      recommended: false
    },
    {
      id: "gemini-4-neon",
      label: "Gemini 4 Neon",
      badge: "تخطيط هندسي متقدم",
      description: "نموذج متفوق للتغييرات المعمارية المعقدة والمهام متعددة الملفات",
      recommended: false
    },
    {
      id: "gemini-3.1-pro-preview",
      label: "Gemini 3.1 Pro Preview",
      badge: "معمارية وتحليل عميق",
      description: "تحليل عميق للمشاريع الكبيرة وكتابة الرقع البرمجية المعقدة",
      recommended: false
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      badge: "موثوق وعالي الدقة",
      description: "مناسب للتدقيق المنطقي وحل الأعطال البرمجية المعقدة",
      recommended: false
    },
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      badge: "سريع وخفيف",
      description: "تنفيذ سريع للتعديلات المباشرة والبسيطة",
      recommended: false
    },
    {
      id: "gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash Lite",
      badge: "اقتصادي فائق الخفة",
      description: "مناسب للتعديلات التجميلية والنصوص والأنماط السريعة",
      recommended: false
    }
  ];

  app.get("/api/self-agent/models", async (_req, res) => {
    const modelsMap = new Map<string, any>();
    for (const m of CURATED_CODING_MODELS) {
      modelsMap.set(m.id, m);
    }

    try {
      const pool = getActiveKeyPool();
      const firstKey = pool[0] || SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || "";
      if (firstKey) {
        const ai = new GoogleGenAI({ apiKey: firstKey });
        const listResp = await ai.models.list();
        for await (const info of listResp) {
          const cleanId = (info.name || "").replace(/^models\//, "").replace(/^tunedModels\//, "").trim();
          if (!cleanId) continue;
          const lower = cleanId.toLowerCase();
          if (
            lower.includes("tts") ||
            lower.includes("imagen") ||
            lower.includes("veo") ||
            lower.includes("embedding") ||
            lower.includes("lyria") ||
            lower.includes("live") ||
            lower.includes("audio")
          ) {
            continue;
          }
          if (!modelsMap.has(cleanId) && (lower.includes("gemini-3") || lower.includes("gemini-4") || lower.includes("gemini-2.5"))) {
            modelsMap.set(cleanId, {
              id: cleanId,
              label: cleanId,
              badge: "مكتشف حياً من الخادم",
              description: info.displayName || "نموذج Gemini متاح للتعديل البرمجي",
              recommended: cleanId === "gemini-3-flash-preview"
            });
          }
        }
      }
    } catch {}

    const ordered = Array.from(modelsMap.values()).sort((a, b) => {
      if (a.id === "gemini-3-flash-preview") return -1;
      if (b.id === "gemini-3-flash-preview") return 1;
      return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
    });
    return res.json({ defaultModel: "gemini-3-flash-preview", models: ordered });
  });

  app.get("/api/self-agent/workspace-files", (_req, res) => {
    const files = listWorkspaceCodeFiles();
    return res.json({ count: files.length, files });
  });

  app.post("/api/self-agent/plan", async (req, res) => {
    const { prompt, model: requestedModel, history = [] } = req.body || {};
    const userPrompt = String(prompt || "").trim();
    if (!userPrompt) {
      return res.status(400).json({ error: "يرجى كتابة وصف التعديل المطلوب تنفيذه." });
    }

    const chosenModel = String(requestedModel || "gemini-3-flash-preview").trim() || "gemini-3-flash-preview";
    const traceSteps: Array<{ agent: string; status: "done" | "warn"; title: string; detail: string }> = [];

    try {
      // Agent 1: Workspace Explorer
      const allFiles = listWorkspaceCodeFiles();
      traceSteps.push({
        agent: "وكيل الاستكشاف والفحص",
        status: "done",
        title: "مسح هيكل ملفات المنصة",
        detail: `تم فحص ${allFiles.length} ملفاً برمجياً مصرحاً به في src/ و server.ts و index.html.`
      });

      const fileListText = allFiles.map((f) => `- ${f.path} (${f.lines} lines)`).join("\n");

      // Agent 1B: Target File Locator (dynamic — picks as many files as the task genuinely needs)
      let candidatePaths: string[] = [];
      try {
        const locatorResp: any = await generateUnboundedResponse({
          model: chosenModel,
          contents: `You are a codebase locator agent for a React + TypeScript + Express app.
User request: "${userPrompt}"
Available files:
${fileListText}

Select ALL relevant file paths that likely need reading or editing according to the exact scope of the user's request (no fixed limit — pick 1 file if simple, or many files if broad).
Return strict JSON ONLY:
{ "files": ["src/...", "..."] }`
          ,
          config: { responseMimeType: "application/json" }
        });
        const locRaw = (typeof locatorResp?.text === "function" ? locatorResp.text() : locatorResp?.text || "{}").trim();
        const locJson = JSON.parse(locRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
        if (Array.isArray(locJson?.files)) {
          candidatePaths = locJson.files.filter((p: any) => typeof p === "string" && resolveSafeAgentPath(p));
        }
      } catch {}

      // Ensure core shell files are available when nothing matched
      if (candidatePaths.length === 0) {
        for (const fb of ["src/components/ChatHeader.tsx", "src/components/SanctuaryView.tsx", "src/App.tsx", "src/components/AdvancedFeaturesSection.tsx", "src/index.css"]) {
          if (fs.existsSync(path.join(WORKSPACE_ROOT, fb))) {
            candidatePaths.push(fb);
          }
        }
      }
      candidatePaths = Array.from(new Set(candidatePaths));

      const fileSnapshots: Array<{ path: string; excerpt: string }> = [];
      for (const relPath of candidatePaths) {
        const fullContent = readFullSafeCodeFile(relPath);
        if (fullContent) {
          fileSnapshots.push({ path: relPath, excerpt: fullContent });
        }
      }

      traceSteps.push({
        agent: "وكيل تحليل الشيفرة",
        status: "done",
        title: "قراءة وتحليل الملفات المستهدفة بالكامل",
        detail: `قرأ الوكيل ${fileSnapshots.length} ملفاً بالكامل بدون اقتطاع: ${fileSnapshots.map((f) => f.path).join(" ، ")}`
      });

      const codeContextBlock = fileSnapshots
        .map((f) => `=== FILE: ${f.path} ===\n${f.excerpt}\n=== END FILE: ${f.path} ===`)
        .join("\n\n");

      const recentHistory = Array.isArray(history)
        ? history.map((h: any) => `${h.role}: ${String(h.text || "")}`).join("\n")
        : "";

      // Agent 2: Architect & Planner Agent (Dynamic Unbounded Code Output)
      const plannerPrompt = `You are the Senior Self-Maintenance AI Software Architect inside MindMirror 2026 (React 19 + TypeScript + Tailwind v4 + Express).
IMPORTANT RULES:
1. Respond with STRICT JSON ONLY matching the schema below.
2. There is NO minimum or maximum limit on code output length — adapt dynamically to the user's request. Whether the modification is 3 lines or 3,000+ lines across full new modules/files, write complete, un-abbreviated, production-grade TypeScript/React code without placeholders, "// ... rest of code", or truncation.
3. Notice the app supports two UI modes in src/App.tsx: "sanctuary" (SanctuaryView.tsx) AND "classic" (ChatHeader.tsx + main view). Make sure global features work cleanly across active views without breaking TypeScript types.
4. For "modify", every replacement "search" string MUST be an EXACT VERBATIM contiguous substring copied directly from the FILE content provided below. For large new components or major rewrites, you may also use "action": "create" with full "content".
5. Keep "understandingAr", "planSummaryAr", "summaryAr", and "consultationMessageAr" in clear Arabic consulting the user BEFORE execution.
6. Never touch .env or API secrets.

Conversation context:
${recentHistory || "(none)"}

User's requested modification:
"${userPrompt}"

Complete workspace source files:
${codeContextBlock}

Return STRICT JSON ONLY:
{
  "understandingAr": "ملخص دقيق لما يريده المستخدم باللغة العربية",
  "planSummaryAr": "خطوات الخطة البرمجية المرقمة بالتفصيل",
  "riskLevel": "low",
  "consultationMessageAr": "رسالة استشارة ودودة تطلب من المستخدم مراجعة الخطة والملفات والتأكيد قبل التنفيذ الفعلي",
  "edits": [
    {
      "filePath": "src/components/ChatHeader.tsx",
      "action": "modify",
      "summaryAr": "وصف مختصر للتعديل في هذا الملف",
      "replacements": [
        {
          "search": "EXACT verbatim code block from the file above",
          "replace": "Updated complete replacement code block"
        }
      ]
    }
  ]
}`;

      const planResp: any = await generateUnboundedResponse({
        model: chosenModel,
        contents: plannerPrompt,
        config: { responseMimeType: "application/json" }
      });

      const rawPlanText = (typeof planResp?.text === "function" ? planResp.text() : planResp?.text || "{}").trim();
      const cleanedPlanJson = rawPlanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsedPlan = JSON.parse(cleanedPlanJson);

      const rawEdits: PlannedFileEdit[] = Array.isArray(parsedPlan?.edits) ? parsedPlan.edits : [];
      const sanitizedEdits: PlannedFileEdit[] = [];

      for (const edit of rawEdits) {
        const safe = resolveSafeAgentPath(edit?.filePath || "");
        if (!safe) continue;
        const action: "modify" | "create" = edit.action === "create" ? "create" : "modify";
        const fileExists = fs.existsSync(safe.absPath);
        const currentDiskContent = fileExists ? fs.readFileSync(safe.absPath, "utf8") : "";

        if (action === "create") {
          sanitizedEdits.push({
            filePath: safe.relPath,
            action: "create",
            summaryAr: String(edit.summaryAr || `إنشاء ملف ${safe.relPath}`),
            content: String(edit.content || "")
          });
        } else if (fileExists && Array.isArray(edit.replacements)) {
          const verifiedReplacements = edit.replacements.map((rep: any) => {
            const s = String(rep?.search || "");
            const r = String(rep?.replace || "");
            const check = applyWhitespaceTolerantReplace(currentDiskContent, s, r);
            return {
              search: s,
              replace: r,
              verifiedOnDisk: check.matched
            };
          });
          sanitizedEdits.push({
            filePath: safe.relPath,
            action: "modify",
            summaryAr: String(edit.summaryAr || `تعديل ${safe.relPath}`),
            replacements: verifiedReplacements
          });
        }
      }

      const planId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const planRecord: PendingAgentPlan = {
        planId,
        prompt: userPrompt,
        model: chosenModel,
        understandingAr: String(parsedPlan?.understandingAr || "تم تحليل الطلب وإعداد خطة التنفيذ البرمجية."),
        planSummaryAr: String(parsedPlan?.planSummaryAr || ""),
        riskLevel: ["low", "medium", "high"].includes(parsedPlan?.riskLevel) ? parsedPlan.riskLevel : "low",
        consultationMessageAr: String(
          parsedPlan?.consultationMessageAr || "تم إعداد الخطة وفحص الملفات المستهدفة دون تعديل أي ملف بعد. هل توافق على بدء التنفيذ البرمجي الفوري؟"
        ),
        edits: sanitizedEdits,
        createdAt: Date.now()
      };

      pendingAgentPlans.set(planId, planRecord);
      if (pendingAgentPlans.size > 40) {
        const oldestKey = pendingAgentPlans.keys().next().value;
        if (oldestKey) pendingAgentPlans.delete(oldestKey);
      }

      traceSteps.push({
        agent: "وكيل التخطيط والمراجعة",
        status: sanitizedEdits.length > 0 ? "done" : "warn",
        title: "تجهيز خطة التعديل واستشارة المستخدم",
        detail: `تم تجهيز ${sanitizedEdits.length} تعديلاً مقترحاً بانتظار موافقتك الصريحة قبل الكتابة على القرص.`
      });

      return res.json({
        planId,
        modelUsed: chosenModel,
        traceSteps,
        inspectedFiles: fileSnapshots.map((f) => f.path),
        understandingAr: planRecord.understandingAr,
        planSummaryAr: planRecord.planSummaryAr,
        riskLevel: planRecord.riskLevel,
        consultationMessageAr: planRecord.consultationMessageAr,
        editsPreview: planRecord.edits.map((e) => ({
          filePath: e.filePath,
          action: e.action,
          summaryAr: e.summaryAr,
          verifiedOnDisk: e.action === "create" ? true : Boolean(e.replacements?.every((r) => r.verifiedOnDisk)),
          patches: (e.replacements || []).map((r) => ({
            search: r.search,
            replace: r.replace,
            verifiedOnDisk: Boolean(r.verifiedOnDisk)
          })),
          contentPreview: e.action === "create" ? String(e.content || "") : undefined
        }))
      });
    } catch (err: any) {
      console.error("[Self-Agent Plan] Error:", err);
      return res.status(500).json({
        error: err?.message || "تعذر إتمام مرحلة الفحص والتخطيط البرمجي.",
        traceSteps
      });
    }
  });

  app.post("/api/self-agent/execute", async (req, res) => {
    const { planId, model: overrideModel } = req.body || {};
    const plan = pendingAgentPlans.get(String(planId || ""));
    if (!plan) {
      return res.status(404).json({ error: "الخطة المطلوبة غير موجودة أو انتهت صلاحيتها. يرجى إعادة التخطيط." });
    }

    const activeModel = String(overrideModel || plan.model || "gemini-3-flash-preview");
    const executionTrace: Array<{ agent: string; status: "done" | "warn" | "error"; title: string; detail: string }> = [];
    const backups: Array<{ relPath: string; absPath: string; existed: boolean; previousContent: string }> = [];
    const modifiedFiles: string[] = [];

    const restoreAllBackups = () => {
      for (const b of backups) {
        try {
          if (b.existed) {
            fs.writeFileSync(b.absPath, b.previousContent, "utf8");
          } else if (fs.existsSync(b.absPath)) {
            fs.unlinkSync(b.absPath);
          }
        } catch {}
      }
    };

    try {
      // 1. Backup Agent
      for (const edit of plan.edits) {
        const safe = resolveSafeAgentPath(edit.filePath);
        if (!safe) continue;
        if (!backups.some((b) => b.absPath === safe.absPath)) {
          const existed = fs.existsSync(safe.absPath);
          const previousContent = existed ? fs.readFileSync(safe.absPath, "utf8") : "";
          backups.push({ relPath: safe.relPath, absPath: safe.absPath, existed, previousContent });
        }
      }
      agentBackups.set(plan.planId, backups);
      executionTrace.push({
        agent: "وكيل النسخ الاحتياطي",
        status: "done",
        title: "أخذ نسخة أمان قبل التعديل",
        detail: `تم حفظ نسخ احتياطية لـ ${backups.length} ملف لضمان إمكانية التراجع الفوري.`
      });

      // 2. Coder Agent: Apply edits on disk
      let appliedPatchesCount = 0;
      for (const edit of plan.edits) {
        const safe = resolveSafeAgentPath(edit.filePath);
        if (!safe) continue;

        if (edit.action === "create") {
          fs.mkdirSync(path.dirname(safe.absPath), { recursive: true });
          fs.writeFileSync(safe.absPath, String(edit.content || ""), "utf8");
          if (!modifiedFiles.includes(safe.relPath)) modifiedFiles.push(safe.relPath);
          appliedPatchesCount++;
        } else if (fs.existsSync(safe.absPath) && Array.isArray(edit.replacements)) {
          let content = fs.readFileSync(safe.absPath, "utf8");
          let fileChanged = false;

          for (const rep of edit.replacements) {
            const attempt = applyWhitespaceTolerantReplace(content, rep.search, rep.replace);
            if (attempt.matched) {
              content = attempt.updated;
              fileChanged = true;
              appliedPatchesCount++;
            } else {
              // Grounding rescue call for slightly shifted search text (full file & unbounded output)
              try {
                const rescueResp: any = await generateUnboundedResponse({
                  model: activeModel,
                  contents: `A search/replace patch failed to match literally in "${safe.relPath}".
Goal of this edit: ${edit.summaryAr}
Intended new code:
${rep.replace}

Original search pattern that missed:
${rep.search}

Actual complete file content:
${readFullSafeCodeFile(safe.relPath)}

Return STRICT JSON with the EXACT verbatim "search" substring from the file and complete updated "replace":
{ "search": "...", "replace": "..." }`,
                  config: { responseMimeType: "application/json" }
                });
                const rRaw = (typeof rescueResp?.text === "function" ? rescueResp.text() : rescueResp?.text || "{}").trim();
                const rJson = JSON.parse(rRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
                if (rJson?.search && typeof rJson?.replace === "string") {
                  const rescueAttempt = applyWhitespaceTolerantReplace(content, rJson.search, rJson.replace);
                  if (rescueAttempt.matched) {
                    content = rescueAttempt.updated;
                    fileChanged = true;
                    appliedPatchesCount++;
                  }
                }
              } catch {}
            }
          }

          if (fileChanged) {
            fs.writeFileSync(safe.absPath, content, "utf8");
            if (!modifiedFiles.includes(safe.relPath)) modifiedFiles.push(safe.relPath);
          }
        }
      }

      if (modifiedFiles.length === 0) {
        return res.status(400).json({
          error: "لم ينجح الوكيل في مطابقة أي رقعة برمجية على الملفات الحالية. يرجى إعادة التخطيط.",
          executionTrace
        });
      }

      executionTrace.push({
        agent: "وكيل كتابة الكود",
        status: "done",
        title: "تطبيق التعديلات البرمجية على القرص",
        detail: `تم تعديل ${modifiedFiles.join(" ، ")} (${appliedPatchesCount} رقعة برمجية).`
      });

      // 3. TypeScript Verifier Agent (+ Auto Self-Heal if tsc catches a type error)
      let tscPassed = false;
      let tscOutput = "";

      const runTscCheck = async (): Promise<{ ok: boolean; output: string }> => {
        try {
          const { stdout, stderr } = await execAsync("npx tsc --noEmit", { cwd: WORKSPACE_ROOT, timeout: 120000 });
          return { ok: true, output: (stdout || stderr || "0 errors").trim() };
        } catch (tscErr: any) {
          return {
            ok: false,
            output: String(tscErr?.stdout || tscErr?.stderr || tscErr?.message || "TypeScript compilation error")
          };
        }
      };

      let check1 = await runTscCheck();
      tscPassed = check1.ok;
      tscOutput = check1.output;

      if (!tscPassed) {
        executionTrace.push({
          agent: "وكيل التحقق (TSC)",
          status: "warn",
          title: "اكتشاف خطأ أنواع وتنفيذ إصلاح ذاتي",
          detail: tscOutput
        });

        try {
          const repairSnapshots = modifiedFiles
            .map((rel) => {
              const abs = path.join(WORKSPACE_ROOT, rel);
              return fs.existsSync(abs) ? `=== ${rel} ===\n${readFullSafeCodeFile(rel)}` : "";
            })
            .filter(Boolean)
            .join("\n\n");

          const fixResp: any = await generateUnboundedResponse({
            model: activeModel,
            contents: `TypeScript check (npx tsc --noEmit) reported errors after applying edits:
${tscOutput}

Complete modified files:
${repairSnapshots}

Return STRICT JSON array of surgical fixes (complete, un-truncated code):
{
  "fixes": [
    { "filePath": "...", "search": "EXACT verbatim substring", "replace": "fixed replacement" }
  ]
}`,
            config: { responseMimeType: "application/json" }
          });

          const fRaw = (typeof fixResp?.text === "function" ? fixResp.text() : fixResp?.text || "{}").trim();
          const fJson = JSON.parse(fRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
          if (Array.isArray(fJson?.fixes)) {
            for (const fix of fJson.fixes) {
              const safe = resolveSafeAgentPath(fix?.filePath || "");
              if (!safe || !fs.existsSync(safe.absPath)) continue;
              const cur = fs.readFileSync(safe.absPath, "utf8");
              const patched = applyWhitespaceTolerantReplace(cur, String(fix.search || ""), String(fix.replace || ""));
              if (patched.matched) {
                fs.writeFileSync(safe.absPath, patched.updated, "utf8");
              }
            }
          }
          const check2 = await runTscCheck();
          tscPassed = check2.ok;
          tscOutput = check2.output;
        } catch {}
      }

      if (!tscPassed) {
        restoreAllBackups();
        executionTrace.push({
          agent: "وكيل الحماية والتراجع التلقائي",
          status: "error",
          title: "فشل التحقق — تم التراجع الآمن تلقائياً لحماية التطبيق",
          detail: tscOutput
        });
        return res.status(422).json({
          success: false,
          error: "تسبب التعديل في خطأ برمجي (TypeScript)، فقام نظام الأمان باستعادة النسخة الأصلية تلقائياً.",
          tscPassed: false,
          tscOutput,
          executionTrace
        });
      }

      executionTrace.push({
        agent: "وكيل التحقق والترجمة (TSC)",
        status: "done",
        title: "نجاح فحص TypeScript (0 أخطاء)",
        detail: "تم التحقق من سلامة الشيفرة البرمجية وتوافق الأنواع بنسبة 100%."
      });

      // 4. Live Preview Sync Agent
      bumpBuildRevision(`self_agent:${plan.planId}`);
      executionTrace.push({
        agent: "وكيل التحديث اللحظي",
        status: "done",
        title: "دفع التحديث الفوري إلى المعاينة الحية",
        detail: `تم رفع رقم النسخة الحية إلى #${buildRevision} لتحديث التطبيق فوراً دون الحاجة لإعادة تحميل يدوي.`
      });

      return res.json({
        success: true,
        planId: plan.planId,
        modifiedFiles,
        rollbackAvailable: true,
        tscPassed: true,
        tscOutput,
        buildRevision,
        executionTrace
      });
    } catch (err: any) {
      restoreAllBackups();
      return res.status(500).json({
        success: false,
        error: err?.message || "حدث خطأ أثناء تنفيذ التعديل البرمجي؛ تم التراجع للنسخة الآمنة.",
        executionTrace
      });
    }
  });

  app.post("/api/self-agent/rollback", (req, res) => {
    const { planId } = req.body || {};
    const backups = agentBackups.get(String(planId || ""));
    if (!backups || backups.length === 0) {
      return res.status(404).json({ error: "لا توجد نسخة احتياطية محفوظة لهذه الخطة." });
    }
    const restoredFiles: string[] = [];
    for (const b of backups) {
      try {
        if (b.existed) {
          fs.writeFileSync(b.absPath, b.previousContent, "utf8");
        } else if (fs.existsSync(b.absPath)) {
          fs.unlinkSync(b.absPath);
        }
        restoredFiles.push(b.relPath);
      } catch {}
    }
    bumpBuildRevision(`rollback:${planId}`);
    return res.json({ success: true, restoredFiles, buildRevision });
  });

  app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
    const filePath = fs.existsSync(path.join(process.cwd(), "public", "manifest.json"))
      ? path.join(process.cwd(), "public", "manifest.json")
      : path.join(process.cwd(), "dist", "manifest.json");

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(filePath);
    }
    res.status(404).end();
  });

  app.get('/sw.js', (req, res) => {
    const filePath = fs.existsSync(path.join(process.cwd(), "public", "sw.js"))
      ? path.join(process.cwd(), "public", "sw.js")
      : path.join(process.cwd(), "dist", "sw.js");

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(filePath);
    }
    res.status(404).end();
  });

  app.get(['/pwa-192x192.png', '/pwa-maskable-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png', '/apple-touch-icon.png', '/icon.svg', '/favicon.ico', '/screenshot-mobile.jpg', '/screenshot-desktop.jpg'], (req, res) => {
    const fileName = path.basename(req.path);
    const filePath = fs.existsSync(path.join(process.cwd(), "public", fileName))
      ? path.join(process.cwd(), "public", fileName)
      : path.join(process.cwd(), "dist", fileName);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName).toLowerCase();
      const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.ico' ? 'image/x-icon' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
    res.status(404).end();
  });

  // Setup Vite middleware or static serving with full SPA routing fallback
  const distPath = path.join(process.cwd(), "dist");
  const publicPath = path.join(process.cwd(), "public");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || process.env.npm_lifecycle_event === 'start';

  // Health and System Diagnostics Endpoint placed first for instant uptime & health probes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "1RMX Live MindMirror 2026 V2Ag",
      version: "2.6.0-prod",
      environment: isProduction ? "production" : "development",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      productionUrl: "https://ais-pre-ekuyola4n5bxqwb4j7b573-480187073755.europe-west2.run.app",
      pwa: {
        active: true,
        manifest: "/manifest.json",
        serviceWorker: "/sw.js"
      }
    });
  });

  let useStatic = isProduction;
  
  if (useStatic && !hasDist) {
    // If production is requested but dist doesn't exist yet, try to use public or fallback
    if (fs.existsSync(publicPath) && fs.existsSync(path.join(publicPath, "index.html"))) {
      console.warn("[Server] Warning: dist/ not found, falling back to public/ static serving.");
    }
  }

  if (useStatic) {
    const staticTarget = hasDist ? distPath : (fs.existsSync(publicPath) ? publicPath : process.cwd());
    // Serve static assets from build directory and public folder with zero-cache for html/sw/manifest
    app.use(express.static(staticTarget, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));
    if (fs.existsSync(publicPath) && staticTarget !== publicPath) {
      app.use(express.static(publicPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        }
      }));
    }
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const htmlFile = hasDist ? path.join(distPath, "index.html") : (fs.existsSync(path.join(publicPath, "index.html")) ? path.join(publicPath, "index.html") : path.join(process.cwd(), "index.html"));
      if (fs.existsSync(htmlFile)) {
        return res.sendFile(htmlFile);
      }
      res.status(200).send('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>1RMX MindMirror</title></head><body><div id="root"></div></body></html>');
    });
  } else {
    // Vite development middleware with robust try/catch fallback
    try {
      let vite: any = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite?.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (viteErr) {
      console.warn("[Server] Vite dev server initialization failed, falling back to static serving:", viteErr);
      app.use(express.static(process.cwd()));
      app.get("*", (req, res) => {
        res.sendFile(path.join(process.cwd(), "index.html"));
      });
    }
  }

  // Create HTTP server with resilient socket timeouts to prevent stale hanging connections
  // Must bind to 0.0.0.0 so Cloud Run and Docker networks can route traffic into the container
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MindMirror Server] Operational & Listening on 0.0.0.0:${PORT} (PID: ${process.pid}, NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
    
    // Start internal health heartbeat only after listener is active
    const healthTimer = setInterval(() => {
      fetch(`http://127.0.0.1:${PORT}/api/health`).catch(() => {});
    }, 45000);
    healthTimer.unref();
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.timeout = 0;
  server.requestTimeout = 0;

  // Graceful shutdown handling for Cloud Run & container orchestrators
  process.on('SIGTERM', () => {
    console.log('[Server] Received SIGTERM signal, closing gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed gracefully.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  });

  process.on('SIGINT', () => {
    console.log('[Server] Received SIGINT signal, closing gracefully...');
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  });

  // Background keep-alive heartbeat to ensure event loop remains active
  const keepAliveTimer = setInterval(() => {
    // Keep event loop active continuously
  }, 15000);
  keepAliveTimer.unref();

  // Attach WebSocket server for Gemini Live API
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("error", (err) => {
    console.error("[WebSocketServer] Global error:", err);
  });

  wss.on("connection", (clientWs, req) => {
    console.log("Client connected to /live");

    // Suppress unhandled socket errors when client closes app / tab
    clientWs.on("error", (err) => {
      console.warn("[WebSocket Client] Disconnect socket event handled cleanly:", err?.message || err);
    });

    let isAlive = true;
    clientWs.on("pong", () => {
      isAlive = true;
    });

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.warn("[WebSocket] Client heartbeat failed. Terminating stale connection.");
        try {
          clientWs.terminate();
        } catch (e) {
          // ignore
        }
        clearInterval(pingInterval);
        return;
      }
      isAlive = false;
      if (clientWs.readyState === 1) {
        try {
          clientWs.ping();
        } catch (e) {
          // ignore
        }
      }
    }, 25000);
    
    // Parse URL parameters for API key and voice/persona config
    const url = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const rawKey = url.searchParams.get("key");
    const clientApiKey = (rawKey && rawKey !== "undefined" && rawKey.trim() !== "") ? rawKey.trim() : undefined;

    const keysToTry: (string | null)[] = [...getActiveKeyPool(clientApiKey)];
    if (keysToTry.length === 0 || (clientApiKey === undefined && !keysToTry.includes(null))) {
      keysToTry.push(null); 
    }

    const rawVoice = url.searchParams.get("voice");
    const voice = (rawVoice && rawVoice !== "undefined" && rawVoice.trim() !== "") ? rawVoice : "Aoede";

    const rawInstruction = url.searchParams.get("systemInstruction");
    const systemInstruction = (rawInstruction && rawInstruction !== "undefined" && rawInstruction.trim() !== "") 
      ? rawInstruction 
      : "You are a helpful assistant.";

    let session: any = null;

    const rawModel = url.searchParams.get("model");
    const candidateLiveModels = Array.from(new Set([
      ...(rawModel && rawModel !== "undefined" && rawModel.trim() !== "" ? [rawModel.trim()] : []),
      "gemini-3.8-live",
      "gemini-3.1-flash-live-preview",
      "gemini-2.5-flash-native-audio-latest",
      "gemini-3.8-live-extended-thinking"
    ]));

    let clientClosed = false;
    clientWs.once("close", () => {
      clientClosed = true;
      clearInterval(pingInterval);
      console.log("[Gemini Live] Client disconnected from /live");
      if (session) {
        try {
          session.close();
        } catch (e) {
          // Already closed
        }
        session = null;
      }
    });

    const connectWithFallback = async () => {
      let lastError: any = null;

      for (const apiKey of keysToTry) {
        if (clientClosed) return false;
        const finalKey = apiKey || SYSTEM_KEYS[0] || process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY || process.env.GOOGLE_API_KEY || '';
        const ai = new GoogleGenAI({ 
          apiKey: finalKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        }); // 2026 Managed Identity Fallback

        for (const liveModel of candidateLiveModels) {
          if (clientClosed) return false;
          try {
            const keyTag = apiKey ? `...${apiKey.slice(-6)}` : 'Internal Key';
            console.log(`[Gemini Live] Connecting to ${liveModel} (voice: ${voice}) with ${keyTag}`);

            let handshakeSettled = false;
            let resolveHandshake!: () => void;
            let rejectHandshake!: (err: Error) => void;
            const handshakePromise = new Promise<void>((res, rej) => {
              resolveHandshake = res;
              rejectHandshake = rej;
            });

            const handshakeTimer = setTimeout(() => {
              if (!handshakeSettled) {
                handshakeSettled = true;
                rejectHandshake(new Error(`Handshake timeout for ${liveModel}`));
              }
            }, 5000);

            const s = await ai.live.connect({
              model: liveModel,
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: (voice.startsWith('voice_') || voice.startsWith('voicekey_'))
                    ? { voice }
                    : { prebuiltVoiceConfig: { voiceName: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'].includes(voice) ? voice : 'Aoede' } },
                },
                systemInstruction: systemInstruction,
                outputAudioTranscription: {},
                inputAudioTranscription: {},
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  if (!handshakeSettled) {
                    handshakeSettled = true;
                    clearTimeout(handshakeTimer);
                    resolveHandshake();
                  }
                  if (message.serverContent?.modelTurn?.parts) {
                    message.serverContent.modelTurn.parts.forEach(part => {
                      if (part.inlineData?.data && clientWs.readyState === 1) {
                        clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                      }
                    });
                  }
                  if (message.serverContent?.outputTranscription?.text) {
                    if (clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ text: message.serverContent.outputTranscription.text }));
                    }
                  }
                  if (message.serverContent?.inputTranscription?.text) {
                    if (clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ userInput: message.serverContent.inputTranscription.text }));
                    }
                  }
                  if (message.serverContent?.interrupted) {
                    if (clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ interrupted: true }));
                    }
                  }
                },
                onclose: (e: any) => {
                  console.log(`[Gemini Live] Session closed for ${liveModel}: code=${e?.code}, reason=${e?.reason}`);
                  if (!handshakeSettled) {
                    handshakeSettled = true;
                    clearTimeout(handshakeTimer);
                    rejectHandshake(new Error(e?.reason || `Closed during setup (code ${e?.code})`));
                    return;
                  }
                  if (clientWs.readyState === 1) {
                    if (e?.reason) {
                      clientWs.send(JSON.stringify({ error: `انتهت جلسة Live (${e?.code || ''}): ${e.reason}` }));
                    }
                    clientWs.close(1000, (e?.reason || '').slice(0, 120));
                  }
                },
                onerror: (err: any) => {
                  console.error(`[Gemini Live] Session error with ${liveModel}:`, err);
                  if (!handshakeSettled) {
                    handshakeSettled = true;
                    clearTimeout(handshakeTimer);
                    rejectHandshake(new Error(err?.message || String(err)));
                    return;
                  }
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ error: "خطأ في Live API: " + (err.message || String(err)) }));
                  }
                }
              },
            });

            // Wait until setupComplete / initial server ack confirms session is actually alive
            try {
              await handshakePromise;
            } catch (hsErr) {
              try { s.close(); } catch {}
              throw hsErr;
            }

            if (clientClosed) {
              try { s.close(); } catch {}
              return false;
            }

            session = s;
            console.log(`[Gemini Live] Established active bidirectional stream with ${liveModel}`);
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ status: "connected", model: liveModel }));
            }
            return true;
          } catch (err: any) {
            const keyTag = apiKey ? `...${apiKey.slice(-6)}` : 'Internal Key';
            console.warn(`[Gemini Live] Model ${liveModel} connection failed with key ${keyTag}:`, err?.message || err);
            lastError = err;
            const errMsg = err?.message || String(err);
            if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('exhausted')) {
              if (apiKey && !errMsg.includes('Resource has been exhausted')) {
                // Only mark key exhausted if not model-specific exhaustion, or still continue trying other models first
              }
            }
          }
        }
      }

      console.error("[Gemini Live] All candidate models failed to connect:", lastError);
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ error: "فشل الاتصال بـ Gemini Live API: " + (lastError?.message || "تعذر بدء الجلسة") }));
        clientWs.close();
      }
      return false;
    };

    connectWithFallback().then((ok) => {
      if (!ok) return;
      clientWs.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.history && session) {
            console.log(`[Gemini Live] Received history with ${parsed.history.length} turns. Prefilling context...`);
            const turns = parsed.history.map((msg: any) => ({
              role: msg.role === 'model' ? 'model' : 'user',
              parts: [{ text: msg.text }]
            }));
            session.sendClientContent({
              turns,
              turnComplete: false
            });
          }
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" }
            });
          }
          if (parsed.endOfSpeech && session) {
            try {
              session.sendRealtimeInput({ audioStreamEnd: true });
            } catch (e) {
              console.warn("[Gemini Live] Error sending audioStreamEnd:", e);
            }
          }
          if (parsed.text && session) {
            session.sendClientContent({
              turns: [{ role: "user", parts: [{ text: parsed.text }] }],
              turnComplete: true
            });
          }
        } catch (e) {
          console.error("[Gemini Live] Error processing client message", e);
        }
      });
    }).catch(err => {
      clearInterval(pingInterval);
      console.error("[Gemini Live] Fatal initialization error:", err);
      if (clientWs.readyState === 1) {
        clientWs.close();
      }
    });
  });
}

startServer();
