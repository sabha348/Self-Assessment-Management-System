import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const ProUpgradeModal = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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

      console.log("data is",data);

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
    <div className="fixed inset-0 flex items-center justify-center bg-gray-200 bg-opacity-50 z-50">
      <div className="bg-white text-gray-900 p-6 rounded-2xl shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
        <p className="text-gray-500 mb-4">Use without limits</p>

        {/* Pricing Options */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="flex items-center justify-between p-3 rounded-lg">
            <span>Monthly</span>
            <span>₹99/mo</span>
          </div>
        </div>

        {/* Features */}
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <div className="flex justify-between">
            <span>Unlimited Study-Quiz</span>
            <span className="text-green-600 font-bold text-lg">✔</span>
          </div>
          <div className="flex justify-between">
            <span>Unlimited Practice Quiz</span>
            <span className="text-green-600 font-bold text-lg">✔</span>
          </div>
          <div className="flex justify-between">
            <span>Advanced Analytics</span>
            <span className="text-green-600 font-bold text-lg">✔</span>
          </div>
          <div className="flex justify-between">
            <span>Customizable Time-Table</span>
            <span className="text-green-600 font-bold text-lg">✔</span>
          </div>
        </div>

        {/* Upgrade Button */}
        <button
          className="w-full mt-4 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
          onClick={handlePayment}
          disabled={loading}
        >
          {loading ? "Processing..." : "Upgrade now"}
        </button>

        {/* Back to Dashboard Button */}
        <button
          className="w-full mt-3 bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </button>
      </div>

      {message && <p className="mt-3 text-red-600">{message}</p>}
    </div>
  );
};

export default ProUpgradeModal;
