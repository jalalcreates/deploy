import "server-only";
import RefreshToken from "@/Database/Schemas/Tokens/token";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDb } from "@/Database/ConnectDb/connectdb";

const secret = process.env.JWT_SECRET;
const encoder = new TextEncoder();
const key = encoder.encode(secret);

// Generate JWT token
export async function generateToken(payload, expiresIn) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(key);
}

export async function createTokens(username) {
  try {
    await connectDb();
    const refreshToken = await generateToken({ username }, "10d");
    const accessToken = await generateToken({ username }, "10m");

    const cookie = cookies();
    cookie.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 10, // 10 days
    });
    cookie.set("accessToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 9 * 60, // 9 minutes
    });
    //save the refresh token to the database here
    const token = await RefreshToken.findOneAndUpdate(
      {},
      { $push: { refreshTokens: refreshToken } },
      { upsert: true }
    );
    await token.save();
    return { accessToken };
  } catch (error) {
    console.log(`Error in createTokens() function. Error : ${error}`);
  }
}

export async function verifyToken(token) {
  try {
    const result = await jwtVerify(token, key, { algorithms: ["HS256"] });
    !result.payload && console.log("verifyToken() gave no payload");
    return result.payload;
  } catch (error) {
    return null;
  }
}

export async function isAuthenticated(accessToken) {
  await connectDb();
  try {
    if (!accessToken) return { success: false, redirectUrl: "/login" };
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken");
    //checking presence of refresh token
    if (!refreshToken) return { success: false, redirectUrl: "/login" };

    const { refreshTokens } = await RefreshToken.findOne({
      refreshTokens: refreshToken.value,
    });
    const existingToken = refreshTokens.find(
      (token) => token === refreshToken.value
    );
    //checking the refresh token in database
    if (!existingToken) return { success: false, redirectUrl: "/login" };
    const payload1 = await verifyToken(existingToken);
    const payload2 = await verifyToken(refreshToken.value);
    //comparing the payloads
    if (payload1?.username !== payload2?.username) {
      console.log("payloads des not match");

      return { success: false, redirectUrl: "/login" };
    }

    const payload3 = await verifyToken(accessToken);
    if (payload3?.username !== payload1.username) {
      console.log("payloads does not match again");
      return { success: false, redirectUrl: "/login" };
    }

    return { success: true, username: payload1.username };
  } catch (error) {
    console.log(`Errorin isAuthenticated() function. Error : ${error}`);
  }
}

export async function renewAccessTokenServer() {
  try {
    // await connectDb();
    const refreshToken = cookies().get("refreshToken");
    console.log(refreshToken);

    //search in the database for the refresh token, decode it and compare the username to the above token.
    if (!refreshToken) {
      console.log("No refresh token found in cookies");
      return { accessToken: false };
    }

    const { refreshTokens } = await RefreshToken.findOne({
      refreshTokens: refreshToken.value,
    });

    const existingToken = refreshTokens.find(
      (token) => token === refreshToken.value
    );

    if (!existingToken) {
      console.log("No token found in database");
      return { accessToken: false };
    }

    const payload1 = await verifyToken(existingToken);
    const payload2 = await verifyToken(refreshToken.value);

    if (payload1.username !== payload2.username) {
      console.log("Payloads dod not match");
      return { accessToken: false };
    }

    const newAccessToken = await generateToken(
      { username: payload1.username },
      "10m"
    );

    return { accessToken: newAccessToken };
  } catch (error) {
    console.log(`Error in renewAccessTokenServer() function. Error : ${error}`);
  }
}

export async function deleteSession() {
  const cookie = cookies();
  const refreshToken = cookie.get("refreshToken");
  await connectDb();
  await RefreshToken.findOneAndUpdate(
    {},
    { $pull: { refreshTokens: refreshToken } }
  );
  cookie.delete("refreshToken");

  return redirect("/login");
}
