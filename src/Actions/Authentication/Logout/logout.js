"use server";

import { deleteSession } from "@/Sessions/sessions";

export async function logout() {
  deleteSession();
}
