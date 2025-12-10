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

    const required = [
      "orderItemsJSON",
      "orderSummary",
      "orderTotal",
      "shippingTotal",
      "shipMethod",
      "customerName",
      "customerEmail",
      "customerAddress"
    ];

    for (const key of required) {
      if (!body[key]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing field: ${key}` }),
        };
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Custom Float Frame Order",
              description: "Pinpoint Frames order"
            },
            unit_amount: Math.round(Number(body.orderTotal) * 100),
          },
          quantity: 1,
        },
      ],

      customer_email: body.customerEmail,

      success_url:
        "https://pinpointframes.com/chk?session_id={CHECKOUT_SESSION_ID}",

      cancel_url: "https://pinpointframes.com/cancel",

      metadata: {
        orderItemsJSON: body.orderItemsJSON,
        orderSummary: body.orderSummary,
        orderTotal: body.orderTotal,
        shippingTotal: body.shippingTotal,
        shipMethod: body.shipMethod,

        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone || "",
        customerAddress: body.customerAddress,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Stripe create checkout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
