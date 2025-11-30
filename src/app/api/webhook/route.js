import { stripe } from "@/Utils/Stripe/stripe";
import connectDb from "@/Database/connectDb";
import ServiceRequests from "@/models/ServiceRequests";
import User from "@/Database/Schemas/User/user";
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  await connectDb();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response("Webhook Error: Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log("Checkout Session Completed:", session);

        const formObject = session.metadata;

        // Update your database with payment success
        await ServiceRequests.findOneAndDelete({
          requestId: formObject.requestId,
        });
        const customer = await User.findOneAndUpdate(
          { username: formObject.customerInfo.username },
          {
            $push: {
              ordersGiven: { ...formObject, status: "paid & unfulfilled" },
            },
          }
        );
        await customer.save();
        const freelancer = await findOneAndUpdate(
          { username: formObject.freelancerInfo.username },
          {
            $push: {
              pendingOrders: { ...formObject, status: "paid & unfulfilled" },
            },
          }
        );
        await freelancer.save();
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("Webhook received", { status: 200 });
  } catch (error) {
    console.error(`Error handling webhook event: ${error.message}`);
    return new Response("Webhook handling error", { status: 500 });
  }
}
