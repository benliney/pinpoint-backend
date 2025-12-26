const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Simple CORS headers so browser fetch() is happy
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

exports.handler = async (event) => {
  try {
    // Handle preflight
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

    // ---- Basic validation to avoid 400 surprises ----
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

    const productsTotal = Number(totals && totals.productsTotal);
    const shippingTotal = Number(totals && totals.shippingTotal);
    let orderTotal = Number(totals && totals.orderTotal);

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

    // Stripe expects amounts in cents as integers
    const amountInCents = Math.round(orderTotal * 100);

    // Single line item for the entire order
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

    // Metadata for your reference in Stripe dashboard
    const metadata = {
      orderRef: body.orderRef,
      customerName: customer.name,
      customerEmail: customer.email,
      customerNotes: customer.notes || "",
      shipMethod: shipMethod || "",
      state: state || "",
      productsTotal: isFinite(productsTotal)
        ? productsTotal.toFixed(2)
        : "",
      shippingTotal: isFinite(shippingTotal)
        ? shippingTotal.toFixed(2)
        : "",
      orderSummary: body.orderSummary || "",
      // keep under Stripe metadata size limits
      orderJSON: JSON.stringify(order).slice(0, 5000),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
  success_url: "https://pinpointframes.com/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://pinpointframes.com/cancel",
      customer_email: customer.email,
metadata,
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
