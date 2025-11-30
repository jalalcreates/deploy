import { NextResponse } from "next/server";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { saveAudio, isValidAudioFile } from "@/Actions/Audio/audio";

export async function POST(req) {
  try {
    await connectDb();

    const formData = await req.formData();

    // Extract form fields
    const orderId = formData.get("orderId");
    const freelancerUsername = formData.get("freelancerUsername");
    const clientUsername = formData.get("clientUsername");
    const notes = formData.get("notes") || "";

    // Extract files
    const proofImages = formData.getAll("proofImages");
    const audioRecording = formData.get("audioRecording");

    // Validate required fields
    if (!orderId || !freelancerUsername || !clientUsername) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: orderId, freelancerUsername, clientUsername",
        },
        { status: 400 }
      );
    }

    // Validate proof images (at least one required)
    if (proofImages?.length === 0 || proofImages[0].size === 0) {
      return NextResponse.json(
        { error: "At least one proof image is required" },
        { status: 400 }
      );
    }

    // Find both users
    const freelancer = await User.findOne({ username: freelancerUsername });
    const client = await User.findOne({ username: clientUsername });

    if (!freelancer || !client) {
      return NextResponse.json(
        { error: "Freelancer or client not found" },
        { status: 404 }
      );
    }

    // Find the orders in both users' arrays
    const freelancerOrder = freelancer.pendingOrders.find(
      (o) => o.orderId === orderId
    );

    const clientOrder = client.ordersGiven.find((o) => o.orderId === orderId);

    if (!freelancerOrder || !clientOrder) {
      return NextResponse.json(
        { error: "Order not found in one or both user accounts" },
        { status: 404 }
      );
    }

    // Validate order status - only allow completion on in-progress orders
    if (
      freelancerOrder.status !== "in-progress" ||
      clientOrder.status !== "in-progress"
    ) {
      return NextResponse.json(
        { error: "Service completion only allowed on in-progress orders" },
        { status: 400 }
      );
    }

    // Create proof directory if it doesn't exist
    const proofDir = path.join(process.cwd(), "images", "proofs");
    try {
      await mkdir(proofDir, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        console.error("Error creating proof directory:", error);
        return NextResponse.json(
          { error: "Failed to create storage directory" },
          { status: 500 }
        );
      }
    }

    // Process and save proof images
    const savedImagePaths = [];

    for (let i = 0; i < proofImages.length; i++) {
      const image = proofImages[i];

      if (image.size === 0) continue; // Skip empty files

      // Validate file type
      if (!image.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `File ${image.name} is not a valid image` },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB per image)
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Image ${image.name} is too large. Maximum size is 5MB` },
          { status: 400 }
        );
      }

      try {
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const fileExtension = path.extname(image.name) || ".jpg";
        const uniqueFileName = `${orderId}_${uuidv4()}${fileExtension}`;
        const filePath = path.join(proofDir, uniqueFileName);

        // Save file
        await writeFile(filePath, buffer);
        savedImagePaths.push(uniqueFileName);

        console.log(`Saved proof image: ${uniqueFileName}`);
      } catch (error) {
        console.error("Error saving image:", error);
        return NextResponse.json(
          { error: `Failed to save image ${image.name}` },
          { status: 500 }
        );
      }
    }

    // Process audio recording if provided (using your existing audio system)
    let audioId = null;
    if (audioRecording && audioRecording.size > 0) {
      try {
        // Validate audio file using your existing function
        if (!isValidAudioFile(audioRecording)) {
          return NextResponse.json(
            { error: "Invalid audio file: type or size" },
            { status: 400 }
          );
        }

        // Save audio using your existing function
        const { id } = await saveAudio(audioRecording);
        audioId = id;
        console.log(`Saved audio recording with ID: ${audioId}`);
      } catch (error) {
        console.error("Error saving audio:", error);
        // Don't fail the entire request for audio issues
        console.warn("Continuing without audio recording");
      }
    }

    // Update order completion data
    const completionTime = new Date();
    const proofPictures = {
      before: freelancerOrder.proofPictures?.before || [],
      after: savedImagePaths,
      description: notes,
    };

    // Update freelancer's order
    freelancerOrder.status = "completed";
    freelancerOrder.finishDate = completionTime;
    freelancerOrder.proofPictures = proofPictures;

    if (audioId) {
      freelancerOrder.problemAudioId = audioId; // Store the audio ID from your system
    }

    // Update client's order (mirror the changes)
    clientOrder.status = "completed";
    clientOrder.finishDate = completionTime;
    clientOrder.proofPictures = proofPictures;

    if (audioId) {
      clientOrder.problemAudioId = audioId;
    }

    // Save both users
    await Promise.all([freelancer.save(), client.save()]);

    // Update freelancer's completed orders count
    await User.findByIdAndUpdate(freelancer._id, {
      $inc: { totalOrdersRecieved: 1 },
    });

    // Return updated orders for the freelancer
    const updatedFreelancer = await User.findById(freelancer._id);
    const mergedOrders = [
      ...(updatedFreelancer.ordersGiven || []).map((o) => ({
        ...o.toObject(),
        type: "given",
      })),
      ...(updatedFreelancer.pendingOrders || []).map((o) => ({
        ...o.toObject(),
        type: "received",
      })),
    ];

    return NextResponse.json(
      {
        message:
          "Service completed successfully. Proof uploaded and client will be notified.",
        updatedOrders: mergedOrders,
        orderId: orderId,
        proofImages: savedImagePaths,
        audioId: audioId,
        completedAt: completionTime.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Service completion API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
