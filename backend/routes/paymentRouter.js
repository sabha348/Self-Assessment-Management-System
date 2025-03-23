const express = require("express");
const router = express.Router();
require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require('../models/Users');
const authMiddleware = require('../middleware/authenticate');

// ✅ Create Stripe Checkout Session
router.post("/create-checkout-session", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        // console.log("Creating checkout session for user:", userId);


        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: req.user.email,
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: "Premium Membership",
                            description: "Get unlimited access to premium features.",
                        },
                        unit_amount: 99 * 100,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/payment-failed`,
            metadata: { userId: userId.toString() },
        });

        // console.log("Checkout session created:", {
        //     sessionId: session.id,
        //     userId: userId,
        //     email: req.user.email
        // });

        res.json({ url: session.url });
    } catch (error) {
        // console.error("Error creating Stripe session:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
    }
});

// ✅ Handle Successful Payment & Update Membership
router.post("/confirm-payment", async (req, res) => {
    try {
        const { session_id } = req.body;
        // console.log("Confirming payment for session:", session_id);

        if (!session_id) {
            console.error("No session_id provided in request");
            return res.status(400).json({ error: "No session_id provided" });
        }

        // Retrieve session with expanded payment intent
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['payment_intent']
        });

        // console.log("Session details:", {
        //     paymentStatus: session.payment_status,
        //     sessionStatus: session.status,
        //     metadata: session.metadata,
        //     customerId: session.customer,
        //     email: session.customer_email
        // });

        if (session.payment_status === "paid") {
            const userId = session.metadata.userId;

            if (!userId) {
                console.error("No userId found in session metadata");
                return res.status(400).json({ error: "Invalid session metadata" });
            }

            // console.log("Updating membership for user:", userId);

            // Update user's membership with error handling
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    membership: "premium",
                    membershipExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
                { new: true, runValidators: true } // Return updated doc and run schema validators
            );

            if (!updatedUser) {
                console.error("User not found:", userId);
                return res.status(404).json({ error: "User not found" });
            }

            // console.log("Membership updated successfully:", {
            //     userId: updatedUser._id,
            //     membership: updatedUser.membership,
            //     expiryDate: updatedUser.membershipExpiry
            // });

            return res.json({
                message: "Payment successful! Membership upgraded.",
                user: {
                    membership: updatedUser.membership,
                    membershipExpiry: updatedUser.membershipExpiry
                }
            });
        }

        // console.log("Payment not completed:", {
        //     paymentStatus: session.payment_status,
        //     sessionStatus: session.status
        // });

        res.status(400).json({ error: "Payment not completed" });
    } catch (error) {
        console.error("Error confirming payment:", {
            error: error.message,
            stackTrace: error.stack
        });
        res.status(500).json({ 
            error: "Failed to confirm payment",
            details: error.message
        });
    }
});

module.exports = router;