// netlify/functions/create-checkout.js
const Stripe = require("stripe");

export const handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    });

    const data = JSON.parse(event.body);
    const { amount, currency, orderDetails } = data;

    if (!amount || !currency || !orderDetails) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" })
      };
    }

    const unitAmount = Math.round(Number(amount) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: orderDetails.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: "Custom Float Frame",
              description: orderDetails.description || "Frame Order",
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["AU"] },
      metadata: {
        width: String(orderDetails.width || ""),
        height: String(orderDetails.height || ""),
        finish: orderDetails.finish || "",
        delivery: orderDetails.delivery || "",
        name: orderDetails.name || "",
        email: orderDetails.email || "",
      },
      success_url: "https://pinpointframes.com/success",
      cancel_url: "https://pinpointframes.com/order",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error("STRIPE CHECKOUT ERROR", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Checkout creation failed" }),
    };
  }
};