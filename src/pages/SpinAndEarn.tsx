import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SEGMENTS = [
  { label: "₦500", value: 500, color: "hsl(85, 70%, 45%)" },
  { label: "₦1,000", value: 1000, color: "hsl(150, 40%, 25%)" },
  { label: "₦200", value: 200, color: "hsl(85, 70%, 45%)" },
  { label: "₦5,000", value: 5000, color: "hsl(150, 40%, 25%)" },
  { label: "₦100", value: 100, color: "hsl(85, 70%, 45%)" },
  { label: "₦2,000", value: 2000, color: "hsl(150, 40%, 25%)" },
  { label: "₦50", value: 50, color: "hsl(85, 70%, 45%)" },
  { label: "₦10,000", value: 10000, color: "hsl(150, 40%, 25%)" },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;

const SpinAndEarn = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof SEGMENTS[0] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hasSpunToday, setHasSpunToday] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user has spun today from DB
  useEffect(() => {
    if (!user) return;
    const checkSpin = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("spin_history")
        .select("id")
        .eq("user_id", user.id)
        .gte("spun_at", `${today}T00:00:00`)
        .lte("spun_at", `${today}T23:59:59`);
      setHasSpunToday((data?.length || 0) > 0);
      setLoading(false);
    };
    checkSpin();
  }, [user]);

  const spin = async () => {
    if (spinning || hasSpunToday || !user) return;

    setShowResult(false);
    setResult(null);
    setSpinning(true);

    const weights = SEGMENTS.map((s) => 1 / Math.sqrt(s.value));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rand = Math.random() * totalWeight;
    let cumulative = 0;
    let winIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) { winIndex = i; break; }
    }

    const won = SEGMENTS[winIndex];
    const segmentCenter = winIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const extraSpins = 5 * 360;
    const targetRotation = rotation + extraSpins + (360 - segmentCenter);
    setRotation(targetRotation);

    setTimeout(async () => {
      setResult(won);
      setShowResult(true);
      setSpinning(false);
      setHasSpunToday(true);

      if (user) {
        // Record spin in history
        await supabase.from("spin_history").insert({ user_id: user.id, amount: won.value });

        // Credit balance
        const { data: profile } = await supabase.from("profiles").select("bonus_balance").eq("user_id", user.id).single();
        if (profile) {
          await supabase.from("profiles").update({ bonus_balance: profile.bonus_balance + won.value }).eq("user_id", user.id);
        }
      }
      toast.success(`You won ${won.label}! 🎉`);
    }, 4500);
  };

  return (
    <div className="relative min-h-screen bg-background pb-10 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/earn-more")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Spin & Earn</h1>
        </div>

        <div className="glass-card rounded-xl p-4 mb-6 text-center">
          <Gift className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground mb-1">Daily Spin</p>
          <p className="text-xs text-muted-foreground">
            Spin the wheel once daily to win up to <span className="text-primary font-bold">₦10,000</span>!
          </p>
        </div>

        {/* Wheel */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 z-20">
            <div className="w-0 h-0" style={{ borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "20px solid hsl(var(--primary))", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
          </div>
          <div className="w-72 h-72 rounded-full relative" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none" }}>
            <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-2xl">
              {SEGMENTS.map((seg, i) => {
                const startAngle = i * SEGMENT_ANGLE;
                const endAngle = startAngle + SEGMENT_ANGLE;
                const startRad = ((startAngle - 90) * Math.PI) / 180;
                const endRad = ((endAngle - 90) * Math.PI) / 180;
                const x1 = 150 + 150 * Math.cos(startRad);
                const y1 = 150 + 150 * Math.sin(startRad);
                const x2 = 150 + 150 * Math.cos(endRad);
                const y2 = 150 + 150 * Math.sin(endRad);
                const midAngle = ((startAngle + SEGMENT_ANGLE / 2 - 90) * Math.PI) / 180;
                const textX = 150 + 95 * Math.cos(midAngle);
                const textY = 150 + 95 * Math.sin(midAngle);
                const textRotation = startAngle + SEGMENT_ANGLE / 2;
                return (
                  <g key={i}>
                    <path d={`M150,150 L${x1},${y1} A150,150 0 0,1 ${x2},${y2} Z`} fill={seg.color} stroke="hsl(150, 30%, 10%)" strokeWidth="1.5" />
                    <text x={textX} y={textY} fill="white" fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${textRotation}, ${textX}, ${textY})`}>{seg.label}</text>
                  </g>
                );
              })}
              <circle cx="150" cy="150" r="22" fill="hsl(150, 30%, 10%)" stroke="hsl(var(--primary))" strokeWidth="3" />
              <text x="150" y="150" fill="hsl(var(--primary))" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">SPIN</text>
            </svg>
          </div>
        </div>

        <button
          onClick={spin}
          disabled={spinning || hasSpunToday || loading}
          className="w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--gradient-cta)", color: "hsl(150, 30%, 6%)" }}
        >
          <RotateCw className={`w-5 h-5 ${spinning ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : spinning ? "Spinning..." : hasSpunToday ? "Come Back Tomorrow!" : "Spin Now"}
        </button>

        {/* Result Modal */}
        <AnimatePresence>
          {showResult && result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowResult(false)}>
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: "spring", damping: 15 }} className="glass-card rounded-2xl p-8 text-center max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", damping: 10 }} className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-10 h-10 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground mb-2">🎉 Congratulations!</h2>
                <p className="text-muted-foreground mb-1">You won</p>
                <p className="text-3xl font-extrabold text-primary mb-4">{result.label}</p>
                <p className="text-xs text-muted-foreground mb-6">The bonus has been added to your wallet balance.</p>
                <button onClick={() => setShowResult(false)} className="w-full h-10 rounded-xl font-semibold text-sm" style={{ background: "var(--gradient-cta)", color: "hsl(150, 30%, 6%)" }}>Awesome!</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SpinAndEarn;
