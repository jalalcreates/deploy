import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function middleware(request) {
  console.log("middleware...");

  const rt = request.cookies.get("refreshToken");
  const at = request.cookies.get("accessToken");

  const url = request.nextUrl.clone();
  const isLoginPath = url.pathname === "/login";
  // Skip static files
  if (
    url.pathname.startsWith("/_next") ||
    /\.(ico|jpg|png|svg|css|js)$/.test(url.pathname)
  ) {
    return NextResponse.next();
  }

  let fullUrl = `${url.protocol}//${url.host}/api/renew-token`;
  if (rt && !at) {
    const response = await fetch(fullUrl, {
      method: "POST",
      body: JSON.stringify({ refreshToken: rt }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    // console.log({ data });
    const res = NextResponse.next();
    if (data?.success) {
      res.cookies.set("accessToken", data.newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 9 * 60,
      });
      if (isLoginPath) {
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return res;
    }
  }

  fullUrl = `${url.protocol}//${url.host}/api/authenticate`;
  const response = await axios.post(fullUrl, {
    accessToken: at,
    refreshToken: rt,
  });
  const { success, username } = response.data;

  if (!success && !username && !isLoginPath) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  } else if (success && username && isLoginPath) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|static|.*\\..*).*)"], // Match all paths except _next, api, static, and static file extensions
};
