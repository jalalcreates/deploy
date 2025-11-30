import "server-only";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/Sessions/sessions";

export async function getUserData(accessToken) {
  await connectDb();

  if (!accessToken) return { user: false };
  const result = await isAuthenticated(accessToken);
  if (!result.success && !result.username) return redirect(result.redirectUrl);

  const user = await User.findOne({ username: result.username });

  if (!user) return { user: false };
  const plainUser = user.toObject();

  return { user: plainUser };
}
