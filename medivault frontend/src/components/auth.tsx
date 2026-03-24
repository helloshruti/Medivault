import { useState, useEffect, type FormEvent } from "react";
import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { useAuth } from "../context/AuthContext";

interface AuthProps {
  onAuthenticated: () => void;
}

export function Auth({ onAuthenticated }: AuthProps) {
  const { login, signup: signupContext } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStrongPassword = (value: string) => {
    return (
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value)
    );
  };

  useEffect(() => {
    // @ts-ignore
    window.handleCredentialResponse = (response) => {
      const data = JSON.parse(atob(response.credential.split('.')[1]));

      const user = {
        id: data.sub || Date.now().toString(),
        name: data.name,
        email: data.email
      };

      if (mode === "signup") {
        signupContext(user);
      } else {
        login(user);
      }
      onAuthenticated();
    };

    let checkGoogleLoaded: number;

    const renderButton = () => {
      // @ts-ignore
      if (window.google && window.google.accounts) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: "460168952482-2nis9o3tlei6jjtcu1h5utqbb5sc7uhk.apps.googleusercontent.com",
          // @ts-ignore
          callback: window.handleCredentialResponse,
          auto_select: false, // Optional: set to true if you want auto-login when only 1 session exists
        });

        // Trigger the One Tap pop-up automatically
        // @ts-ignore
        window.google.accounts.id.prompt();

        const element = document.getElementById("google-signin-button");
        if (element) {
          // @ts-ignore
          window.google.accounts.id.renderButton(element, {
            theme: "outline",
            size: "large",
            width: element.offsetWidth || 384,
            type: "standard"
          });
        }
      }
    };

    // @ts-ignore
    if (window.google && window.google.accounts) {
      renderButton();
    } else {
      checkGoogleLoaded = window.setInterval(() => {
        // @ts-ignore
        if (window.google && window.google.accounts) {
          window.clearInterval(checkGoogleLoaded);
          renderButton();
        }
      }, 100);
    }

    return () => {
      if (checkGoogleLoaded) {
        window.clearInterval(checkGoogleLoaded);
      }
    };
  }, [mode, login, signupContext, onAuthenticated]);

  const handleModeChange = (value: string) => {
    setMode(value === "signup" ? "signup" : "login");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isStrongPassword(password)) {
      setError(
        "Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special symbol.",
      );
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint =
        mode === "signup"
          ? "/api/signup"
          : "/api/login";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          mode === "signup"
            ? { email, name, password }
            : { email, password },
        ),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data && typeof data.detail === "string"
            ? data.detail
            : "Authentication failed. Please try again.";
        setError(message);
        return;
      }

      const userData = await response.json();
      if (mode === "signup") {
        signupContext(userData);
      } else {
        login(userData);
      }
      onAuthenticated();
    } catch {
      setError("Unable to reach server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-blue-100 shadow-md overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-lg">MediVault AI</CardTitle>
            <CardDescription className="text-blue-100">
              Securely manage your family&apos;s health records.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="mb-6 space-y-4">
          <div id="google-signin-button" className="flex justify-center w-full min-h-[40px]"></div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with email</span>
            </div>
          </div>
        </div>

        <Tabs
          value={mode}
          onValueChange={handleModeChange}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="login" className="px-4">
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="px-4">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600" aria-live="polite">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Continue
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-confirm-password">Confirm password</Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Repeat your password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600" aria-live="polite">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 text-xs text-gray-500">
        <span>
          By continuing, you agree to our terms and privacy policy.
        </span>
      </CardFooter>
    </Card>
  );
}
