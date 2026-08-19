import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
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

      // Verify admin role server-side
      const { data: isAdmin, error: roleError } = await supabase.rpc("is_current_user_admin");
      if (roleError || isAdmin !== true) {
        await supabase.auth.signOut();
        setError("Access denied. This account is not an administrator.");
        return;
      }

      toast.success("Welcome, Admin!");
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-admin" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-admin)" />
        </svg>
      </div>

      <div className="bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
            <p className="text-sm text-muted-foreground">Restricted area · Authorized personnel only</p>
          </div>
        </div>

        <div
          className="mt-6 rounded-2xl p-6"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <div>
              <label className="block text-[11px] font-semibold tracking-wider text-muted-foreground mb-1.5 uppercase">
                ADMIN EMAIL
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </span>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  className="signup-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--gradient-cta)",
                color: "hsl(150, 30%, 6%)",
              }}
            >
              <Shield className="w-4 h-4" />
              {loading ? "Verifying..." : "Sign in as Admin"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not an admin?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            User login
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
