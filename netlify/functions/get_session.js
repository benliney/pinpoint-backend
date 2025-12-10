// netlify/functions/get_session.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { session_id } = JSON.parse(event.body);

    if (!session_id) {
      return { statusCode: 400, body: "Missing session_id" };
    }

    // Retrieve full Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent", "customer"],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        session,
      }),
    };

  } catch (err) {
    console.error("PF Stripe Session Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
