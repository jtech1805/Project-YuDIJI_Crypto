import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

export function AuthCard() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("founder@yujidi.com");
  const [password, setPassword] = useState("FAANGSecure!2026");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");
//     setIsLoading(true);

//     try {
//       if (isSignUp) {
//         await apiClient.post("/auth/register", { name, email, password });
//         login({ email, password });
//       } else {
//         // const { data } = await apiClient.post("/auth/login", { email, password });
//         login({ email, password });
//       }
//       navigate("/dashboard");
//     } catch (err: any) {
//       setError(err.response?.data?.message || "Authentication failed");
//     } finally {
//       setIsLoading(false);
//     }
//   };
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
  
    try {
      if (isSignUp) {
        await apiClient.post("/auth/register", { name, email, password });
        // Add await here!
        await login({ email, password }); 
      } else {
        // If the API call is happening inside your Context's login function:
        // Add await here!
        await login({ email, password });
      }
      
      // Now it will only navigate AFTER the auth state is fully confirmed
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card p-8 w-full max-w-md shadow-[0_0_20px_rgba(168,85,247,0.15)]">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-bearish rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Satoshi Nakamoto"
              className="bg-secondary/50 border-border focus:border-accent focus:ring-accent/20"
              required={isSignUp}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@fund.com"
            className="bg-secondary/50 border-border focus:border-accent focus:ring-accent/20"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-secondary/50 border-border focus:border-accent focus:ring-accent/20"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-200 mt-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isLoading ? "Authenticating..." : isSignUp ? "Create Account" : "Sign In"}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        variant="outline"
        type="button"
        className="w-full border-border bg-secondary/30 hover:bg-secondary/60 text-foreground transition-all duration-200"
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-accent hover:text-accent/80 font-medium transition-colors"
        >
          {isSignUp ? "Sign In" : "Create Account"}
        </button>
      </p>
    </div>
  );
}