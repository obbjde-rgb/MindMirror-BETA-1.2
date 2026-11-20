import { GoogleGenAI } from '@google/genai';
import { logger } from './logger';
import { safeStorage } from './storage';

export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_AUDIO_MODEL = 'gemini-3.8-flash-tts';

/**
 * Normalizes any model identifier into a clean Gemini model name.
 * Allows user-selected models including robotics, 2.5, 3.x, preview, and tuned models.
 */
export const normalizeGeminiModel = (modelName?: string | null): string => {
  if (!modelName || typeof modelName !== 'string') return DEFAULT_MODEL;
  const clean = modelName.replace(/^models\//, '').replace(/^tunedModels\//, '').trim();
  if (!clean || clean.length < 2) return DEFAULT_MODEL;

  // Replace strictly obsolete generic placeholders or invalid model names
  if (
    clean === 'gemini-pro' || 
    clean === 'gemini-flash' || 
    clean === 'gemini-1.5-flash' ||
    clean === 'gemini-1.5-pro' ||
    clean === 'gemini-3.8-flash'
  ) {
    return DEFAULT_MODEL;
  }

  return clean;
};

export const parseJsonSafely = <T = any>(rawText: string, fallback?: T): T => {
  const hasFallback = fallback !== undefined;
  if (!rawText) {
    if (hasFallback) return fallback as T;
    throw new Error("Empty text provided for JSON parsing");
  }
  
  let cleaned = rawText.trim();
  
  // Strip markdown code fences anywhere if they are wrapping the JSON
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      cleaned = match[1].trim();
    }
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  
  // Direct attempt
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // Try to locate JSON object {...} or array [...]
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    
    // Gather candidates to try parsing
    const candidates: string[] = [];
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(cleaned.substring(firstBrace, lastBrace + 1));
    }
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      candidates.push(cleaned.substring(firstBracket, lastBracket + 1));
    }
    
    for (const cand of candidates) {
      try {
        return JSON.parse(cand);
      } catch (e) {
        try {
          const sanitized = cand.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(sanitized);
        } catch (e2) {
          // continue
        }
      }
    }

    // Try last fallback cleaning on the full text
    const sanitizedFull = cleaned.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(sanitizedFull);
    } catch (finalErr: any) {
      logger.error("Failed to parse JSON even with advanced fallbacks. Raw text length: " + rawText.length, finalErr);
      if (hasFallback) return fallback as T;
      throw finalErr;
    }
  }
};

export const sanitizeApiKey = (key: string): string => {
  if (!key) return '';
  // Remove any character that is not a standard printable ASCII character (0x21 to 0x7E)
  // This removes spaces, invisible characters, and Unicode that cause Header append errors
  return key.trim().replace(/[^\x21-\x7E]/g, '');
};

let cachedApiKey = '';

export const setRuntimeApiKey = (key: string): void => {
  const sanitized = sanitizeApiKey(key || '');
  cachedApiKey = sanitized;
  safeStorage.setItem('mindmirror_apiKey', sanitized);
};

/**
 * Safely retrieves the absolute latest, sanitized API Key.
 * Reads from runtime cache, then directly from localStorage to bypass any stale React closure issues,
 * falling back to process.env if available.
 */
export const getApiKey = (): string => {
  if (cachedApiKey) {
    return cachedApiKey;
  }
  const localKey = safeStorage.getItem('mindmirror_apiKey');
  const sanitized = sanitizeApiKey(localKey || '');
  if (sanitized) {
    cachedApiKey = sanitized;
    return sanitized;
  }

  return '';
};

export const checkSystemHealth = async (): Promise<{ status: string; activeKeysCount: number; defaultModel: string }> => {
  try {
    const res = await fetch('/api/key-pool-status');
    if (res.ok) {
      const data = await res.json();
      return {
        status: 'healthy',
        activeKeysCount: data.activeKeysInPool || 1,
        defaultModel: data.defaultModel || 'gemini-3-flash-preview'
      };
    }
  } catch (e) {
    // ignore
  }
  return { status: 'degraded', activeKeysCount: 1, defaultModel: 'gemini-3-flash-preview' };
};

export interface GeminiGenerateResult {
  text: string;
  candidates?: any[];
  functionCalls?: any[];
  [key: string]: any;
}

