import { NextResponse } from "next/server";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { saveAudio, isValidAudioFile } from "@/Actions/Audio/audio";
import { clientFeedbackSchema } from "@/Zod/PopUp Modals/schema.server";

export async function POST(req) {
  try {
    await connectDb();

    const formData = await req.formData();

    // Extract and validate basic form fields
    const formFields = {
      orderId: formData.get("orderId"),
      clientUsername: formData.get("clientUsername"),
      freelancerUsername: formData.get("freelancerUsername"),
      satisfied: formData.get("satisfied") === "true",
      rating: parseInt(formData.get("rating")) || 0,
      review: formData.get("review") || "",
      wouldRecommend: formData.get("wouldRecommend") === "true",
      textFeedback: formData.get("textFeedback") || "",
    };
    // Validate using Zod schema
    const validationResult = clientFeedbackSchema.safeParse(formFields);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;
    clg("Validated data:", validatedData);
    const feedbackImages = formData.getAll("feedbackImages");
    const audioFeedback = formData.get("audioFeedback");
    console.log({ feedbackImages, audioFeedback });

    // Find both users
    const client = await User.findOne({
      username: validatedData.clientUsername,
    });
    const freelancer = await User.findOne({
      username: validatedData.freelancerUsername,
    });

    if (!client || !freelancer) {
      return NextResponse.json(
        { error: "Client or freelancer not found" },
        { status: 404 }
      );
    }

    // Find the orders in both users' arrays using the actual schema fields
    const clientOrder = client.ordersGiven.find(
      (o) => o.orderId === validatedData.orderId
    );

    const freelancerOrder = freelancer.pendingOrders.find(
      (o) => o.orderId === validatedData.orderId
    );

    if (!clientOrder || !freelancerOrder) {
      return NextResponse.json(
        { error: "Order not found in one or both user accounts" },
        { status: 404 }
      );
    }

    // Validate order status - only allow feedback on completed orders
    if (
      clientOrder.status !== "completed" ||
      freelancerOrder.status !== "completed"
    ) {
      return NextResponse.json(
        { error: "Feedback only allowed on completed orders" },
        { status: 400 }
      );
    }

    let savedFeedbackImages = [];
    let audioFeedbackId = null;

    // Process feedback images for unsatisfied customers
    if (
      !validatedData.satisfied &&
      feedbackImages &&
      feedbackImages.length > 0 &&
      feedbackImages[0].size > 0
    ) {
      // Validate images
      if (feedbackImages.length > 4) {
        return NextResponse.json(
          { error: "Maximum 4 images allowed" },
          { status: 400 }
        );
      }

      // Create feedback directory
      const feedbackDir = path.join(
        process.cwd(),
        "public",
        "images",
        "feedback"
      );
      try {
        await mkdir(feedbackDir, { recursive: true });
      } catch (error) {
        if (error.code !== "EEXIST") {
          console.error("Error creating feedback directory:", error);
          return NextResponse.json(
            { error: "Failed to create storage directory" },
            { status: 500 }
          );
        }
      }

      // Process each image
      for (const image of feedbackImages) {
        if (image.size === 0) continue;

        // Validate image
        if (!image.type.startsWith("image/")) {
          return NextResponse.json(
            { error: `File ${image.name} is not a valid image` },
            { status: 400 }
          );
        }

        if (image.size > 5 * 1024 * 1024) {
          // 5MB limit
          return NextResponse.json(
            { error: `Image ${image.name} is too large. Maximum size is 5MB` },
            { status: 400 }
          );
        }

        try {
          const bytes = await image.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const fileExtension = path.extname(image.name) || ".jpg";
          const uniqueFileName = `feedback_${
            validatedData.orderId
          }_${uuidv4()}${fileExtension}`;
          const filePath = path.join(feedbackDir, uniqueFileName);

          await writeFile(filePath, buffer);
          savedFeedbackImages.push(uniqueFileName);

          console.log(`Saved feedback image: ${uniqueFileName}`);
        } catch (error) {
          console.error("Error saving feedback image:", error);
          return NextResponse.json(
            { error: `Failed to save image ${image.name}` },
            { status: 500 }
          );
        }
      }
    }

    // Process audio feedback for unsatisfied customers
    if (!validatedData.satisfied && audioFeedback && audioFeedback.size > 0) {
      try {
        if (!isValidAudioFile(audioFeedback)) {
          return NextResponse.json(
            { error: "Invalid audio file: type or size" },
            { status: 400 }
          );
        }

        const { id } = await saveAudio(audioFeedback);
        audioFeedbackId = id;
        console.log(`Saved feedback audio with ID: ${audioFeedbackId}`);
      } catch (error) {
        console.error("Error saving feedback audio:", error);
        // Continue without audio if it fails
        console.warn("Continuing without audio feedback");
      }
    }

    const reviewTime = new Date();

    // Update CLIENT'S ORDER (ordersGiven) - using actual schema fields
    clientOrder.isSatisfied = validatedData.satisfied;
    clientOrder.review = validatedData.review;

    // Add feedback data to client's order (you'll need to add these fields to schema)
    if (!validatedData.satisfied) {
      freelancerOrder.clientUnsatisfiedFeedback = {
        satisfied: validatedData.satisfied,
        textFeedback: validatedData.textFeedback,
        feedbackImages: savedFeedbackImages,
        audioFeedbackId,
        rating: validatedData.rating,
        wouldRecommend: validatedData.wouldRecommend,
        submittedAt: reviewTime,
      };
    }
    // Update FREELANCER'S ORDER (pendingOrders) - using actual schema fields
    freelancerOrder.isSatisfied = validatedData.satisfied;
    freelancerOrder.review = validatedData.review;
    // Add client review data to freelancer's order (you'll need to add this field to schema)
    // freelancerOrder.clientReview = {
    //   review: validatedData.review,
    //   stars: validatedData.rating,
    //   wouldRecommend: validatedData.wouldRecommend,
    //   submittedAt: reviewTime,
    // };

    // Add review to FREELANCER'S REVIEWS array (using existing schema)
    const reviewObject = {
      customerInfo: {
        username: validatedData.clientUsername,
        profilePicture: client.profilePicture || null,
      },
      review: validatedData.review,
      stars: validatedData.rating,
    };

    freelancer.reviews.push(reviewObject);

    // Update FREELANCER'S CUSTOMER STATS (using existing schema)
    if (validatedData.satisfied) {
      freelancer.customers.satisfiedCustomers += 1;
    } else {
      freelancer.customers.unsatisfiedCustomers += 1;
    }

    // Recalculate FREELANCER'S AVERAGE RATING (using existing schema)
    const totalReviews = freelancer.reviews.length;
    const totalStars = freelancer.reviews.reduce(
      (sum, r) => sum + (r.stars || 0),
      0
    );
    freelancer.averageStars = totalReviews > 0 ? totalStars / totalReviews : 0;
    if (validatedData.wouldRecommend) {
      freelancer.recommended += 1;
    }

    // Add to FREELANCER'S COMPLETED ORDERS (using existing schema)
    if (validatedData.satisfied) {
      freelancer.ordersCompleted.push({
        customerInfo: {
          username: validatedData.freelancerUsername,
          profilePicture: freelancer.profilePicture || null,
        },
        satisfied: validatedData.satisfied,
        review: validatedData.review,
        stars: validatedData.rating,
        date: reviewTime,
      });
    }

    // Save both users
    await Promise.all([client.save(), freelancer.save()]);

    // Return updated orders for the client
    const updatedClient = await User.findById(client._id);
    const mergedOrders = [
      ...(updatedClient.ordersGiven || []).map((o) => ({
        ...o.toObject(),
        type: "given",
      })),
      ...(updatedClient.pendingOrders || []).map((o) => ({
        ...o.toObject(),
        type: "received",
      })),
    ];

    const successMessage = validatedData.satisfied
      ? "Thank you for your positive feedback and review!"
      : "Thank you for your feedback. We will address your concerns.";

    return NextResponse.json(
      {
        message: successMessage,
        updatedOrders: mergedOrders,
        orderId: validatedData.orderId,
        satisfied: validatedData.satisfied,
        rating: validatedData.rating,
        reviewSubmitted: true,
        feedbackImages: savedFeedbackImages,
        audioFeedbackId: audioFeedbackId,
        freelancerNewRating: freelancer.averageStars,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Client feedback API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
