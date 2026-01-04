import { NextRequest, NextResponse } from "next/server";
import { getIndicatorsFromCache } from "@/lib/supabase/indicators";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coinId = searchParams.get("coin_id");
    const strategy = searchParams.get("strategy") as "swing" | "scalp" | null;

    if (!coinId) {
      return NextResponse.json(
        { error: "coin_id parametresi gereklidir" },
        { status: 400 }
      );
    }

    if (!strategy || (strategy !== "swing" && strategy !== "scalp")) {
      return NextResponse.json(
        { error: "strategy parametresi 'swing' veya 'scalp' olmalıdır" },
        { status: 400 }
      );
    }

    const result = await getIndicatorsFromCache(coinId, strategy);

    if (!result.data) {
      return NextResponse.json(
        { data: null, is_fresh: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      data: result.data,
      is_fresh: result.is_fresh,
    });
  } catch (error) {
    console.error("Error in /api/indicators:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Göstergeler alınırken bir hata oluştu",
      },
      { status: 500 }
    );
  }
}
