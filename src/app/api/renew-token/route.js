import { NextResponse } from "next/server";
import { verifyToken, generateToken } from "@/Sessions/sessions";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import RefreshToken from "@/Database/Schemas/Tokens/token";

export async function POST(request) {
  await connectDb();
  try {
    const { refreshToken } = await request.json();
    if (!refreshToken) {
      console.log("No refresh token found in request body");
      return NextResponse.json({ success: false });
    }

    const { refreshTokens } = await RefreshToken.findOne({
      refreshTokens: refreshToken.value,
    });

    const existingToken = refreshTokens.find(
      (token) => token === refreshToken.value
    );

    if (!existingToken) {
      console.log("No token found in database");
      return NextResponse.json({ success: false });
    }

    const payload1 = await verifyToken(existingToken);
    const payload2 = await verifyToken(refreshToken.value);

    if (payload1.username !== payload2.username) {
      console.log("Payloads dod not match");
      return NextResponse.json({ success: false });
    }

    const newAccessToken = await generateToken(
      { username: payload1.username },
      "10m"
    );
    const response = NextResponse.json({ success: true, newAccessToken });

    response.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 9 * 60, // 9 minutes in seconds
    });

    return response;
  } catch (error) {
    console.log(`Error while posting to the API. Error : ${error}`);
  }
}
