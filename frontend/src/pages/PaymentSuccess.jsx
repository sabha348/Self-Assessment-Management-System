import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get("session_id");
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("processing"); // Add this state

    useEffect(() => {
        if (sessionId) {
            confirmPayment();
        } else {
            setMessage("Invalid session ID");
            setStatus("error");
            setTimeout(() => navigate("/"), 3000);
        }
    }, [sessionId]);

    const confirmPayment = async () => {
        try {
            console.log("Starting payment confirmation with session ID:", sessionId);
            
            const { data } = await axios.post(
                "http://localhost:8000/api/payment/confirm-payment",
                { session_id: sessionId },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            
            console.log("Payment confirmation response:", data);
            
            // Update status and message
            setStatus("success"); // Add this line
            setMessage(data.message);
            
            // Update local user data
            if (data.user) {
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = {
                    ...currentUser,
                    ...data.user
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                // Dispatch an event to notify other components of the user update
                window.dispatchEvent(new Event('userUpdated'));
            }

            // Redirect to dashboard after successful payment
            setTimeout(() => {
                navigate("/dashboard");
            }, 2000);
            
        } catch (error) {
            console.error("Payment confirmation error:", {
                message: error.message,
                response: error.response?.data
            });
            setStatus("error"); // Add this line
            setMessage(error.response?.data?.error || "Payment verification failed.");
            
            // Redirect to payment failed page after error
            setTimeout(() => {
                navigate("/payment-failed");
            }, 3000);
        }
    };

    return (
        <div className="payment-status-container">
            {status === "processing" && (
                <div className="loading">
                    <h2>Processing payment...</h2>
                    <p>Please do not close this window</p>
                </div>
            )}

            {status === "success" && (
                <div className="success">
                    <h2>{message}</h2>
                    <p>Redirecting to dashboard...</p>
                </div>
            )}

            {status === "error" && (
                <div className="error">
                    <h2>Error</h2>
                    <p>{message}</p>
                    <button onClick={() => navigate("/")}>Return to Home</button>
                </div>
            )}
        </div>
    );
};

export default PaymentSuccess;