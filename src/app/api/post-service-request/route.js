import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { serviceRequestZodSchema } from "@/Zod/ServiceRequest/schema";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";
import { saveAudio, isValidAudioFile } from "@/Actions/Audio/audio";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    await connectDb();

    const formData = await req.formData();
    const formObject = Object.fromEntries(formData.entries());

    // Parse nested objects
    if (formObject.customerInfo) {
      formObject.customerInfo = JSON.parse(formObject.customerInfo);
    }

    if (formObject.expertiseRequired) {
      try {
        formObject.expertiseRequired = JSON.parse(formObject.expertiseRequired);
      } catch {
        formObject.expertiseRequired = formObject.expertiseRequired.split(",");
      }
    }

    // Add phone number to validation
    const validatedData = serviceRequestZodSchema.parse({
      ...formObject,
      phoneNumber: formObject.phoneNumber || "",
      hasImages: formData.getAll("image_0").length > 0,
    });

    // Handle audio
    let audioId = null;
    const audio = formData.get("audio");
    if (audio && audio.size > 0) {
      if (!isValidAudioFile(audio)) {
        return NextResponse.json(
          { success: false, error: "Invalid audio file: type or size" },
          { status: 400 }
        );
      }
      const { id } = await saveAudio(audio);
      audioId = id;
    }

    // Handle images
    let savedImagePaths = [];
    const imageKeys = Array.from(formData.keys()).filter((key) =>
      key.startsWith("image_")
    );

    if (imageKeys.length > 0) {
      const imagesDir = path.join(
        process.cwd(),
        "public",
        "images",
        "service-requests"
      );

      try {
        await mkdir(imagesDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          console.error("Error creating images directory:", error);
          return NextResponse.json(
            { success: false, error: "Failed to create storage directory" },
            { status: 500 }
          );
        }
      }

      // Process each image
      for (const key of imageKeys) {
        const image = formData.get(key);
        if (!image || image.size === 0) continue;

        // Validate image
        if (!image.type.startsWith("image/")) {
          return NextResponse.json(
            {
              success: false,
              error: `File ${image.name} is not a valid image`,
            },
            { status: 400 }
          );
        }

        if (image.size > 5 * 1024 * 1024) {
          // 5MB limit
          return NextResponse.json(
            {
              success: false,
              error: `Image ${image.name} is too large. Maximum size is 5MB`,
            },
            { status: 400 }
          );
        }

        try {
          const bytes = await image.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const fileExtension = path.extname(image.name) || ".jpg";
          const uniqueFileName = `service_req_${
            validatedData.customerInfo.username
          }_${uuidv4()}${fileExtension}`;
          const filePath = path.join(imagesDir, uniqueFileName);

          await writeFile(filePath, buffer);
          savedImagePaths.push(uniqueFileName);

          console.log(`Saved service request image: ${uniqueFileName}`);
        } catch (error) {
          console.error("Error saving image:", error);
          return NextResponse.json(
            { success: false, error: `Failed to save image ${image.name}` },
            { status: 500 }
          );
        }
      }
    }

    // Create service request with atomic operation
    const serviceRequest = await ServiceRequests.create({
      ...validatedData,
      problemAudioId: audioId,
      phoneNumber: validatedData.phoneNumber,
      serviceImages: savedImagePaths, // Add this field to your schema
      requestId: uuidv4(),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      serviceRequest: {
        id: serviceRequest._id,
        requestId: serviceRequest.requestId,
        createdAt: serviceRequest.createdAt,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: err.errors },
        { status: 400 }
      );
    }

    console.error("Error in service request API route:", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
