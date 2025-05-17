const express = require("express");
const router = express.Router();
require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require('../models/Users');
const {authenticateToken} = require('../middleware/authenticate');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');

// ✅ Create Stripe Checkout Session
router.post("/create-checkout-session", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("Creating checkout session for user:", userId);
        
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

        console.log("im here");
        res.json({ url: session.url });
    } catch (error) {
        console.error("Error creating Stripe session:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
    }
});

// ✅ Handle Successful Payment & Update Membership
router.post("/confirm-payment", async (req, res) => {
    try {
        const { session_id } = req.body;
        
        if (!session_id) {
            console.error("No session_id provided in request");
            return res.status(400).json({ error: "No session_id provided" });
        }

        // Retrieve session with expanded payment intent
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['payment_intent']
        });

        
        if (session.payment_status === "paid") {
            const userId = session.metadata.userId;

            if (!userId) {
                console.error("No userId found in session metadata");
                return res.status(400).json({ error: "Invalid session metadata" });
            }

        
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

            // Also create/update subscription record
            await Subscription.findOneAndUpdate(
                { userId: userId },
                {
                    userId: userId,
                    plan: "premium",
                    status: "active",
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    stripeCustomerId: session.customer || null,
                    stripeSubscriptionId: session.payment_intent ? 
                        (typeof session.payment_intent === 'object' ? session.payment_intent.id : session.payment_intent) 
                        : null
                },
                { upsert: true, new: true }
            );


            // Add this before creating a payment record
            const existingPayment = await Payment.findOne({ stripeSessionId: session_id });
            if (existingPayment) {
                console.log("Payment already processed, returning existing record");
                return res.json({
                    message: "Payment successful! Membership upgraded.",
                    user: {
                        membership: updatedUser.membership,
                        membershipExpiry: updatedUser.membershipExpiry
                    }
                });
            }

            // Create a payment record only if it doesn't exist
            await Payment.create({
                userId: userId,
                stripeSessionId: session_id,
                stripePaymentIntentId: session.payment_intent ? session.payment_intent.id : null,
                amount: 99, // The price from your Stripe checkout
                status: 'succeeded',
                metadata: {
                    customerEmail: session.customer_email,
                    customerId: session.customer
                }
            });

            
            return res.json({
                message: "Payment successful! Membership upgraded.",
                user: {
                    membership: updatedUser.membership,
                    membershipExpiry: updatedUser.membershipExpiry
                }
            });
        }

        
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

// Add this route to your subscription router
router.post('/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has an active subscription
    if (user.membership !== 'premium') {
      return res.status(400).json({ message: 'No active premium subscription found' });
    }
    
    // Find and update subscription in the database
    const subscription = await Subscription.findOne({ userId });
    if (subscription) {
      subscription.status = 'cancelled';
      await subscription.save();
    }
    
    // Update user object - they keep premium access until expiry
    // The membership checker cron job will downgrade them when membershipExpiry passes
    
    // Optionally if using Stripe, cancel the subscription there too
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    if (user.stripeSubscriptionId) {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }
    
    res.status(200).json({ 
      message: 'Subscription cancelled successfully. You will have access until your current billing period ends.' 
    });
    
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription', error: error.message });
  }
});

module.exports = router;