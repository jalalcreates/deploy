"use server";

import { connectDb } from "@/Database/ConnectDb/connectdb";
import User from "@/Database/Schemas/User/user";
import { stripe } from "@/Utils/Stripe/stripe";
import { orderSchema } from "@/Zod/Orders/schema";
import { saveAudio, isValidAudioFile } from "@/Actions/Audio/audio";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import mongoose from "mongoose";

export async function createOrder(
  formData,
  clientUsername,
  freelancerUsername
) {
  try {
    await connectDb();

    const formObject = Object.fromEntries(formData.entries());

    // Parse expertise required
    if (formObject.expertiseRequired) {
      try {
        formObject.expertiseRequired = JSON.parse(formObject.expertiseRequired);
      } catch {
        formObject.expertiseRequired = formObject.expertiseRequired.split(",");
      }
    }

    // Validate with Zod
    const validated = orderSchema.parse({
      ...formObject,
      phoneNumber: formObject.phoneNumber || "",
      hasImages: Array.from(formData.keys()).some((key) =>
        key.startsWith("image_")
      ),
    });

    // Handle audio
    let audioId = null;
    const audio = formData.get("audio");
    if (audio && audio.size > 0) {
      if (!isValidAudioFile(audio)) {
        throw new Error("Invalid audio file");
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
      // Create images directory
      const imagesDir = path.join(process.cwd(), "images", "orders");
      await mkdir(imagesDir, { recursive: true }).catch((err) => {
        if (err.code !== "EEXIST") throw err;
      });

      // Process each image
      for (const key of imageKeys) {
        const image = formData.get(key);
        if (!image || image.size === 0) continue;

        if (!image.type.startsWith("image/") || image.size > 5 * 1024 * 1024) {
          throw new Error(`Invalid image: ${image.name}`);
        }

        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExtension = path.extname(image.name) || ".jpg";
        const uniqueFileName = `order_${clientUsername}_${uuidv4()}${fileExtension}`;
        const filePath = path.join(imagesDir, uniqueFileName);

        await writeFile(filePath, buffer);
        savedImagePaths.push(uniqueFileName);
      }
    }

    const orderId = uuidv4();
    const orderData = {
      address: validated.address,
      priceToBePaid: validated.budget,
      currency: validated.currency,
      city: validated.city,
      deadline: validated.deadline,
      problemDescription: validated.problemStatement || "",
      problemAudioId: audioId,
      expertiseRequired: validated.expertiseRequired,
      phoneNumber: validated.phoneNumber,
      orderImages: savedImagePaths, // Add this field to your schema
      negotiation: {
        isNegotiating: false,
        currentOfferTo: "",
        offeredPrice: 0,
      },
      expectedReachTime: null,
      isSatisfied: false,
      orderId: orderId,
      proofPictures: {
        before: [],
        after: [],
        description: "",
      },
      isReached: {
        value: false,
        time: null,
        confirmed: false,
      },
      createdOn: new Date(),
      cancelled: {
        cancelledBy: "",
        isCancelled: false,
      },
      finishDate: null,
    };

    // Use MongoDB atomic operations
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Update client's ordersGiven
        await User.findOneAndUpdate(
          { username: clientUsername },
          {
            $push: {
              ordersGiven: {
                ...orderData,
                freelancerInfo: { username: freelancerUsername },
                status: "pending",
              },
            },
          },
          { session, new: true }
        );

        // Update freelancer's pendingOrders
        await User.findOneAndUpdate(
          { username: freelancerUsername },
          {
            $push: {
              pendingOrders: {
                ...orderData,
                customerInfo: {
                  username: clientUsername,
                },
                status: "pending",
              },
            },
          },
          { session, new: true }
        );
      });

      return { success: true, orderId };
    } finally {
      await session.endSession();
    }
  } catch (err) {
    console.error("Order creation error:", err);
    return {
      success: false,
      error: err?.message || "Failed to create order",
    };
  }
}