export const getGeminiClient = (apiKeyOverride?: string) => {
  const customKey = sanitizeApiKey(apiKeyOverride || getApiKey());

  return {
    models: {
      generateContent: async (params: any): Promise<GeminiGenerateResult> => {
        // First try with customKey if provided, or fallback automatically if empty/invalid
        let response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params, apiKey: customKey })
        });

        // Active health check / fallback: if custom key returned 401/403/429, retry once with internal system pool
        if (!response.ok && customKey) {
          const errText = await response.text();
          if (errText.includes('401') || errText.includes('403') || errText.includes('API_KEY_INVALID') || errText.includes('429')) {
            logger.warn("[Gemini Client] Custom key failed validation or quota. Falling back to internal system key pool...");
            response = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ params, apiKey: '' }) // empty apiKey forces internal system key pool
            });
          } else {
            throw new Error(errText);
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            parsedMsg = errJson.error || errText;
          } catch (e) {}
          throw new Error(parsedMsg);
        }
        const data = await response.json();
        return {
          ...data,
          text: typeof data.text === 'function' ? data.text() : (data.text || '')
        };
      },
      generateContentStream: async (params: any): Promise<AsyncGenerator<GeminiGenerateResult, void, unknown>> => {
        let response = await fetch('/api/generate-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params, apiKey: customKey })
        });

        if (!response.ok && customKey) {
          const errText = await response.text();
          if (errText.includes('401') || errText.includes('403') || errText.includes('API_KEY_INVALID') || errText.includes('429')) {
            logger.warn("[Gemini Client Stream] Custom key failed. Falling back to internal system key pool...");
            response = await fetch('/api/generate-stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ params, apiKey: '' })
            });
          } else {
            throw new Error(errText);
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            parsedMsg = errJson.error || errText;
          } catch (e) {}
          throw new Error(parsedMsg);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        return (async function* (): AsyncGenerator<GeminiGenerateResult, void, unknown> {
          let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr) {
                try {
                  const chunk = JSON.parse(jsonStr);
                  if (chunk.error) {
                    const errMsg = typeof chunk.error === 'string' ? chunk.error : (chunk.error.message || JSON.stringify(chunk.error));
                    throw new Error(errMsg);
                  }
                  let textVal = '';
                  if (typeof chunk.text === 'string') {
                    textVal = chunk.text;
                  } else if (chunk.candidates?.[0]?.content?.parts) {
                    textVal = chunk.candidates[0].content.parts.map((p: any) => p.text || '').join('');
                  } else if (chunk.candidates?.[0]?.delta?.content?.parts) {
                    textVal = chunk.candidates[0].delta.content.parts.map((p: any) => p.text || '').join('');
                  }
                  yield {
                    ...chunk,
                    text: textVal
                  };
                } catch (e: any) {
                  if (!(e instanceof SyntaxError)) {
                    throw e;
                  }
                }
              }
            }
          }
        }
        
        if (buffer.trim().startsWith('data: ')) {
          const jsonStr = buffer.trim().slice(6).trim();
          if (jsonStr) {
            try {
              const chunk = JSON.parse(jsonStr);
              if (chunk.error) {
                const errMsg = typeof chunk.error === 'string' ? chunk.error : (chunk.error.message || JSON.stringify(chunk.error));
                throw new Error(errMsg);
              }
              let textVal = '';
              if (typeof chunk.text === 'string') {
                textVal = chunk.text;
              } else if (chunk.candidates?.[0]?.content?.parts) {
                textVal = chunk.candidates[0].content.parts.map((p: any) => p.text || '').join('');
              } else if (chunk.candidates?.[0]?.delta?.content?.parts) {
                textVal = chunk.candidates[0].delta.content.parts.map((p: any) => p.text || '').join('');
              }
              yield {
                ...chunk,
                text: textVal
              };
            } catch (e: any) {
              if (!(e instanceof SyntaxError)) {
                throw e;
              }
            }
          }
        }
        })();
      }
    },
    chats: {
      create: (chatOptions: any) => {
        let history = chatOptions?.history || [];
        const model = chatOptions?.model || 'gemini-3-flash-preview';
        const config = chatOptions?.config || {};
        const isStrict = chatOptions?.isStrict || false;
        
        return {
          sendMessage: async (msgParams: any) => {
            const userContent = typeof msgParams === 'string' ? msgParams : (msgParams?.message || msgParams?.text || JSON.stringify(msgParams));
            history.push({ role: 'user', parts: [{ text: userContent }] });
            const result = await getGeminiClient(customKey).models.generateContent({
              model,
              contents: history,
              config,
              strictModel: isStrict
            });
            const textVal = result.text || '';
            history.push({ role: 'model', parts: [{ text: textVal }] });
            return result;
          },
          sendMessageStream: async function* (msgParams: any) {
            const userContent = typeof msgParams === 'string' ? msgParams : (msgParams?.message || msgParams?.text || JSON.stringify(msgParams));
            history.push({ role: 'user', parts: [{ text: userContent }] });
            let accumulatedText = '';
            const stream = await getGeminiClient(customKey).models.generateContentStream({
              model,
              contents: history,
              config,
              strictModel: isStrict
            });
            for await (const chunk of stream) {
              if (chunk?.text) accumulatedText += chunk.text;
              yield chunk;
            }
            if (accumulatedText) {
              history.push({ role: 'model', parts: [{ text: accumulatedText }] });
            }
          }
        };
      }
    }
  };
};

