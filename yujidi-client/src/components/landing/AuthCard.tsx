import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Activity } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
interface AuthCardProps {
  onSuccess?: (payload: { email: string; name?: string }) => void;
}

/**
 * UI-only authentication card matching the YuJiDi design system.
 * Wire `onSuccess` (or replace handleSubmit) to your auth backend later.
 */
export const AuthCard = ({ onSuccess }: AuthCardProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("analyst@yujidi.ai");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  //   const handleSubmit = async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setError("");
  //     setIsLoading(true);

  //     try {
  //       // TODO: replace with real auth call (Lovable Cloud / your backend)
  //       await new Promise((r) => setTimeout(r, 700));
  //       onSuccess?.({ email, name: isSignUp ? name : undefined });
  //     } catch (err) {
  //       setError(err instanceof Error ? err.message : "Authentication failed");
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
      onSuccess?.({ email, name: isSignUp ? name : undefined })
      // Now it will only navigate AFTER the auth state is fully confirmed
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative w-full max-w-md mx-auto glass rounded-2xl border border-border p-8 overflow-hidden"
    >
      {/* Ambient glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-bull/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-2 font-mono text-xs text-muted-foreground mb-6">
        <Activity className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground">YuJiDi</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
          SECURE CHANNEL
        </span>
      </div>

      <div className="relative flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">
          {isSignUp ? "Create account" : "Welcome back"}
        </h2>
      </div>
      <p className="relative text-sm text-muted-foreground mb-6">
        {isSignUp
          ? "Spin up your AI risk co-pilot in seconds."
          : "Sign in to resume monitoring."}
      </p>

      {error && (
        <div className="relative mb-4 px-3 py-2 rounded-md border border-bear/40 bg-bear/10 text-bear text-xs font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name" className="font-mono text-xs text-muted-foreground tracking-wider">
              FULL NAME
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Satoshi Nakamoto"
              className="bg-secondary/50 border-border focus-visible:ring-primary/30"
              required={isSignUp}
              maxLength={100}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="font-mono text-xs text-muted-foreground tracking-wider">
            EMAIL
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@fund.com"
            className="bg-secondary/50 border-border focus-visible:ring-primary/30"
            required
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="font-mono text-xs text-muted-foreground tracking-wider">
            PASSWORD
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-secondary/50 border-border focus-visible:ring-primary/30"
            required
            minLength={6}
            maxLength={72}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full font-mono text-sm h-11 bg-primary text-primary-foreground hover:bg-primary-glow glow-primary"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? "AUTHENTICATING..." : isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* <Button
        type="button"
        variant="outline"
        className="relative w-full h-11 font-mono text-sm border-border bg-secondary/30 hover:bg-secondary/60"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
          />
        </svg>
        Sign in with Google
      </Button> */}
      <div className="rounded-lg border border-border bg-card/40 p-5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <span className="text-foreground font-semibold tracking-widest text-[10px]">DISCLAIMER · </span>
        Project YuJiDi is a non-commercial technical research project demonstrating RAG (Retrieval-Augmented Generation) architectures. This platform is NOT registered with SEBI. We do not provide investment advice, trading signals, or financial research. All data is for algorithmic testing and educational purposes only        </div>

      <p className="relative mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="text-primary hover:text-primary-glow font-medium transition-colors"
        >
          {isSignUp ? "Sign in" : "Create account"}
        </button>
      </p>
    </motion.div>
  );
};
