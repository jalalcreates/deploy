"use client";
import React from "react";
import { redirect } from "next/navigation";
import axios from "axios";
import { useRouter } from "next/navigation";

export async function renewAccessToken(rt) {
  try {
    const response = await axios.post("/api/renew-token", {
      refreshToken: rt,
    });
    const result = response.data;
    if (!result.success && !result.newAccessToken) return null;
    return result.newAccessToken;
  } catch (error) {
    console.log(`Error posting to api in token.js . Error : ${error}`);
  }
}

export default function TokenRenewal(props) {
  React.useEffect(() => {
    const handleTokenRenewal = async () => {
      const result = await renewAccessToken(props.rt);
      if (!result) return useRouter().push("/login");
    };

    const intervalId = setInterval(handleTokenRenewal, 9 * 60 * 1000); // Renew token every 9 minutes
    return () => clearInterval(intervalId);
  }, []);
  return <></>;
}
