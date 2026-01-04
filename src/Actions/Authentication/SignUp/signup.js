"use server";

import User from "@/Database/Schemas/User/user";
import { validateUser } from "@/Zod/Authentication/schema";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import bcrypt from "bcrypt";
import { createTokens } from "@/Sessions/sessions";

export async function signUp(formData) {
  try {
    const isConnected = await connectDb();
    console.log({ isConnected });
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

    const existingUser = await User.findOne({
      username: validationResult.data.username,
    });
    if (existingUser) {
      console.log(
        `User with the username: ${validationResult.data.username} already exists.`
      );
      return {
        usernamePresent: true,
        success: false,
      };
    }

    const newUser = new User({
      username: validationResult.data.username,
      password: await bcrypt.hash(validationResult.data.password, 10),
    });
    await newUser.save();

    const { accessToken } = await createTokens(validationResult.data.username);

    return {
      success: true,
      usernamePresent: false,
      redirectUrl: "/",
      accessToken,
    };
  } catch (error) {
    console.error("Error Signing Up: ", error);
    return {
      success: false,
      message: "Sign-up failed due to server error.",
    };
  }
}