export const clientGenerateContent = async (params: any) => {
  return getGeminiClient().models.generateContent(params);
};

export const clientGenerateContentStream = async function* (params: any) {
  const stream = await getGeminiClient().models.generateContentStream(params);
  yield* stream;
};

export const checkIsQuotaExceeded = (error: any): boolean => {
  if (!error) return false;
  
  let parsedError = error;
  if (typeof error === 'string') {
    try {
      parsedError = JSON.parse(error);
    } catch (e) {
      const isQuota = error.toLowerCase().includes('quota');
      if (isQuota) logger.info('Quota exceeded detected in error string');
      return isQuota;
    }
  }

  try {
    const errObj = parsedError?.error || parsedError;
    const message = String(errObj?.message || parsedError?.message || '');
    const isQuota = message.toLowerCase().includes('quota');
    if (isQuota) logger.info('Quota exceeded detected in error object');
    return isQuota;
  } catch (e) {
    return false;
  }
};

export const checkIsRateLimited = (error: any): boolean => {
  if (!error) return false;
  
  // Try to parse if it's a string
  let parsedError = error;
  if (typeof error === 'string') {
    try {
      parsedError = JSON.parse(error);
    } catch (e) {
      // Not JSON, just check the string
      const isRate = error.includes('429') || error.includes('RESOURCE_EXHAUSTED');
      if (isRate) logger.info('Rate limited detected in error string');
      return isRate;
    }
  }

  try {
    const errObj = parsedError?.error || parsedError;
    const code = errObj?.code || parsedError?.code;
    const status = errObj?.status || parsedError?.status;
    const message = String(errObj?.message || parsedError?.message || '');
    const name = errObj?.name || parsedError?.name;
    
    const isRate = (
      Number(code) === 429 || 
      Number(status) === 429 || 
      status === 'RESOURCE_EXHAUSTED' ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('429')
    );
    if (isRate) logger.info('Rate limited detected in error object');
    return isRate;
  } catch (e) {
    return false;
  }
};

export const withRetry = async <T,>(fn: () => Promise<T>, retries = 10, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    logger.warn('API Error Caught, checking for transient/quota conditions:', error?.message || error);
    const isRateLimited = checkIsRateLimited(error);
    const isQuotaExceeded = checkIsQuotaExceeded(error);
    const msg = String(error?.message || error || '').toLowerCase();
    const isBadRequest = msg.includes('400') || msg.includes('invalid_argument') || msg.includes('api_key_invalid');
    const isTransient = isRateLimited || isQuotaExceeded || msg.includes('503') || msg.includes('502') || msg.includes('504') || msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('timeout') || msg.includes('network') || msg.includes('failed to fetch');

    if (retries > 0 && !isBadRequest && isTransient) {
      const waitTime = isQuotaExceeded 
        ? delay + (Math.random() * 1500)
        : delay + (Math.random() * 1000);
        
      logger.info(`Transient/Quota condition detected. Auto-retrying silently in ${Math.round(waitTime)}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRetry(fn, retries - 1, delay * 1.2);
    }
    throw error;
  }
};