export async function placeOrderRequest(formData) {
  connectDb();
  const formObject = Object.fromEntries(formData.keys());
  const { audioFile } = formObject;
  try {
    const user = await User.findOneAndUpdate(
      { username: formObject.customerInfo.username },
      { $push: { ordersGiven: { ...formObject } } }
    );
    const freelancer = await User.findOneAndUpdate(
      { username: formObject.freelancerInfo.username },
      {
        $push: { pendingOrders: { ...formObject } },
        $inc: { totalOrdersRecieved: 1 },
      },
      { new: true }
    );

    await user.save();

    if (!audioFile) {
      await freelancer.save();
      return { success: true };
    }
    const { id } = await saveAudio(audioFile);
    freelancer.pendingOrders.find(
      (order) => order.customerInfo.username === user.username
    ).problemAudioId = id;
    await freelancer.save();

    return { success: true };
    //
  } catch (error) {
    console.log(`Error in placeOrderRequest(). Error : ${error}`);
  }
}

export async function cancelOrder(data) {
  connectDb();
  try {
    const customer = await User.findOneAndUpdate(
      { username: data.customerInfo.username },
      {
        $pull: {
          ordersGiven: {
            freelancerInfo: { username: data.freelancerInfo.username },
          },
        },
      }
    );
    const freelancer = await User.findOneAndUpdate(
      { username: data.freelancerInfo.username },
      {
        $pull: {
          pendingOrders: {
            customerInfo: { username: data.customerInfo.username },
          },
        },
      }
    );
    await customer.save();
    await freelancer.save();
    // send a notification to both users. Create a notification array in the schema if not already created
    return { success: true };
  } catch (error) {
    console.log(`Error in cancelOrder(). Error : ${error}`);
  }
}

export async function respondToOffer(data) {
  connectDb();
  const { response } = data;
  try {
    if (response === "accept") {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: data.freelancerInfo.username,
              },
              unit_amount: data.priceToBePaid,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://localhost:3000/?success=true`,
        cancel_url: `http://localhost:3000/?canceled=true`,
        metadata: data,
      });

      return { url: session?.url };
      //
    } else if (response === "reject") {
      return await cancelOrder(data);
      //
    } else if (response === "negotiate") {
      const customer = await User.findOne({
        username: data.customerInfo.username,
      });
      const freelancer = await User.findOne({
        username: data.freelancerInfo.username,
      });

      const order = freelancer.pendingOrders.find(
        (order) => order.customerInfo.username === customer.username
      );
      order.negotiation.isNegotiating = true;
      order.currentOfferTo =
        data.from === "customer" ? "freelancer" : "customer";
      order.offeredPrice = data.offeredPrice;
      if (order.currency === "") order.currency = data.currency;
      order.priceToBePaid = data.offeredPrice;

      const givenOrder = customer.ordersGiven.find(
        (o) => o.freelancerInfo.username === freelancer.username
      );
      givenOrder.negotiation.isNegotiating = true;
      givenOrder.currentOfferTo =
        data.from === "customer" ? "freelancer" : "customer";
      givenOrder.offeredPrice = data.offeredPrice;
      if (givenOrder.currency === "") givenOrder.currency = data.currency;
      givenOrder.priceToBePaid = data.offeredPrice;

      await customer.save();
      await freelancer.save();

      return { success: true };
    }
  } catch (error) {
    console.log(`Error in respondToOffer(). Error : ${error}`);
  }
}

export async function updateUserAfterOrder(data) {
  connectDb();
  try {
    const customer = await User.findOneAndUpdate(
      { username: data.customerInfo.username },
      { isSatisfied: data.isSatisfied, review: data.review }
    );
    customer.ordersGiven.find(
      (order) => order.freelancerInfo.username === data.freelancerInfo.username
    ).status = "completed";
    await customer.save();
    //
    const freelancer = await User.findOneAndUpdate(
      { username: data.freelancerInfo.username },
      {
        $push: { reviews: data.review, ordersCompleted: { ...data } },
        $pull: {
          pendingOrders: {
            "customerInfo.username": data.customerInfo.username,
          },
        },
        $set: {
          averageStars: {
            $divide: [
              { $sum: ["$averageStars", data.review.stars] },
              { $add: [{ $size: "$reviews" }, 1] },
            ],
          },
        },
      },
      { new: true }
    );

    if (data.response === "bad") {
      freelancer.customers.unsatisfiedCustomers += 1;
      await freelancer.save();

      return { success: true };
      //
    } else if (data.response === "good") {
      freelancer.customers.satisfiedCustomers += 1;
      await freelancer.save();

      return { success: true };
    }

    //
  } catch (error) {
    console.log(`Error in updateUserAfterOrder(). Error :${error}`);
  }
}
