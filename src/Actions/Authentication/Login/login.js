"use server";

import User from "@/Database/Schemas/User/user";
import { validateUser } from "@/Zod/Authentication/schema";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import bcrypt from "bcrypt";
import { createTokens } from "@/Sessions/sessions";

export async function login(formData) {
  connectDb();
  try {
    const validationResult = validateUser.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });
    if (!validationResult.success) {
      console.error(
        "Validation error at: ",
        validationResult.error.issues[0].path[0],
        "input. Error: ",
        validationResult.error.issues[0].message
      );
      return {
        success: false,
        message: validationResult.error.issues[0].message,
      };
    }

    const user = await User.findOne({
      username: validationResult.data.username,
    });
    if (user) {
      const passwordMatched = await bcrypt.compare(
        validationResult.data.password,
        user.password
      );
      if (passwordMatched) {
        const { accessToken } = await createTokens(user.username);
        return {
          success: true,
          accessToken,
          redirectUrl: "/",
        };
      }
      return {
        success: false,
        passwordMatched: false,
        redirectUrl: "/login",
      };
    }
    return {
      success: false,
      redirectUrl: "/login",
    };
  } catch (error) {
    console.log(`Error Loggin In. Error : ${error}`);
  }
}
