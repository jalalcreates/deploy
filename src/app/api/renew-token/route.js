import { NextResponse } from "next/server";
import { verifyToken, generateToken } from "@/Sessions/sessions";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import RefreshToken from "@/Database/Schemas/Tokens/token";

export async function POST(request) {
  try {
    const isConnected = await connectDb();
    // console.log({ isConnected });
    const { refreshToken } = await request.json();
    // console.log({ refreshToken });
    if (!refreshToken) {
      console.log("No refresh token found in request body");
      return NextResponse.json({ success: false });
    }
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        message: "Database not connected yet.",
      });
    }
    const result = await RefreshToken.findOne({
      refreshTokens: refreshToken.value,
    });
    // console.log({ refreshTokens });
    if (!result) {
      return NextResponse.json({
        success: false,
        message: "No Token found in the database",
      });
    }
    // console.log({ result });
    const existingToken = result?.refreshTokens.find(
      (token) => token === refreshToken.value
    );
    // console.log({ existingToken });

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
    // console.log({ newAccessToken });
    return NextResponse.json({ success: true, newAccessToken });

    // response.cookies.set("accessToken", newAccessToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "strict",
    //   maxAge: 9 * 60, // 9 minutes in seconds
    // });

    // return response;
  } catch (error) {
    console.log(`Error while posting to the API. Error : ${error}`);
    return NextResponse.json(
      { success: false, message: "Internal server error during token renewal" }
      // Use 500 status code for server-side errors
    );
  }
}
