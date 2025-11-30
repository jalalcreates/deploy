import { NextResponse } from "next/server";
import { getAudio } from "@/Actions/Audio/audio";

export async function POST(request) {
  try {
    const { audioId } = await request.json();
    if (!audioId) {
      return NextResponse.json(
        { success: false, error: "audioId required" },
        { status: 400 }
      );
    }

    const result = await getAudio(audioId);

    if (!result || !result.result) {
      return NextResponse.json(
        { success: false, error: "Audio not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      contentType: result.contentType,
    });
  } catch (error) {
    console.error("Error in /api/get-audio:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
