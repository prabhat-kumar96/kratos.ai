import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';

export default function SignupPage() {
    const { signup, googleLogin } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("investor");
    const [companyName, setCompanyName] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleGoogleLogin = async (credentialResponse) => {
        try {
            await googleLogin(credentialResponse.credential);
        } catch (err) {
            setError(err.response?.data?.message || "Google Signup Failed");
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Map frontend role to backend role
        // Frontend: Startup, Investor
        // Backend: founder, investor
        // Let's assume the select values should just be the backend values? 
        // Or we map them. Let's map them for better UI ("Startup" looks better than "founder" maybe?)

        // Actually, let's keep the select values as visual strings but state as backend values.

        try {
            await signup({
                username: name, // Backend expects username
                email,
                password,
                role, // "founder" or "investor"
                companyName: role === "founder" ? companyName : undefined
            });
        } catch (err) {
            console.error("Signup error:", err);
            setError(err.response?.data?.message || err.message || "Failed to sign up");
        }
    };

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 pt-24">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <div className="mb-6 text-center">
                    <Link to="/" className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors">
                        &larr; Back to Home
                    </Link>
                </div>
                <h2 className="text-center text-2xl font-bold leading-9 tracking-tight text-white">
                    Create your account
                </h2>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {error && <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">{error}</div>}

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-300">
                            Username
                        </label>
                        <div className="mt-2">
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-900 text-white shadow-sm ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 px-3"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-300">
                            Email address
                        </label>
                        <div className="mt-2">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-900 text-white shadow-sm ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 px-3"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium leading-6 text-gray-300">
                            I am a...
                        </label>
                        <div className="mt-2">
                            <select
                                id="role"
                                name="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-900 text-white shadow-sm ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 px-3"
                            >
                                <option value="investor">Investor</option>
                                <option value="founder">Startup Founder</option>
                            </select>
                        </div>
                    </div>

                    {/* Conditional Company Name Field */}
                    {role === "founder" && (
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium leading-6 text-gray-300">
                                Company Name
                            </label>
                            <div className="mt-2">
                                <input
                                    id="companyName"
                                    name="companyName"
                                    type="text"
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="block w-full rounded-md border-0 py-1.5 bg-gray-900 text-white shadow-sm ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 px-3"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-300">
                            Password
                        </label>
                        <div className="mt-2">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-900 text-white shadow-sm ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 px-3"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-lg hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                        >
                            Sign up
                        </button>
                    </div>

                    <div className="relative mt-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-gray-900 px-2 text-gray-400">Or sign up with</span>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-center w-full">
                        <GoogleLogin
                            onSuccess={credentialResponse => {
                                handleGoogleLogin(credentialResponse);
                            }}
                            onError={() => {
                                console.log('Signup Failed');
                                setError("Google Signup Failed");
                            }}
                            theme="filled_black"
                            width="350"
                            text="signup_with"
                        />
                    </div>
                </form>
                <p className="mt-10 text-center text-sm text-gray-400">
                    Already a member?{" "}
                    <Link to="/login" className="font-semibold leading-6 text-indigo-400 hover:text-indigo-300">
                        Log in
                    </Link>
                </p>
            </div >
        </div >
    );
}