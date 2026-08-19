import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle, PartyPopper, Sparkles, Gift, ArrowRight, Share2, Download, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fireConfetti = () => {
  const duration = 2800;
  const end = Date.now() + duration;
  const colors = ["#a3e635", "#84cc16", "#22c55e", "#facc15", "#fb923c"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, scalar: 0.9 });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, scalar: 0.9 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  setTimeout(() => {
    confetti({ particleCount: 140, spread: 110, origin: { y: 0.5 }, colors, startVelocity: 50 });
  }, 200);
};

const SignupSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const MAX_ATTEMPTS = 3;
  const firedRef = useRef(false);
  const BONUS = 170000;

  useEffect(() => {
    if (verifying || firedRef.current) return;
    firedRef.current = true;
    fireConfetti();
  }, [verifying]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setVerifying(true);
      setVerifyError(null);
      setAttempt(0);
      setCurrentBalance(null);
      let lastError: string | null = null;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        setAttempt(i + 1);
        const { data, error } = await supabase.rpc("claim_signup_bonus");
        if (error) {
          console.error("[SignupSuccess] profile fetch error:", error);
          lastError = error.message;
        }
        if (!cancelled && data && !error) {
          const result = data as {
            full_name?: string;
            referral_code?: string;
            bonus_balance?: number | string;
          };
          setFullName(result.full_name || "");
          setReferralCode(result.referral_code || "");
          const bal = Number(result.bonus_balance ?? 0);
          setCurrentBalance(bal);
          console.log(`[SignupSuccess] attempt ${i + 1}: balance=${bal}`);
          if (bal >= BONUS) {
            setVerifying(false);
            toast.success("Welcome bonus credited!");
            return;
          }
        }
        if (i < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 900));
      }
      if (!cancelled) {
        setVerifyError(
          lastError
            ? `Could not credit welcome bonus: ${lastError}`
            : `Bonus credit did not complete after ${MAX_ATTEMPTS} attempts. Please retry.`
        );
        setVerifying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const buildShareCard = async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0f0a");
    bg.addColorStop(1, "#111c0a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    glow(W / 2, 220, 600, "rgba(132, 204, 22, 0.4)");
    glow(W, H, 700, "rgba(251, 146, 60, 0.18)");

    const cx = 80, cy = 220, cw = W - 160, ch = H - 440, r = 48;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.arcTo(cx + cw, cy, cx + cw, cy + ch, r);
    ctx.arcTo(cx + cw, cy + ch, cx, cy + ch, r);
    ctx.arcTo(cx, cy + ch, cx, cy, r);
    ctx.arcTo(cx, cy, cx + cw, cy, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(132, 204, 22, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🎁 WELCOME BONUS UNLOCKED", W / 2, 130);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 76px system-ui, sans-serif";
    ctx.fillText("I just joined Flexoo!", W / 2, cy + 130);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText(fullName ? `Welcome, ${fullName.split(" ")[0]} 🎉` : "Welcome to the future of earning", W / 2, cy + 185);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText("SIGN UP BONUS", W / 2, cy + 290);

    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 140px system-ui, sans-serif";
    ctx.fillText(`₦${BONUS.toLocaleString()}`, W / 2, cy + 430);

    ctx.strokeStyle = "rgba(132, 204, 22, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 80, cy + 500);
    ctx.lineTo(cx + cw - 80, cy + 500);
    ctx.stroke();

    if (referralCode) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillText("USE MY REFERRAL CODE", W / 2, cy + 580);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px ui-monospace, 'Courier New', monospace";
      ctx.fillText(referralCode, W / 2, cy + 660);

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "italic 24px system-ui, sans-serif";
      ctx.fillText("Get ₦170,000 when you sign up", W / 2, cy + 710);
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("Join me — start earning today", W / 2, H - 160);

    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 38px system-ui, sans-serif";
    ctx.fillText("flexoo", W / 2, H - 100);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  };

  const handleShare = async () => {
    if (verifying || verifyError) {
      toast.error("Please wait until your bonus is credited");
      return;
    }
    setSharing(true);
    try {
      const blob = await buildShareCard();
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "flexoo-welcome.png", { type: "image/png" });
      const shareData: ShareData = {
        title: "I just joined Flexoo! 🎉",
        text: `I just claimed my ₦${BONUS.toLocaleString()} welcome bonus on Flexoo!${referralCode ? ` Use my code ${referralCode} to get yours.` : ""}`,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare(shareData) && navigator.share) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "flexoo-welcome.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Welcome card downloaded!");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Could not share card");
    } finally {
      setSharing(false);
    }
  };

  if (verifying || verifyError) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-xs w-full">
          {verifying ? (
            <>
              <div className="relative mb-5">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-primary/30 blur-2xl"
                />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Loader2 className="w-9 h-9 text-primary-foreground animate-spin" strokeWidth={2.5} />
                </div>
              </div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                Crediting Bonus
              </p>
              <h1 className="text-lg font-extrabold text-foreground mb-1.5">
                Verifying your ₦{BONUS.toLocaleString()} bonus…
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Hang tight while we confirm the deposit to your wallet.
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-[260px] mb-3">
                <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (attempt / MAX_ATTEMPTS) * 100)}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                  <span>Attempt {Math.max(1, attempt)} of {MAX_ATTEMPTS}</span>
                  <span>
                    {currentBalance === null
                      ? "Connecting…"
                      : `₦${currentBalance.toLocaleString()} / ₦${BONUS.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Status checklist */}
              <div className="w-full max-w-[260px] space-y-1.5 mt-2 text-left">
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">Account created</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {currentBalance !== null ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  )}
                  <span className="text-muted-foreground">Profile loaded</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  <span className="text-muted-foreground">Crediting ₦{BONUS.toLocaleString()} bonus</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] opacity-50">
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-muted-foreground">Sharing unlocks after verification</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-yellow-400" />
              </div>
              <h1 className="text-base font-bold text-foreground mb-1.5">
                Almost there
              </h1>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                {verifyError}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="h-11 px-6 rounded-xl text-sm font-bold"
                style={{ background: "var(--gradient-cta)", color: "hsl(150, 30%, 6%)" }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md mx-auto px-5 pt-10"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="relative mb-4">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-primary/30 blur-2xl"
            />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_60px_rgba(132,204,22,0.5)]">
              <Gift className="w-12 h-12 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-3"
          >
            <PartyPopper className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              Welcome Bonus Unlocked
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-extrabold text-foreground mb-2"
          >
            Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}! 🎉
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-muted-foreground leading-relaxed max-w-xs"
          >
            Your account is ready and your{" "}
            <span className="font-bold text-foreground">₦{BONUS.toLocaleString()} welcome bonus</span>{" "}
            has been credited to your wallet.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card rounded-2xl p-5 border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden mb-5"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-xs font-extrabold text-primary uppercase tracking-wider">
                Sign Up Bonus
              </p>
            </div>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-extrabold text-foreground tracking-tight">
                ₦{BONUS.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground mb-1.5">credited</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              Added to your bonus balance
            </div>
            {referralCode && (
              <div className="mt-4 pt-4 border-t border-primary/15">
                <p className="text-[11px] text-muted-foreground mb-1.5">Your referral code</p>
                <div className="font-mono text-base font-bold text-foreground tracking-widest">
                  {referralCode}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="space-y-2.5"
        >
          <button
            onClick={handleShare}
            disabled={sharing || verifying || !!verifyError}
            aria-disabled={sharing || verifying || !!verifyError}
            className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-cta)", color: "hsl(150, 30%, 6%)" }}
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share My Success
            <Download className="w-3.5 h-3.5 opacity-60" />
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SignupSuccess;
