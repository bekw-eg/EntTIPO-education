/**
 * Gemini API client for ENT TiPO AI Tutor.
 * Securely calls Google Gemini API exclusively from the server side.
 */

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiContentRequest {
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: any;
  };
}

// In-memory rate limiting: map of key -> timestamp[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests/minute per user

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(identifier) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(identifier, validTimestamps);
  return true;
}

export const FALLBACK_MESSAGES: Record<string, string> = {
  ru: "AI-помощник временно недоступен. Попробуйте ещё раз через несколько секунд.",
  kk: "AI көмекші уақытша қолжетімсіз. Бірнеше секундтан кейін қайталап көріңіз.",
  en: "AI tutor is temporarily unavailable. Please try again in a few moments.",
};

export const RATE_LIMIT_MESSAGES: Record<string, string> = {
  ru: "Слишком много запросов к AI. Пожалуйста, подождите минуту.",
  kk: "AI-ға тым көп сұраныс жасалды. Бір минут күте тұрыңыз.",
  en: "Too many AI requests. Please wait a minute.",
};

/**
 * Calls Gemini generateContent endpoint.
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
    model?: string;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const primaryModel = options?.model || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const candidateModels = [primaryModel, "gemini-3.1-flash-lite", "gemini-3-flash-preview"];

  const payload: GeminiContentRequest = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: 2048,
      ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const timeoutMs = options?.timeoutMs ?? 25000;
  let lastError: any = null;

  for (const currentModel of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 503 || response.status === 429) {
          // Temporary high demand, wait briefly before retrying
          lastError = new Error(`Gemini API status ${response.status}`);
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Gemini API error [${response.status}] for model ${currentModel}:`, errText);
          throw new Error(`Gemini API responded with status ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error("Empty response from Gemini API");
        }

        return text;
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
      }
    }
  }

  throw lastError || new Error("Failed to get response from Gemini API");
}
