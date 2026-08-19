import { motion } from "framer-motion";
import { ArrowLeft, ArrowDownToLine, ShoppingCart, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Withdraw = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: codes }, { data: profile }] = await Promise.all([
        supabase
          .from("fpc_codes")
          .select("id")
          .eq("user_id", user.id)
          .eq("used", false)
          .limit(1),
        supabase
          .from("profiles")
          .select("bonus_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setHasAccess((codes?.length ?? 0) > 0);
      setBalance(Number(profile?.bonus_balance ?? 0));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Auto-forward to the withdrawal form once access is granted.
  useEffect(() => {
    if (!loading && hasAccess) {
      navigate("/withdraw-request", { replace: true });
    }
  }, [loading, hasAccess, navigate]);

  return (
    <div className="relative min-h-screen bg-background pb-8">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-withdraw" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-withdraw)" />
        </svg>
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px]" />

      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 max-w-md mx-auto px-4 pt-5">
        {/* Header */}
        <motion.div variants={item} className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-full bg-destructive/15 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground tracking-tight">Withdraw</p>
            <p className="text-xs text-muted-foreground">
              Balance:{" "}
              <span className="font-bold text-foreground">
                ₦{balance.toLocaleString()}
              </span>
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div
            variants={item}
            className="glass-card rounded-2xl p-8 flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#F5C518] flex items-center justify-center mb-5 shadow-lg shadow-[#F5C518]/15">
              <ShoppingCart className="w-7 h-7 text-background" />
            </div>
            <p className="text-[15px] text-foreground font-semibold leading-relaxed mb-6">
              You need to buy a Withdrawal Code
              <br />
              before you can withdraw.
            </p>
            <button
              onClick={() => navigate("/buy-code")}
              className="btn-cta h-12 px-6 rounded-xl text-sm flex items-center justify-center gap-2 w-full"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy Withdrawal Code
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Withdraw;
