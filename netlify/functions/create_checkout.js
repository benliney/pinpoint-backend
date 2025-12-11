// netlify/functions/create_checkout.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // Reject anything that's not POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" })
      };
    }

    const data = JSON.parse(event.body || "{}");

    // Basic validation
    if (!data.order || !Array.isArray(data.order) || data.order.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Order is empty" })
      };
    }

    if (!data.customer || !data.customer.name || !data.customer.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer name or email" })
      };
    }

    const { order, customer, totals, shipMethod, state } = data;

    // Build Stripe line items (simple single line — total only)
    const lineItems = [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: "Pinpoint Frames Order",
            description: `Frames (${order.length} items)`
          },
          unit_amount: Math.round((totals?.orderTotal || 0) * 100), // cents
        },
        quantity: 1
      }
    ];

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,

      success_url: "https://pinpointframes.com/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://pinpointframes.com/cancel",

      customer_email: customer.email,

      metadata: {
        customer_name: customer.name || "",
        customer_notes: customer.notes || "",
        ship_method: shipMethod || "",
        state: state || "",
        products_total: String(totals?.productsTotal || "0"),
        shipping_total: String(totals?.shippingTotal || "0"),
        order_total: String(totals?.orderTotal || "0"),
        order_json: JSON.stringify(order)
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error("Stripe Checkout Error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error creating checkout",
        details: err.message
      })
    };
  }
};
