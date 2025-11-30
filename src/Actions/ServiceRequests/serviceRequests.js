"use server";
import User from "@/Database/Schemas/User/user";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";
import { connectDb } from "@/Database/ConnectDb/connectdb";
import Audio from "@/Database/Schemas/Audios/audios";
import { saveAudio } from "../Audio/audio";
import { stripe } from "@/Utils/Stripe/stripe";
import { ZodError } from "zod";
// import {
//   serviceRequestFormSchema,
//   serviceRequestZodSchema,
// } from "@/Zod/ServiceRequest/schema";

export async function getUserServiceRequests(username) {
  try {
    await connectDb();

    if (!username) {
      return { success: false, error: "Username is required" };
    }

    // Find all service requests for this user
    const serviceRequests = await ServiceRequests.find({
      "customerInfo.username": username,
    })
      .sort({ createdAt: -1 }) // Latest first
      .lean(); // For better performance

    // Transform the data to match your component's expected structure
    const transformedRequests = serviceRequests.map((request) => ({
      requestId: request.requestId,
      problemDescription:
        request.problemDescription || "No description provided",
      willingPrice: request.willingPrice || 0,
      currency: request.currency || "USD",
      deadline: request.deadline
        ? new Date(request.deadline).toLocaleDateString()
        : "No deadline",
      city: request.city,
      address: request.address,
      phoneNumber: request.phoneNumber,
      expertiseRequired: request.expertiseRequired || [],
      serviceImages: request.serviceImages || [],
      hasAudio: !!request.problemAudioId,
      audioData: request.problemAudioId
        ? {
            requestId: request.requestId,
            audioId: request.problemAudioId,
          }
        : null,
      offers: request.offers || [],
      createdAt: request.createdAt,
    }));

    return {
      success: true,
      serviceRequests: transformedRequests,
    };
  } catch (error) {
    console.error("Error fetching user service requests:", error);
    return {
      success: false,
      error: "Failed to fetch service requests",
    };
  }
}

export async function updateOfferStatus(requestId, freelancerUsername, action) {
  try {
    await connectDb();

    if (
      !requestId ||
      !freelancerUsername ||
      !["accept", "decline"].includes(action)
    ) {
      return { success: false, error: "Invalid parameters" };
    }

    const serviceRequest = await ServiceRequests.findOne({ requestId });

    if (!serviceRequest) {
      return { success: false, error: "Service request not found" };
    }

    if (action === "accept") {
      // Mark the offer as accepted and reject all others
      serviceRequest.offers = serviceRequest.offers.map((offer) => ({
        ...offer,
        accepted: offer.freelancerInfo.username === freelancerUsername,
      }));
    } else if (action === "decline") {
      // Remove the declined offer
      serviceRequest.offers = serviceRequest.offers.filter(
        (offer) => offer.freelancerInfo.username !== freelancerUsername
      );
    }

    await serviceRequest.save();

    return {
      success: true,
      message: `Offer ${action}ed successfully`,
    };
  } catch (error) {
    console.error(`Error ${action}ing offer:`, error);
    return {
      success: false,
      error: `Failed to ${action} offer`,
    };
  }
}
// export async function postServiceRequest(formData) {
//   await connectDb();

//   try {
//     const formObject = Object.fromEntries(formData.entries());
//     if (formObject.customerInfo) {
//       formObject.customerInfo = JSON.parse(formObject.customerInfo);
//     }
//     if (formObject.expertiseRequired) {
//       try {
//         formObject.expertiseRequired = JSON.parse(formObject.expertiseRequired);
//       } catch {
//         formObject.expertiseRequired = formObject.expertiseRequired.split(",");
//       }
//     }
//     const validatedData = serviceRequestZodSchema.parse(formObject);

//     const audio = formData.get("audio");
//     let audioId = undefined;

//     if (audio && typeof audio === "object" && audio.size > 0) {
//       const { id } = await saveAudio(audio);
//       audioId = id;
//     }
//     const serviceRequest = await ServiceRequests.create({
//       ...validatedData,
//       problemAudioId: audioId,
//     });

//     await serviceRequest.save();
//     console.log(serviceRequest);
//     return { success: true, serviceRequest };
//   } catch (err) {
//     if (err instanceof ZodError) {
//       return {
//         success: false,
//         error: "Validation failed",
//         details: err.errors,
//       };
//     }

//     console.log("Error in postServiceRequest():", err);
//     return { success: false, error: "Something went wrong" };
//   }
// }

export async function makeServiceOffer(formData) {
  await connectDb();
  try {
    const formObject = Object.fromEntries(formData.entries());

    const serviceRequest = await ServiceRequests.findOneAndUpdate(
      { requestId: formObject.requestId },
      { $push: { offers: { ...formObject.freelancerInfo } } }
    );
    await serviceRequest.save();
    return { success: true };
  } catch (error) {
    console.log(`Error in makeServiceOffer(). Error : ${error}`);
  }
}

export async function respondToServiceOffer(formObject) {
  await connectDb();
  try {
    // const formObject = Object.fromEntries(formData.entries());

    const response = formObject.response;
    if (response === "reject") {
      const serviceRequest = await ServiceRequests.findOneAndUpdate(
        { requestId: formObject.requestId },
        {
          $pull: {
            offers: {
              freelanderInfo: {
                username: formObject.freelancerInfo.username,
              },
            },
          },
        }
      );
      await serviceRequest.save();
      return { success: true };
    }
    //
    //
    else if (response === "accept") {
      //do this after use pays with stirpe
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "plumbing service",
              },
              unit_amount: 200,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://localhost:3000/?success=true`,
        cancel_url: `http://localhost:3000/?canceled=true`,
        metadata: formObject,
      });

      return { url: session?.url };
    }
  } catch (error) {
    console.log(`Error in respondToServiceOffer(). Error : ${error}`);
  }
}
