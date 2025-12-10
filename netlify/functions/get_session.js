const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const sessionId = body.session_id;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing session_id" }),
      };
    }

    // Retrieve checkout session including expanded line items & customer details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "customer_details"],
    });

    // Build response with ALL useful data for your success page
    const response = {
      success: true,

      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,

      customer: {
        name: session.customer_details?.name || "",
        email: session.customer_details?.email || "",
        phone: session.customer_details?.phone || "",
        address: session.customer_details?.address || {},
      },

      line_items: session.line_items?.data || [],

      metadata: session.metadata || {},
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (err) {
    console.error("Error fetching session:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

