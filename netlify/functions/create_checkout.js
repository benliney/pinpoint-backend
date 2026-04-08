const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Simple CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

exports.handler = async (event) => {
  try {
    console.log("FUNCTION HIT");

    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const { order, customer, totals, shipMethod, state } = body;

    if (!Array.isArray(order) || order.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Order is empty or invalid" }),
      };
    }

    if (!customer || !customer.name || !customer.email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing customer name or email" }),
      };
    }

const productsTotal = Number(totals?.productsTotal) || 0;
const shippingTotal = Number(totals?.shippingTotal) || 0;
let orderTotal = Number(totals?.orderTotal) || 0;

    if (!isFinite(orderTotal) || orderTotal <= 0) {
      orderTotal = productsTotal + shippingTotal;
    }

    if (!isFinite(orderTotal) || orderTotal <= 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid order total" }),
      };
    }

    // ✅ Validate orderRef before proceeding
if (!body.orderRef) {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: "Missing orderRef" }),
  };
}

// ✅ STORE IN AIRTABLE
const airtableRes = await fetch(
  `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        orderRef: body.orderRef,
        status: "pending",

        customerName: customer.name || "",
        customerEmail: customer.email || "",
        customerNotes: customer.notes || "",

        shippingMethod: (shipMethod || "pickup").toLowerCase(),
        shippingTotal: Number(shippingTotal) || 0,

        orderJSON: JSON.stringify(order),

        orderTotal: Number(orderTotal) || 0
      }
    })
  }
);

// ✅ Handle Airtable response safely
const airtableData = await airtableRes.text();

console.log("Airtable status:", airtableRes.status);
console.log("Airtable response:", airtableData);

if (!airtableRes.ok) {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: "Failed to create order in Airtable" }),
  };
}




    const amountInCents = Math.round(orderTotal * 100);

    const lineItems = [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: "Pinpoint Frames order",
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ];

   const metadata = {
  orderRef: body.orderRef || "",
  shipMethod: shipMethod || "",
  shippingTotal: isFinite(shippingTotal) ? shippingTotal.toFixed(2) : "0"
};

    const isDelivery = shipMethod === "shipping";

    const shippingConfig = isDelivery
      ? {
          shipping_address_collection: {
            allowed_countries: ["AU"],
          },
        }
      : {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://pinpointframes.com/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://pinpointframes.com/cancel",
      customer_email: customer.email,
      metadata,
      ...shippingConfig
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error("Stripe create checkout error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};