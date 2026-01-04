// app/api/socket-auth/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken");

    if (!accessToken || !accessToken.value) {
      return NextResponse.json(
        {
          success: false,
          error: "No access token found",
        },
        { status: 401 }
      );
    }
    // console.log("Socket-auth cookies:", cookieStore.getAll());

    // Return the token securely
    return NextResponse.json(
      {
        success: true,
        token: accessToken.value,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Socket auth API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve authentication token",
      },
      { status: 500 }
    );
  }
}
