"use client";

import { useState, useTransition } from "react";
import { signIn, signUp } from "@/app/auth/actions";

export default function LoginForm({ nextPath = "/" }) {
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData) {
    setError("");
    setMessage("");
    formData.set("next", nextPath);

    startTransition(async () => {
      const result =
        mode === "signin" ? await signIn(formData) : await signUp(formData);
      if (!result) return;
      if (result.error) setError(result.error);
      if (result.message) setMessage(result.message);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="space-y-2">
        <p className="text-[15px] font-semibold tracking-tight text-ink">
          Toodooz
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-sm text-muted">
          Basic email and password. Nothing fancy.
        </p>
      </div>

      <form action={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none ring-ink/20 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none ring-ink/20 focus:ring-2"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-muted" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-md bg-ink px-3 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
        >
          {pending
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Sign up"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button
              type="button"
              className="font-medium text-ink underline-offset-2 hover:underline"
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have one?{" "}
            <button
              type="button"
              className="font-medium text-ink underline-offset-2 hover:underline"
              onClick={() => {
                setMode("signin");
                setError("");
                setMessage("");
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
