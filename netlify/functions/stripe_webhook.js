const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const sig = event.headers["stripe-signature"];

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const orderRef = session.metadata?.orderRef;

      console.log("Payment confirmed:", orderRef);

      // 🔍 FIND ORDER IN AIRTABLE
      const searchRes = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders?filterByFormula={orderRef}="${orderRef}"`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          },
        }
      );

      const searchData = await searchRes.json();

      if (!searchData.records.length) {
        console.log("Order not found in Airtable");
        return { statusCode: 200 };
      }

      const recordId = searchData.records[0].id;

      // ✅ UPDATE STATUS TO PAID
      await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [
              {
                id: recordId,
                fields: {
                  status: "paid",
                },
              },
            ],
          }),
        }
      );

      // 🔥 SEND TO MAKE
      await fetch(process.env.MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderRef,
          stripeSessionId: session.id,
          amountTotal: session.amount_total / 100,
          metadata: session.metadata,
        }),
      });
    }

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (err) {
    console.error("Webhook error:", err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};