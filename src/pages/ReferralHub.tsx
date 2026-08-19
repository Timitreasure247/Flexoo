import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Wallet, Gift, Copy, Check, Share2, MessageCircle, Send, Link as LinkIcon, Trophy, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface RefRow {
  id: string;
  referee_user_id: string;
  reward_amount: number;
  status: string;
  created_at: string;
  referee?: { full_name: string | null; username: string | null };
}

const ReferralHub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState<string>("");
  const [reward, setReward] = useState<number>(5000);
  const [goal, setGoal] = useState<number>(50);
  const [successful, setSuccessful] = useState(0);
  const [pending, setPending] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [rows, setRows] = useState<RefRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const link = code ? `${window.location.origin}/signup?ref=${code}` : "";

  const load = async () => {
    if (!user) return;
    const [{ data: prof }, { data: settings }, { data: stats }] = await Promise.all([
      supabase.from("profiles").select("id, referral_code").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_public_settings" as any),
      supabase.rpc("get_referral_stats", { p_user_id: user.id }),
    ]);
    if (prof?.referral_code) setCode(prof.referral_code);
    (settings || []).forEach((s: any) => {
      if (s.key === "referral_reward") setReward(Number(s.value) || 5000);
      if (s.key === "referral_goal") setGoal(Number(s.value) || 50);
    });
    if (stats && typeof stats === "object") {
      const s: any = stats;
      setSuccessful(Number(s.successful) || 0);
      setPending(Number(s.pending) || 0);
      setEarnings(Number(s.earnings) || 0);
    }
    if (prof?.id) {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_profile_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.referee_profile_id)));
      let map = new Map<string, any>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
        map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      setRows((data ?? []).map((r: any) => ({ ...r, referee: map.get(r.referee_profile_id) })));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const chan = supabase
      .channel("referral-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied!");
    setTimeout(() => setCopied(null), 1500);
  };

  const shareText = `Join Flexoo with my referral code ${code} and earn a welcome bonus! ${link}`;
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join Flexoo", text: shareText, url: link }); } catch {}
    } else {
      copy(link, "link");
    }
  };

  const progress = goal > 0 ? Math.min(100, (successful / goal) * 100) : 0;

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-foreground">Referral Hub</h1>
            <p className="text-[10px] text-muted-foreground">Invite friends, earn rewards</p>
          </div>
        </div>

        {/* Dashboard card */}
        <div className="glass-card rounded-2xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="flex items-center gap-3 mb-4 relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}>
              <Gift className="w-5 h-5 text-background" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Reward per Referral</p>
              <p className="text-xl font-extrabold text-primary">₦{reward.toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 relative">
            <div className="inner-card rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-primary" /><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Successful</p></div>
              <p className="text-lg font-extrabold text-foreground">{successful}</p>
              {pending > 0 && <p className="text-[9px] text-muted-foreground">{pending} pending</p>}
            </div>
            <div className="inner-card rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-primary" /><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Earnings</p></div>
              <p className="text-lg font-extrabold text-primary">₦{earnings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Referral link */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Your Referral Link</p>
          <div className="inner-card rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3">
            <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-[11px] font-mono-app text-foreground truncate flex-1">{link || "—"}</p>
            <button onClick={() => copy(link, "link")} className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
              {copied === "link" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Your Referral Code</p>
          <div className="inner-card rounded-xl px-3 py-2.5 flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-sm font-bold font-mono-app text-foreground flex-1 tracking-wider">{code || "—"}</p>
            <button onClick={() => copy(code, "code")} className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
              {copied === "code" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="glass-card rounded-xl h-10 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-400/10 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="glass-card rounded-xl h-10 flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-400 hover:bg-sky-400/10 transition-colors">
              <Send className="w-3.5 h-3.5" /> Telegram
            </a>
            <button onClick={nativeShare} className="btn-cta rounded-xl h-10 flex items-center justify-center gap-1.5 text-[11px]">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Free code progress mini */}
        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-foreground">Free Withdrawal Code Progress</p>
            </div>
            <p className="text-[11px] font-bold text-primary">{successful}/{goal}</p>
          </div>
          <Progress value={progress} className="h-2 mb-2" />
          <p className="text-[10px] text-muted-foreground">
            {successful >= goal ? "You've unlocked your free withdrawal code!" : `${goal - successful} more referrals to unlock free code.`}
          </p>
          <button onClick={() => navigate("/earn-more")} className="btn-cta w-full h-9 rounded-lg text-[11px] mt-3">Go to Earn More</button>
        </div>

        {/* History */}
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Referral History</h2>
        </div>
        {rows.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-xs text-muted-foreground">
            No referrals yet. Share your link above to start earning.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="glass-card rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{r.referee?.full_name || r.referee?.username || "New user"}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">₦{Number(r.reward_amount).toLocaleString()}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize ${r.status === "successful" ? "bg-primary/10 text-primary" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {r.status === "successful" ? "Successful" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReferralHub;