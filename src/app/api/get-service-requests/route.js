import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";

const schema = z.object({
  city: z.string().min(1, "City is required"),
});

export async function POST(req) {
  await connectDb();
  try {
    const body = await req.json();
    const validated = schema.parse(body);

    const requests = await ServiceRequests.find({
      city: validated.city,
    }).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("❌ Error fetching city requests:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
