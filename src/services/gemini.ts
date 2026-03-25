import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

// Using Flash for higher rate limits and faster responses
export const MODEL_NAME = "gemini-3-flash-preview";

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = 
      error.message?.includes("429") || 
      error.status === 429 || 
      error.message?.includes("RESOURCE_EXHAUSTED") ||
      error.message?.includes("503") ||
      error.status === 503 ||
      error.message?.includes("Service Unavailable");

    if (retries > 0 && isRetryable) {
      console.log(`Retrying API call... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

export interface RiskProfile {
  score: number; // 1-10
  label: string;
  description: string;
}

export interface Allocation {
  assetClass: string;
  percentage: number;
  description: string;
  ticker?: string;
}

export interface Portfolio {
  allocations: Allocation[];
  totalValue: number;
  riskProfile: RiskProfile;
  reasoning: string;
}

export async function generateRiskQuestion(history: { role: string; text: string }[]) {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { 
          role: "user", 
          parts: [{ 
            text: `Sei Aura, un robo-advisor di lusso. Fai una domanda alla volta in italiano per capire il profilo di rischio dell'utente. 
            Usa un tono amichevole, usa le emoji per rendere la chat meno fitta e più accogliente. 
            Non scrivere paragrafi lunghi. Sii intuitivo e semplice.` 
          }] 
        },
        ...history.map(h => ({ role: h.role as any, parts: [{ text: h.text }] }))
      ],
      config: {
        temperature: 0.8,
      }
    });
    return response.text;
  });
}

export async function evaluateRiskProfile(history: { role: string; text: string }[]): Promise<RiskProfile> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { role: "user", parts: [{ text: "Analizza la conversazione e restituisci il profilo di rischio dell'utente in formato JSON. Sii preciso nel punteggio." }] },
        ...history.map(h => ({ role: h.role as any, parts: [{ text: h.text }] }))
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Punteggio da 1 a 10" },
            label: { type: Type.STRING, description: "E.g. Conservativo, Moderato, Aggressivo" },
            description: { type: Type.STRING, description: "Breve descrizione del profilo (max 2 frasi)" }
          },
          required: ["score", "label", "description"]
        }
      }
    });
    return JSON.parse(response.text);
  });
}

export async function generatePortfolio(riskProfile: RiskProfile, amount: number): Promise<Portfolio> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { 
          role: "user", 
          parts: [{ 
            text: `Crea un portafoglio di investimento per un capitale di ${amount}€ basato su questo profilo di rischio: ${JSON.stringify(riskProfile)}. 
            Usa tecniche accademiche di asset allocation. 
            Simula dati da Yahoo Finance e Bloomberg per il sentiment attuale. 
            La spiegazione (reasoning) deve essere semplice, usare emoji, essere divisa in brevi punti e molto intuitiva per chi non sa nulla di finanza. 
            Rispondi in JSON.` 
          }] 
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            allocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  assetClass: { type: Type.STRING },
                  percentage: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  ticker: { type: Type.STRING }
                },
                required: ["assetClass", "percentage", "description"]
              }
            },
            reasoning: { type: Type.STRING, description: "Spiegazione semplice e intuitiva con emoji" }
          },
          required: ["allocations", "reasoning"]
        }
      }
    });
    
    const data = JSON.parse(response.text);
    return {
      ...data,
      totalValue: amount,
      riskProfile
    };
  });
}

export async function chatWithAdvisor(portfolio: Portfolio, message: string, history: { role: string; text: string }[]) {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { 
          role: "user", 
          parts: [{ 
            text: `Sei Aura, un robo-advisor di lusso. Questo è il portafoglio dell'utente: ${JSON.stringify(portfolio)}. 
            Rispondi in italiano. 
            REGOLE DI STILE:
            1. Usa molte emoji per rendere il testo visivamente leggero.
            2. Scrivi paragrafi brevissimi (max 2 righe).
            3. Usa elenchi puntati se devi spiegare più cose.
            4. Evita termini tecnici complessi o spiegali con metafore semplici.
            5. Sii rassicurante e caloroso.` 
          }] 
        },
        ...history.map(h => ({ role: h.role as any, parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        temperature: 0.8,
      }
    });
    return response.text;
  });
}
