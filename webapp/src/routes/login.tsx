import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmail, signUpWithOtp } from "@/lib/supabase-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up flow: send OTP code (creates user if doesn't exist)
        const { error } = await signUpWithOtp(email.trim());
        if (error) {
          setError(error.message);
        } else {
          // Redirect to verify-otp page
          navigate("/verify-otp", { state: { email: email.trim() } });
        }
      } else {
        // Sign in flow: use password
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) {
          setError(error.message);
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Car className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bebas text-3xl tracking-wider text-foreground">AUTOPOST</h1>
            <p className="font-dm text-xs text-muted-foreground -mt-1">Dealer CRM</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <div className="text-center mb-6">
            <h2 className="font-bebas text-2xl tracking-wider text-foreground">
              {isSignUp ? "CREATE ACCOUNT" : "WELCOME BACK"}
            </h2>
            <p className="font-dm text-sm text-muted-foreground mt-1">
              {isSignUp
                ? "Enter your email to receive a verification code"
                : "Enter your credentials to sign in"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-dm text-sm text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-input border-border font-dm"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Only show password field for sign in */}
            {!isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="password" className="font-dm text-sm text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-input border-border font-dm"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="font-dm text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email.trim() || (!isSignUp && !password)}
              className="w-full bg-primary text-primary-foreground font-bebas text-lg tracking-wider h-11"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "SEND CODE" : "SIGN IN"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              className="font-dm text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? (
                <>
                  Already have an account?{" "}
                  <span className="text-primary font-medium">Sign in</span>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <span className="text-primary font-medium">Sign up</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
