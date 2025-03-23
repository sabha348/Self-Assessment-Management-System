import { useState } from "react";
import axios from "axios";

const Checkout = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handlePayment = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token"); // Get JWT token

            // Call backend to create Stripe session
            const { data } = await axios.post(
                "http://localhost:8000/api/payment/create-checkout-session",
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (data.url) {
                window.location.href = data.url; // Redirect to Stripe Checkout
            }
        } catch (error) {
            setMessage("Payment failed. Please try again.");
            console.error("Payment error:", error);
        }
        setLoading(false);
    };

    return (
        <div>
            <h2>Upgrade to Premium</h2>
            <button onClick={handlePayment} disabled={loading}>
                {loading ? "Processing..." : "Pay ₹99"}
            </button>
            {message && <p>{message}</p>}
        </div>
    );
};

export default Checkout;
