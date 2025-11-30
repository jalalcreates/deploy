import { connectDb } from "@/Database/ConnectDb/connectdb";
import RefreshToken from "@/Database/Schemas/Tokens/token";
import { verifyToken } from "@/Sessions/sessions";
import { NextResponse } from "next/server";

export async function POST(request) {
  await connectDb();
  try {
    const { accessToken, refreshToken } = await request.json();
    if (!accessToken) return NextResponse.json({ success: false });
    //checking presence of refresh token
    if (!refreshToken) return NextResponse.json({ success: false });

    const { refreshTokens } = await RefreshToken.findOne({
      refreshTokens: refreshToken.value,
    });
    const existingToken = refreshTokens.find(
      (token) => token === refreshToken.value
    );

    //checking the refresh token in database
    if (!existingToken) return NextResponse.json({ success: false });

    const payload1 = await verifyToken(existingToken);
    const payload2 = await verifyToken(refreshToken.value);
    //comparing the payloads
    if (payload1?.username !== payload2?.username)
      return NextResponse.json({ success: false });

    const payload3 = await verifyToken(accessToken.value);

    if (payload3?.username !== payload1.username)
      return NextResponse.json({ success: false });

    return NextResponse.json({ success: true, username: payload1.username });
  } catch (error) {
    console.log(`Error while posting to Authenticate API. Error " ${error}`);
  }
}
