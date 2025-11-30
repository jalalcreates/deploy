import { connectDb } from "@/Database/ConnectDb/connectdb";
import ServiceRequests from "@/Database/Schemas/ServiceRequests/serviceRequests";

export async function POST(request) {
  try {
    await connectDb();

    const data = await request.json();
    const { requestId, freelancerInfo, offeredPrice, reachtime } = data;
    if (!requestId || !freelancerInfo?.username) {
      return Response.json(
        { success: false, error: "Missing requestId or freelancer username" },
        { status: 400 }
      );
    }

    const serviceRequest = await ServiceRequests.findOne({ requestId });
    if (!serviceRequest) {
      return Response.json(
        { success: false, error: "Service request not found" },
        { status: 404 }
      );
    }

    const alreadyOffered = serviceRequest.offers.some(
      (offer) => offer.freelancerInfo.username === freelancerInfo.username
    );

    if (alreadyOffered) {
      return Response.json(
        { success: false, error: "You have already submitted an offer" },
        { status: 409 }
      );
    }

    const newOffer = {
      freelancerInfo,
      offeredPrice: offeredPrice || serviceRequest.willingPrice,
      accepted: false,
      reachtime: reachtime || serviceRequest.deadline,
    };

    serviceRequest.offers.push(newOffer);
    await serviceRequest.save();

    return Response.json(
      {
        success: true,
        message: "Offer submitted successfully",
        offer: newOffer,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error submitting offer:", err);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
