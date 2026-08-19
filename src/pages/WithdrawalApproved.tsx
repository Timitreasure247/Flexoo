import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, CheckCircle, Headphones, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Particles = () => {
  const dots = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 5,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 6,
        color: ["#22c55e", "#eab308", "#a3e635"][Math.floor(Math.random() * 3)],
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: [-10, -80, -10] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full blur-[1px]"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            background: d.color,
            boxShadow: `0 0 12px ${d.color}`,
          }}
        />
      ))}
    </div>
  );
};

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  withdrawal_code: string | null;
  approved_at: string | null;
  created_at: string;
};

const WithdrawalApproved = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const withdrawalId = params.get("id");
  const [wd, setWd] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let query = supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("approved_at", { ascending: false });
      if (withdrawalId) query = query.eq("id", withdrawalId);
      const { data } = await query.limit(1).maybeSingle();
      setWd(data as Withdrawal | null);
      setLoading(false);
      if (data?.id) {
        try {
          const seen = JSON.parse(localStorage.getItem("wd_seen") || "[]");
          if (!seen.includes(data.id)) {
            seen.push(data.id);
            localStorage.setItem("wd_seen", JSON.stringify(seen));
          }
        } catch { /* ignore */ }
      }
    };
    load();
  }, [user, withdrawalId]);

  const copyCode = () => {
    if (!wd?.withdrawal_code) return;
    navigator.clipboard.writeText(wd.withdrawal_code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!wd) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white text-lg font-bold mb-2">No approved withdrawal found</p>
          <p className="text-white/60 text-sm mb-6">Check your withdrawal history for pending requests.</p>
          <button onClick={() => navigate("/main", { replace: true })} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const approvedAt = wd.approved_at ? new Date(wd.approved_at) : new Date();

  return (
    <div className="relative min-h-screen bg-[#0B0F14] overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-emerald-500/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-yellow-400/10 blur-[120px] pointer-events-none" />
      <Particles />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.15 }}
            className="relative w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 30% 30%, #86efac, #22c55e 55%, #059669 110%)",
              boxShadow: "0 0 70px rgba(34,197,94,0.5)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-emerald-300/40"
            />
            <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center border border-white/10">
              <Check className="w-9 h-9 text-white" strokeWidth={3} />
            </div>
          </motion.div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-extrabold text-white text-center tracking-tight"
        >
          Withdrawal Approved!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-white/60 text-center mt-2 mb-6"
        >
          Your withdrawal request has been approved.
        </motion.p>

        {/* Code card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-5 mb-4 border border-emerald-500/20 backdrop-blur-xl text-center"
          style={{
            background: "linear-gradient(160deg, rgba(34,197,94,0.12), rgba(234,179,8,0.06))",
            boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
          }}
        >
          <p className="text-[10px] font-bold tracking-[0.28em] text-white/60 uppercase mb-3">Your Withdrawal Code</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300 font-mono tracking-widest">
              {wd.withdrawal_code || "—"}
            </p>
            <button
              onClick={copyCode}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/80" />}
            </button>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-4 mb-6 border border-white/5 backdrop-blur-xl divide-y divide-white/5"
          style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))" }}
        >
          <Row label="Amount" value={`₦${Number(wd.amount).toLocaleString()}`} />
          <Row label="Bank" value={wd.bank_name} />
          <Row label="Approved" value={approvedAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="space-y-2.5"
        >
          <button
            onClick={() => navigate("/main", { replace: true })}
            className="w-full h-12 rounded-2xl font-bold text-black text-sm tracking-wide flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(90deg, #22c55e 0%, #a3e635 50%, #eab308 100%)",
              boxShadow: "0 10px 30px -10px rgba(34,197,94,0.6)",
            }}
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/support")}
            className="w-full h-11 rounded-2xl font-semibold text-white/90 text-sm border border-white/10 hover:bg-white/5 flex items-center justify-center gap-2"
          >
            <Headphones className="w-4 h-4" /> Contact Support
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">{label}</span>
    <span className="text-sm text-white font-semibold">{value}</span>
  </div>
);

export default WithdrawalApproved;
