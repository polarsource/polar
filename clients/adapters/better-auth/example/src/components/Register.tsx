"use client";

import { signUp } from "@/lib/auth-client";
import { useState } from "react";

export const Register = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const handleRegister = async () => {
		await signUp.email({
			email,
			password,
			name,
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<h1>Register</h1>
			<input
				type="text"
				id="name"
				name="name"
				className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="Enter your name"
				aria-label="Name"
				tabIndex={0}
				onChange={(e) => setName(e.target.value)}
			/>
			<input
				type="email"
				id="email"
				name="email"
				className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="Enter your email"
				aria-label="Email address"
				tabIndex={0}
				onChange={(e) => setEmail(e.target.value)}
			/>
			<input
				type="password"
				id="password"
				name="password"
				className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				placeholder="Enter your password"
				aria-label="Password"
				tabIndex={0}
				onChange={(e) => setPassword(e.target.value)}
			/>
			<button type="button" onClick={handleRegister}>
				Register
			</button>
		</div>
	);
};
