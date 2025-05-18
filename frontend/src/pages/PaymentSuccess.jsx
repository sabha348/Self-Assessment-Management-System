import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get("session_id");
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("processing");

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
            const { data } = await axios.post(
                `${API_URL}/payment/confirm-payment`,
                { session_id: sessionId },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            setStatus("success");
            setMessage(data.message);

            if (data.user) {
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = { ...currentUser, ...data.user };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                window.dispatchEvent(new Event('userUpdated'));
            }

            

            setTimeout(() => {
                localStorage.setItem('needsUserRefresh', 'true');
                navigate("/dashboard");
            }, 4000);
        } catch (error) {
            setStatus("error");
            setMessage(error.response?.data?.error || "Payment verification failed.");
            setTimeout(() => {
                navigate("/payment-failed");
            }, 3000);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md text-center transition-all">
                {status === "processing" && (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
                        <h2 className="text-xl font-semibold mt-4">Processing Payment...</h2>
                        <p className="text-gray-500">Please do not close this window</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="flex flex-col items-center text-green-600">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <h2 className="text-2xl font-bold mt-4">{message}</h2>
                        <p className="text-gray-500">Redirecting to dashboard...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="flex flex-col items-center text-red-600">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <h2 className="text-2xl font-bold mt-4">Error</h2>
                        <p className="text-gray-500">{message}</p>
                        <button
                            className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                            onClick={() => navigate("/dashboard")}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSuccess;
