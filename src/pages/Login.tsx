import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import flexooLogo from "@/assets/flexoo-logo.png";

const particles = [
  { top: "5%", left: "15%", delay: 0 },
  { top: "10%", right: "8%", delay: 1.5 },
  { top: "40%", right: "4%", delay: 3 },
  { top: "65%", left: "25%", delay: 2 },
  { top: "55%", right: "15%", delay: 4 },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-login" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-login)" />
        </svg>
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle absolute w-1.5 h-1.5 rounded-full bg-primary/60"
          style={{ top: p.top, left: p.left, right: p.right, animationDelay: `${p.delay}s` } as React.CSSProperties}
        />
      ))}

      {/* Central glow */}
      <div className="bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-md"
      >
        {/* Back link */}
        <motion.div variants={item}>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div variants={item} className="flex items-center gap-3 mb-1">
          <img src={flexooLogo} alt="Flexoo Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your Flexoo account</p>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          variants={item}
          className="mt-6 rounded-2xl p-6"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <form className="space-y-5" onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (!email.trim() || !password.trim()) {
              setError("Please fill in all fields.");
              return;
            }
            if (password.length < 6) {
              setError("Password must be at least 6 characters.");
              return;
            }
            setLoading(true);
            try {
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (signInError) {
                setError(signInError.message);
                return;
              }
              toast.success("Signed in successfully!");
              navigate("/dashboard");
            } catch (err: any) {
              setError(err.message || "Something went wrong.");
            } finally {
              setLoading(false);
            }
          }}>
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider text-muted-foreground mb-1.5 uppercase">
                EMAIL
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="signup-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold tracking-wider text-muted-foreground mb-1.5 uppercase">
                PASSWORD
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="signup-input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--gradient-cta)",
                color: "hsl(150, 30%, 6%)",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </motion.div>

        {/* Sign up link */}
        <motion.p variants={item} className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
