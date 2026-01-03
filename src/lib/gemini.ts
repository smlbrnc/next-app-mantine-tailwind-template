import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisData } from "./types";

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface AnalysisRequest {
  coinName: string;
  symbol: string;
  price: number;
  volume: number;
  rsi: number;
  ema: number;
  adx: number;
  pdi: number;
  mdi: number;
  candle: {
    open: number;
    close: number;
    high: number;
    low: number;
  };
}

export async function generateAnalysis(request: AnalysisRequest): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini API key is not configured");
  }

  // Use gemini-3-pro-preview model as shown in the curl example
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

  const prompt = createAnalysisPrompt(request);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text.trim();
  } catch (error: any) {
    console.error("Gemini API error:", error);
    
    // Better error messages
    if (error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("Quota exceeded")) {
      throw new Error("API quota limitine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
    }
    if (error?.message?.includes("API_KEY") || error?.message?.includes("401") || error?.message?.includes("403")) {
      throw new Error("Geçersiz API key. Lütfen .env.local dosyasındaki GOOGLE_GEMINI_API_KEY değerini kontrol edin.");
    }
    
    throw new Error(`Analiz oluşturulurken bir hata oluştu: ${error?.message || "Bilinmeyen hata"}`);
  }
}

function createAnalysisPrompt(request: AnalysisRequest): string {
  const {
    coinName,
    symbol,
    price,
    volume,
    rsi,
    ema,
    adx,
    pdi,
    mdi,
    candle,
  } = request;

  return `Sen bir kripto para teknik analiz uzmanısın. Aşağıdaki ${coinName} (${symbol}) kripto para birimi için teknik analiz yap ve Türkçe olarak detaylı bir analiz raporu hazırla.

**Fiyat Bilgileri:**
- Güncel Fiyat: $${price.toFixed(2)}
- Hacim: ${volume.toFixed(2)}

**Teknik Göstergeler:**
- RSI (Relative Strength Index): ${rsi.toFixed(2)}
- EMA (Exponential Moving Average): $${ema.toFixed(2)}
- ADX (Average Directional Index): ${adx.toFixed(2)}
- PDI (+DI): ${pdi.toFixed(2)}
- MDI (-DI): ${mdi.toFixed(2)}

**Mum Verileri:**
- Açılış: $${candle.open.toFixed(2)}
- Kapanış: $${candle.close.toFixed(2)}
- Yüksek: $${candle.high.toFixed(2)}
- Düşük: $${candle.low.toFixed(2)}

Lütfen şunları analiz et:
1. RSI değerinin yorumlanması (aşırı alım/satım durumu)
2. EMA ve fiyat ilişkisi (trend analizi)
3. ADX, PDI ve MDI değerlerinin yorumlanması (trend gücü ve yönü)
4. Mum pattern analizi (açılış, kapanış, yüksek, düşük ilişkisi)
5. Genel trend değerlendirmesi
6. Kısa vadeli öneriler (alım/satım/tutma)

Analizi 200-300 kelime arasında, profesyonel ve anlaşılır bir dille Türkçe olarak yaz. Teknik terimleri açıkla ve yatırımcılar için pratik öneriler sun.`;
}
