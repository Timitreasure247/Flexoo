import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, Copy, Check, Share2, Trophy, Play, CheckCircle, Sparkles, Link as LinkIcon, X, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface Ad {
  id: string;
  title: string;
  reward: number;
  video_url: string;
  daily_limit: number;
}

const EarnMore = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [successful, setSuccessful] = useState(0);
  const [goal, setGoal] = useState(50);
  const [hasFreeCode, setHasFreeCode] = useState(false);
  const [freeEnabled, setFreeEnabled] = useState(true);
  const [milestones, setMilestones] = useState({ m10: 2000, m25: 7500, m50: 25000 });
  const [ads, setAds] = useState<Ad[]>([]);
  const [todayCompletions, setTodayCompletions] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // Ad modal state
  const [activeAd, setActiveAd] = useState<Ad | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const link = code ? `${window.location.origin}/signup?ref=${code}` : "";

  const load = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const [{ data: prof }, { data: settings }, { data: stats }, { data: adsData }, { data: completions }] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_public_settings" as any),
      supabase.rpc("get_referral_stats", { p_user_id: user.id }),
      supabase.from("ads").select("*").eq("active", true).order("created_at", { ascending: false }),
      supabase.from("ad_completions").select("ad_id").eq("user_id", user.id).eq("completed_on", today),
    ]);
    if (prof?.referral_code) setCode(prof.referral_code);
    (settings || []).forEach((s: any) => {
      if (s.key === "referral_goal") setGoal(Number(s.value) || 50);
      if (s.key === "free_code_enabled") setFreeEnabled(s.value === "true");
      if (s.key === "milestone_10_reward") setMilestones((m) => ({ ...m, m10: Number(s.value) || 2000 }));
      if (s.key === "milestone_25_reward") setMilestones((m) => ({ ...m, m25: Number(s.value) || 7500 }));
      if (s.key === "milestone_50_reward") setMilestones((m) => ({ ...m, m50: Number(s.value) || 25000 }));
    });
    if (stats && typeof stats === "object") {
      const s: any = stats;
      setSuccessful(Number(s.successful) || 0);
      setHasFreeCode(!!s.has_free_code);
    }
    setAds((adsData || []) as Ad[]);
    const counts: Record<string, number> = {};
    (completions || []).forEach((c: any) => { counts[c.ad_id] = (counts[c.ad_id] || 0) + 1; });
    setTodayCompletions(counts);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const chan = supabase
      .channel("earn-more")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chan); if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 1500);
  };

  const shareLink = async () => {
    const text = `Join Flexoo with my referral code ${code}!`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join Flexoo", text, url: link }); } catch {}
    } else copyLink();
  };

  const claimFreeCode = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_free_withdrawal_code");
    if (error) toast.error(error.message);
    else {
      const code = (data as any)?.code;
      toast.success(`🎉 Free withdrawal code unlocked: ${code}`);
      setHasFreeCode(true);
    }
    setClaiming(false);
  };

  const openAd = (ad: Ad) => {
    const done = todayCompletions[ad.id] || 0;
    if (done >= ad.daily_limit) { toast.error("Daily limit reached"); return; }
    setActiveAd(ad);
    setCountdown(30);
    setPlaying(false);
  };

  const startAd = () => {
    setPlaying(true);
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishAd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishAd = async () => {
    if (!activeAd) return;
    const ad = activeAd;
    setActiveAd(null);
    setPlaying(false);
    const { data, error } = await supabase.rpc("complete_ad", { p_ad_id: ad.id });
    if (error) toast.error(error.message);
    else {
      const r = (data as any)?.reward ?? ad.reward;
      toast.success(`+₦${r} earned!`);
      setTodayCompletions((prev) => ({ ...prev, [ad.id]: (prev[ad.id] || 0) + 1 }));
    }
  };

  const closeAd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveAd(null);
    setPlaying(false);
  };

  // Extract YouTube ID from a URL or accept a raw ID
  const ytEmbed = (url: string) => {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    const id = m ? m[1] : url.trim();
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;
  };

  const progress = goal > 0 ? Math.min(100, (successful / goal) * 100) : 0;
  const remaining = Math.max(0, goal - successful);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <div className="relative z-10 max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate("/main")} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-foreground">Earn More</h1>
            <p className="text-[10px] text-muted-foreground">Watch ads, refer friends, unlock free code</p>
          </div>
        </div>

        {/* Free Withdrawal Code Progress */}
        {freeEnabled && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-center gap-2 mb-2 relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}>
                <Gift className="w-4 h-4 text-background" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-foreground">Get Your Code FREE</p>
                <p className="text-[10px] text-muted-foreground">Refer {goal} friends and unlock withdrawals without paying.</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2 mt-4">
              <p className="text-[11px] font-bold text-foreground">{successful}/{goal} referrals</p>
              <p className="text-[11px] font-bold text-primary">{Math.round(progress)}%</p>
            </div>
            <Progress value={progress} className="h-2.5 mb-2" />
            <p className="text-[11px] text-muted-foreground">
              {hasFreeCode ? "🎉 Your free withdrawal code is unlocked!" : remaining === 0 ? "You reached the goal — claim your free code below!" : `${remaining} more referral${remaining === 1 ? "" : "s"} to unlock free code.`}
            </p>
            {successful >= goal && !hasFreeCode && (
              <button onClick={claimFreeCode} disabled={claiming} className="btn-cta w-full h-10 rounded-xl text-sm mt-3 flex items-center justify-center gap-1.5 disabled:opacity-60">
                <Sparkles className="w-4 h-4" /> {claiming ? "Unlocking…" : "Claim Free Code"}
              </button>
            )}
            {hasFreeCode && (
              <button onClick={() => navigate("/payment-receipt")} className="btn-cta w-full h-10 rounded-xl text-sm mt-3">
                View my free code
              </button>
            )}
          </motion.div>
        )}

        {/* Share Your Link */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Share Your Link</p>
          <div className="inner-card rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3">
            <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-[11px] font-mono-app text-foreground truncate flex-1">{link || "—"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyLink} className="glass-card rounded-xl h-10 flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy Link
            </button>
            <button onClick={shareLink} className="btn-cta rounded-xl h-10 flex items-center justify-center gap-1.5 text-[11px]">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Daily Ads */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Watch & Earn</p>
                <p className="text-[10px] text-muted-foreground">Complete ads to earn rewards. Resets every 24h.</p>
              </div>
            </div>
          </div>
          {ads.length === 0 ? (
            <div className="text-center py-6 text-[11px] text-muted-foreground">No ads available right now. Check back soon.</div>
          ) : (
            <div className="space-y-2">
              {ads.map((ad) => {
                const done = todayCompletions[ad.id] || 0;
                const completed = done >= ad.daily_limit;
                const remaining = ad.daily_limit - done;
                return (
                  <div key={ad.id} className="inner-card rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${completed ? "bg-primary/20" : "bg-secondary"}`}>
                        {completed ? <CheckCircle className="w-5 h-5 text-primary" /> : <Play className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[12px] font-bold text-foreground truncate">{ad.title}</p>
                          <span className="text-[10px] font-extrabold text-primary shrink-0">+₦{Number(ad.reward).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {completed ? `✓ Completed · Reward received` : `${remaining} of ${ad.daily_limit} remaining today`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openAd(ad)} disabled={completed} className="btn-cta w-full h-8 rounded-lg text-[11px] mt-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                      {completed ? "Completed" : (<><Play className="w-3 h-3" /> Watch Video</>)}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-bold text-foreground">Referral Milestones</p>
          </div>
          <div className="space-y-2">
            {[
              { n: 10, reward: milestones.m10, bonus: null as string | null },
              { n: 25, reward: milestones.m25, bonus: null as string | null },
              { n: goal, reward: milestones.m50, bonus: "+ FREE Withdrawal Code" },
            ].map((m) => {
              const done = successful >= m.n;
              return (
                <div key={m.n} className={`inner-card rounded-xl p-3 flex items-center gap-3 ${done ? "border-primary/40" : ""}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${done ? "bg-primary/20" : "bg-secondary"}`}>
                    {done ? <CheckCircle className="w-5 h-5 text-primary" /> : <Users className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-foreground">{m.n} Referrals</p>
                    <p className="text-[10px] text-muted-foreground">₦{m.reward.toLocaleString()} {m.bonus}</p>
                  </div>
                  {done && <span className="text-[9px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full uppercase">Done</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-sm font-bold text-foreground mb-3">How It Works</p>
          <ol className="space-y-2">
            {[
              "Share your referral link.",
              "Friends register using your referral link.",
              "Every successful referral increases your progress.",
              `Reach ${goal} successful referrals to unlock a free withdrawal code.`,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Ad Modal */}
      <AnimatePresence>
        {activeAd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card rounded-2xl p-5 max-w-sm w-full">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-foreground truncate">{activeAd.title}</p>
                <button onClick={closeAd} className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
              {!playing ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3"><Play className="w-8 h-8 text-primary" /></div>
                  <p className="text-[11px] text-muted-foreground mb-4">Watch a 30-second video to earn <span className="text-primary font-bold">₦{activeAd.reward.toLocaleString()}</span>. Reward is credited only after the video finishes.</p>
                  <button onClick={startAd} className="btn-cta w-full h-10 rounded-xl text-sm flex items-center justify-center gap-2"><Play className="w-4 h-4" /> Start Watching</button>
                </div>
              ) : (
                <>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 bg-secondary">
                    <iframe src={ytEmbed(activeAd.video_url)} className="absolute inset-0 w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title={activeAd.title} />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center"><span className="text-sm font-extrabold text-primary">{countdown}</span></div>
                    <p className="text-[11px] text-muted-foreground">seconds remaining</p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EarnMore;
