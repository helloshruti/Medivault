import { useState, useEffect } from "react";

interface User { id: string; name: string; email: string; }

declare global {
  interface Window {
    google?: any;
    handleCredentialResponse?: (response: any) => void;
  }
}

export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState("login");

  useEffect(() => {
    window.handleCredentialResponse = (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split(".")[1]));
        const user = { id: payload.sub, name: payload.name, email: payload.email };
        onLogin(user);
      } catch (err) {
        console.error("Google credential parse failed", err);
      }
    };

    const renderButton = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: "460168952482-2nis9o3tlei6jjtcu1h5utqbb5sc7uhk.apps.googleusercontent.com",
        callback: window.handleCredentialResponse,
      });
      const element = document.getElementById("google-signin-button");
      if (element) {
        window.google.accounts.id.renderButton(element, {
          theme: "outline",
          size: "large",
          width: "100%",
        });
      }
      window.google.accounts.id.prompt();
    };

    const interval = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(interval);
        renderButton();
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-200 p-4">
      <div className="w-full max-w-md bg-white/95 border border-gray-200 shadow-2xl rounded-2xl p-7">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-700">Medivault</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full mt-1 px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full mt-1 px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <button
            type="button"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
          >
            {mode === "login" ? "Login" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center my-5">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="px-3 text-sm text-slate-500">Or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div id="google-signin-button" className="mb-4" />

        <p className="text-center text-sm text-slate-600">
          {mode === "login"
            ? "New here?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {mode === "login" ? "Create account" : "Login instead"}
          </button>
        </p>
      </div>
    </div>
  );
}
