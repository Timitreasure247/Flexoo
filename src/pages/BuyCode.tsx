import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Copy, Check, Upload, ExternalLink, Landmark,
  CreditCard, User, Loader2, Shield, X, AlertTriangle,
  ArrowRight, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "loading" | "price" | "notice" | "account";

const STORAGE_KEY = "buycode:step";

const BuyCode = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStepState] = useState<Step>("loading");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [price, setPrice] = useState(7500);
  const [bank, setBank] = useState("Moniepoint MFB");
  const [accountName, setAccountName] = useState("FLEXOO DIGITAL SERVICES");
  const [accountNumber, setAccountNumber] = useState("8137498802");
  const [instructions, setInstructions] = useState("");
  const [transferLink, setTransferLink] = useState("");
  const [username, setUsername] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setStep = (s: Step) => {
    setStepState(s);
    try {
      if (s === "loading") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, s);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const referenceNumber = useMemo(() => {
    if (!user) return "";
    return `FLX-${user.id.slice(0, 8).toUpperCase()}`;
  }, [user]);

  // Fetch data
  useEffect(() => {
    (async () => {
      const [{ data: settings }, profileRes] = await Promise.all([
        supabase.rpc("get_public_settings" as any),
        user ? supabase.from("profiles").select("username, full_name").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      (settings || []).forEach((s: any) => {
        if (s.key === "withdrawal_code_price") { const n = Number(s.value); if (Number.isFinite(n) && n > 0) setPrice(n); }
        if (s.key === "pay_with_transfer_link") setTransferLink(s.value || "");
        if (s.key === "bank_name" && s.value) setBank(s.value);
        if (s.key === "account_name" && s.value) setAccountName(s.value);
        if (s.key === "account_number" && s.value) setAccountNumber(s.value);
        if (s.key === "payment_instructions") setInstructions(s.value || "");
      });
      const prof = (profileRes as any)?.data;
      if (prof) setUsername(prof.username || prof.full_name || "");
      setDataLoaded(true);
    })();
  }, [user]);

  // Loading gate: hold "loading" for at least 1.5s and until data has loaded, then restore saved step or go to "price"
  useEffect(() => {
    let saved: Step | null = null;
    try {
      const v = localStorage.getItem(STORAGE_KEY) as Step | null;
      if (v && ["price", "notice", "account"].includes(v)) saved = v;
    } catch {}
    const minDelay = new Promise<void>((r) => setTimeout(r, 1500));
    (async () => {
      await minDelay;
      // Wait until data is loaded
      const waitData = () =>
        new Promise<void>((resolve) => {
          if (dataLoaded) return resolve();
          const iv = setInterval(() => {
            if (dataLoaded) { clearInterval(iv); resolve(); }
          }, 100);
        });
      await waitData();
      setStepState(saved || "price");
      try { localStorage.setItem(STORAGE_KEY, saved || "price"); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("✅ Copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) { toast.error("Only JPG, JPEG or PNG"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setFile(f);
    const r = new FileReader();
    r.onloadend = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const clearFile = () => { setFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const submit = async () => {
    if (!file || !user) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("payments")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1);
      if (existing && existing.length > 0) {
        toast.error("You already have a pending payment under review.");
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        navigate(`/payment-review?id=${existing[0].id}`, { replace: true });
        return;
      }
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      const { data: inserted, error: insErr } = await supabase.from("payments")
        .insert({ user_id: user.id, amount: price, receipt_url: urlData.publicUrl })
        .select("id").single();
      if (insErr) throw insErr;
      toast.success("Payment proof submitted!");
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      navigate(`/payment-review?id=${inserted.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceed = () => {
    if (!username.trim()) { toast.error("Please enter your username"); return; }
    setStep("notice");
  };

  const linkDisabled = !transferLink.trim();
  const stepOrder: Step[] = ["price", "notice", "account"];
  const currentIndex = step === "loading" ? -1 : stepOrder.indexOf(step);

  const handleBack = () => {
    if (step === "loading") return;
    if (step === "price") navigate(-1);
    else if (step === "notice") setStep("price");
    else if (step === "account") setStep("notice");
  };

  return (
    <div className="relative min-h-screen bg-background pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-md mx-auto px-4 pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handleBack}
            disabled={step === "loading"}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-secondary/50 disabled:opacity-40"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-cta)" }}>
            <ShoppingCart className="w-5 h-5 text-background" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground tracking-tight">Buy Withdrawal Code</p>
            <p className="text-[10px] text-muted-foreground">
              {step === "loading" && "Preparing your purchase"}
              {step === "price" && "Confirm your details"}
              {step === "notice" && "Read carefully before continuing"}
              {step === "account" && "Send the exact amount"}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        {step !== "loading" && (
          <div className="flex items-center gap-1.5 px-1">
            {stepOrder.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${currentIndex >= i ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-[55vh] flex flex-col items-center justify-center gap-5"
            >
              <div className="relative w-24 h-24">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/25"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-4 rounded-full bg-primary/15 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Loading payment details...</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          ) : step === "price" ? (
            <motion.div
              key="price"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="glass-card rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "var(--gradient-cta)" }}>
                  <ShoppingCart className="w-6 h-6 text-background" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">Code Price</p>
                <p className="text-4xl font-extrabold text-primary tracking-tight">₦{price.toLocaleString()}</p>
                <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed px-2">
                  Purchase a withdrawal code to unlock fund withdrawals from your wallet.
                </p>
              </div>

              <div className="glass-card rounded-2xl p-5 space-y-3">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] block">Username</label>
                <div className="inner-card flex items-center gap-3 rounded-xl px-3 h-11">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    className="flex-1 bg-transparent border-0 outline-none text-sm font-semibold text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <button
                  onClick={handleProceed}
                  className="btn-cta w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  Proceed to Payment <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : step === "notice" ? (
            <motion.div
              key="notice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="glass-card rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-base font-bold text-foreground">Important Payment Notice</p>
              </div>

              <ul className="space-y-3 pl-1">
                <li className="flex gap-2.5 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 mt-2 shrink-0" />
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Transfer the <span className="font-bold text-foreground">exact amount</span> shown on this page.
                  </p>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 mt-2 shrink-0" />
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Upload a clear <span className="font-bold text-foreground">payment screenshot</span> immediately after transfer.
                  </p>
                </li>
              </ul>

              <div className="rounded-xl p-4 flex gap-3 items-start border border-destructive/40 bg-destructive/10">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-destructive">Avoid using Opay bank.</span>{" "}
                  Due to temporary network issues from Opay servers, payments made with Opay may not be confirmed. Please use{" "}
                  <span className="font-bold text-foreground">any other Nigerian bank</span> for instant confirmation.
                </p>
              </div>

              <ul className="space-y-3">
                <li className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full border border-primary/50 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Payments made with other banks are confirmed within minutes.
                  </p>
                </li>
                <li className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full border border-destructive/50 bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-destructive" />
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Do not dispute your payment under any circumstances — disputes delay confirmation.
                  </p>
                </li>
              </ul>

              <button
                onClick={() => setStep("account")}
                className="w-full h-12 rounded-xl text-sm font-bold text-white bg-destructive hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/30"
              >
                I Understand
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Payment Instructions Card */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">Payment Instructions</p>
                  <span className="text-[12px] font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full">₦{price.toLocaleString()}</span>
                </div>
                <p className="text-[13px] text-foreground mb-4">
                  Transfer <span className="font-bold text-primary">₦{price.toLocaleString()}</span> to the account below:
                </p>
                {instructions && (
                  <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">{instructions}</p>
                )}
                <div className="space-y-2.5 mb-4">
                  {[
                    { icon: Landmark, label: "BANK", value: bank, key: "bank" },
                    { icon: CreditCard, label: "ACCOUNT NUMBER", value: accountNumber, key: "acct", mono: true },
                    { icon: User, label: "ACCOUNT NAME", value: accountName, key: "name" },
                  ].map(({ icon: Icon, label, value, key, mono }) => (
                    <div key={key} className="inner-card flex items-center gap-3 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">{label}</p>
                        <p className={`text-sm font-bold text-foreground truncate ${mono ? "font-mono-app tracking-wide" : ""}`}>{value}</p>
                      </div>
                      <button onClick={() => copy(String(value), key)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                        {copied === key ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
                {!linkDisabled && (
                  <a href={transferLink} target="_blank" rel="noopener noreferrer" className="btn-cta w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 mb-3">
                    <ExternalLink className="w-4 h-4" /> Pay with Transfer Link
                  </a>
                )}
                {username && (
                  <div className="inner-card flex items-center gap-2 rounded-xl px-3 h-10">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-[12px] text-muted-foreground">
                      Purchasing as: <span className="font-bold text-foreground">{username}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* After Payment / Upload Card */}
              <div className="glass-card rounded-2xl p-5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">After Payment</p>
                <p className="text-[13px] text-foreground mb-4">Upload your payment receipt below</p>

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={onFile} />
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden mb-3 border border-primary/40">
                    <img src={preview} alt="Receipt preview" className="w-full max-h-64 object-contain bg-black/40" />
                    <button onClick={clearFile} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl p-7 flex flex-col items-center gap-2 mb-3 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Tap to upload receipt</p>
                    <p className="text-[11px] text-muted-foreground">JPG, PNG · Max 5MB</p>
                  </button>
                )}
                {preview && (
                  <button onClick={() => fileInputRef.current?.click()} className="glass-card w-full h-9 rounded-lg text-[11px] font-bold text-primary mb-3">
                    Replace image
                  </button>
                )}
                <button
                  onClick={submit}
                  disabled={!file || submitting}
                  className={`w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${file && !submitting ? "btn-cta" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}
                >
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>) : (<><Shield className="w-4 h-4" /> Submit Payment Proof</>)}
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-3">
                  Your payment will be submitted for review. Your withdrawal code activates automatically after approval.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default BuyCode;
