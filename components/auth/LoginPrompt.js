"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'
import api from '@/helpers/axios'
import { setLocal } from '@/utility'
import OldInput from '@/components/custom/OldInput'
import { IoMdEye, IoMdEyeOff } from "react-icons/io";

const LoginPrompt = () => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        if (!formData.username || !formData.password) {
            toast.error("Please enter both email and password");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/client/login', formData);
            const resData = response?.data?.data;
            const access_token = resData?.access_token || "";

            if (access_token) {
                setLocal('old_token', access_token);
                Cookies.set('old_token', access_token);
                toast.success("Logged in successfully!");
                window.location.reload(); // Refresh to update auth state
            } else {
                throw new Error("No access token received");
            }
        } catch (err) {
            console.error("Login failed", err);
            if (err.response?.status === 500) {
                toast.error("Server error. Please contact support.");
            } else {
                toast.error(err.response?.data?.data?.error || "Login failed. Please check your credentials.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="sticky top-0 z-[100] w-full bg-white shadow-md border-b border-gray-200 py-3 px-4 md:px-8">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Logo/Brand Area (Optional, mimics FB's left side) */}
                <div className="flex-shrink-0 hidden md:block">
                    <Link href="/">
                        <Image
                            src="/oldman-logo.png"
                            alt="OLD CLUB MAN"
                            width={120}
                            height={40}
                            className="object-contain h-10 w-auto"
                            priority
                        />
                    </Link>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="w-full md:w-48">
                        <OldInput
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Email or Phone"
                            className="w-full h-9 text-sm bg-gray-50 border-gray-300 focus:border-blue-500"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="w-full md:w-48 relative">
                        <OldInput
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            className="w-full h-9 text-sm bg-gray-50 border-gray-300 focus:border-blue-500"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute cursor-pointer right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            disabled={loading}
                        >
                            {showPassword ? <IoMdEyeOff size={16} /> : <IoMdEye size={16} />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        className="w-full md:w-auto px-6 h-9 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                        disabled={loading}
                    >
                        {loading ? 'Log In...' : 'Log In'}
                    </button>

                    <div className="flex items-center gap-4 text-sm whitespace-nowrap">
                        <Link href="/auth/forgot-password" className="text-blue-500 hover:underline">
                            Forgot account?
                        </Link>
                        <div className="h-4 w-[1px] bg-gray-300 hidden md:block"></div>
                        <Link href="/auth/register" className="bg-[#42b72a] text-white px-4 py-1.5 rounded font-bold hover:bg-[#36a420] transition-colors text-sm">
                            Create new account
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default LoginPrompt
