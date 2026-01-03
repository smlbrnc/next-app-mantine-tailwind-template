import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis, AnalysisRequest } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();

    // Validation
    if (
      !body.coinName ||
      !body.symbol ||
      typeof body.price !== "number" ||
      typeof body.volume !== "number" ||
      typeof body.rsi !== "number" ||
      typeof body.ema !== "number" ||
      typeof body.adx !== "number" ||
      typeof body.pdi !== "number" ||
      typeof body.mdi !== "number" ||
      !body.candle
    ) {
      return NextResponse.json(
        { error: "Geçersiz istek parametreleri" },
        { status: 400 }
      );
    }

    const analysis = await generateAnalysis(body);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analysis API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Analiz oluşturulurken bir hata oluştu",
      },
      { status: 500 }
    );
  }
}
