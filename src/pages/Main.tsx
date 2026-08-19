import { useState, useEffect, useRef, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "framer-motion";
import {
  Wallet,
  Eye,
  EyeOff,
  ArrowDownToLine,
  Bell,
  LogOut,
  Users,
  Copy,
  CheckCircle,
  Share2,
  User,
  ShoppingCart,
  TrendingUp,
  Clock,
  Headphones,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import flexooLogo from "@/assets/flexoo-logo.png";
import promoBanner1 from "@/assets/promo-banner-1.png";
import promoBanner2 from "@/assets/promo-banner-2.png";
import promoBanner3 from "@/assets/promo-banner-3.png";
import promoBanner4 from "@/assets/promo-banner-4.png";
import promoBanner5 from "@/assets/promo-banner-5.png";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const banners: { image: string; alt: string; path: string }[] = [
  { image: promoBanner1, alt: "Refer & Earn", path: "/referral-hub" },
  { image: promoBanner2, alt: "Welcome Bonus", path: "/earn-more" },
  { image: promoBanner3, alt: "Daily Bonus", path: "/daily-tasks" },
  { image: promoBanner4, alt: "Investment Plan", path: "/buy-code" },
  { image: promoBanner5, alt: "Withdrawal", path: "/withdraw" },
];

const Main = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };
  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const autoplayRef = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", duration: 25, dragFree: false },
    [autoplayRef.current]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentBanner(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);
  const [profile, setProfile] = useState<{ id: string; referral_code: string; bonus_balance: number; full_name: string; username: string } | null>(null);
  const [refCount, setRefCount] = useState(0);
  const [refEarned, setRefEarned] = useState(0);

  useEffect(() => {
    if (!user) return;
    let profileId: string | null = null;

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, referral_code, bonus_balance, full_name, username")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data);
        profileId = data.id;
        loadReferrals(data.id);
        subscribeAll(data.id);
      }
    };

    const loadReferrals = async (pid: string) => {
      const { data } = await supabase
        .from("referrals")
        .select("reward_amount")
        .eq("referrer_profile_id", pid);
      const rows = data ?? [];
      setRefCount(rows.length);
      setRefEarned(rows.reduce((s, r: any) => s + Number(r.reward_amount || 0), 0));
    };

    let profileChan: any, refChan: any;
    const subscribeAll = (pid: string) => {
      profileChan = supabase
        .channel(`profile-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row: any = payload.new;
            setProfile((p) => (p ? { ...p, bonus_balance: row.bonus_balance, full_name: row.full_name, username: row.username } : p));
          }
        )
        .subscribe();
      refChan = supabase
        .channel(`refs-${pid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "referrals", filter: `referrer_profile_id=eq.${pid}` },
          () => loadReferrals(pid)
        )
        .subscribe();
    };

    loadProfile();
    return () => {
      if (profileChan) supabase.removeChannel(profileChan);
      if (refChan) supabase.removeChannel(refChan);
    };
  }, [user]);


  // Auto-redirect to Withdrawal Approved when a newly-approved withdrawal exists
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .not("withdrawal_code", "is", null)
        .order("approved_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.id) return;
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem("wd_seen") || "[]"); } catch { /* ignore */ }
      if (!seen.includes(data.id)) {
        navigate(`/withdrawal-approved?id=${data.id}`, { replace: true });
      }
    };
    check();

    const channel = supabase
      .channel(`wd-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row: any = payload.new;
          if (row?.status === "approved" && row?.withdrawal_code) {
            navigate(`/withdrawal-approved?id=${row.id}`, { replace: true });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  const referralCode = profile?.referral_code || "Loading...";
  const balanceDisplay = profile ? `₦${profile.bonus_balance.toLocaleString()}` : "₦0";

  // Preload the next banner image so slide transitions stay smooth
  useEffect(() => {
    const nextIndex = (currentBanner + 1) % banners.length;
    const img = new Image();
    img.src = banners[nextIndex].image;
  }, [currentBanner]);

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickActions = [
    { icon: User, label: "Profile", highlight: false, path: "/profile" },
    { icon: ShoppingCart, label: "Buy Code", highlight: false, path: "/buy-code" },
    { icon: TrendingUp, label: "Earn More", highlight: true, path: "/earn-more" },
    { icon: Clock, label: "History", highlight: false, path: "/history" },
    { icon: Headphones, label: "Support", highlight: false, path: "/support" },
    { icon: MessageCircle, label: "Channel", highlight: false, path: "/channel" },
  ];

  const stats = [
    { icon: Sparkles, label: "TOTAL EARNED", value: balanceDisplay },
    { icon: Users, label: "REFERRALS", value: refCount.toLocaleString() },
    { icon: Sparkles, label: "REF EARNED", value: `₦${refEarned.toLocaleString()}` },
  ];


  return (
    <div className="relative min-h-screen bg-background pb-10">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-main" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-main)" />
        </svg>
      </div>

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-primary/6 blur-[120px] pointer-events-none" />

      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 max-w-md mx-auto px-4 pt-4">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-[0_0_16px_hsla(85,80%,50%,0.08)]">
              {profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Welcome back</p>
              <p className="text-[13px] font-bold text-foreground tracking-tight">{profile?.full_name || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="glass-card w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors">
              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={handleLogout} className="glass-card w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors">
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Wallet Card */}
        <motion.div variants={item} className="glass-card rounded-xl p-4 mb-3 relative overflow-hidden">
          <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="w-3 h-3 text-primary" />
              </div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Wallet Balance</p>
              <button onClick={() => setShowBalance(!showBalance)} className="ml-auto p-1 rounded-md hover:bg-muted/30 transition-colors">
                {showBalance ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>

            <p className="text-[26px] font-extrabold text-primary mb-0.5 tracking-tight leading-none">
              {showBalance ? balanceDisplay : "••••••"}
            </p>
            <p className="text-[9px] text-muted-foreground mb-3 font-medium">
              {showBalance ? "Available for withdrawal" : "Balance hidden"}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_hsla(85,80%,50%,0.5)]" />
                  <span className="text-[9px] font-semibold text-muted-foreground">Active</span>
                </div>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-[9px] font-mono-app text-muted-foreground">ID: 0b342d98</span>
              </div>
              <button
                onClick={() => navigate("/withdraw")}
                className="btn-cta h-8 px-4 rounded-lg text-[11px] font-bold flex items-center gap-1"
              >
                <ArrowDownToLine className="w-3 h-3" /> Withdraw
              </button>
            </div>
          </div>
        </motion.div>

        {/* Referral Code Card */}
        <motion.div variants={item} className="glass-card rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary flex items-center gap-1 mb-0.5">
                🎯 Refer & Earn ₦7,000
              </p>
              <p className="text-[10px] text-muted-foreground">
                Your code: <span className="font-mono-app font-bold text-foreground tracking-wider">{referralCode}</span>
              </p>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-all hover:bg-muted/40"
              style={{ color: copied ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
            >
              {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const msg = `🎉 Join Flexoo and earn ₦170,000 bonus! Use my referral code *${referralCode}* to sign up:\n${window.location.origin}/signup?ref=${referralCode}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold py-2 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button
              onClick={() => {
                const msg = `Join Flexoo and earn ₦170,000 bonus! Use my code ${referralCode}: ${window.location.origin}/signup?ref=${referralCode}`;
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/signup?ref=${referralCode}`)}&quote=${encodeURIComponent(msg)}`, "_blank", "width=600,height=400");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold py-2 rounded-lg bg-[#1877F2]/15 text-[#1877F2] hover:bg-[#1877F2]/25 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </button>
            <button
              onClick={() => {
                const msg = `Join Flexoo and earn ₦170,000 bonus! Use my code ${referralCode}: ${window.location.origin}/signup?ref=${referralCode}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, "_blank", "width=600,height=400");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold py-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X
            </button>
            <button
              onClick={() => {
                const shareData = {
                  title: "Join Flexoo!",
                  text: `Sign up on Flexoo with my referral code ${referralCode} and earn ₦170,000 bonus!`,
                  url: `${window.location.origin}/signup?ref=${referralCode}`,
                };
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareData.url);
                  toast.success("Referral link copied!");
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              More
            </button>
          </div>
        </motion.div>

        {/* Promo Banner Carousel */}
        <motion.div variants={item} className="mb-4">
          <div
            className="relative rounded-lg overflow-hidden border border-border/50 h-[100px] cursor-grab active:cursor-grabbing"
            ref={emblaRef}
          >
            <div className="flex h-full touch-pan-y">
              {banners.map((b, i) => (
                <div
                  key={i}
                  className="relative h-full flex-[0_0_100%] min-w-0"
                  onClick={() => navigate(b.path)}
                  role="button"
                  aria-label={b.alt}
                >
                  <img
                    src={b.image}
                    alt={b.alt}
                    className="w-full h-full object-cover pointer-events-none select-none"
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={i === currentBanner ? "high" : "low"}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            {banners.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => scrollTo(i)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentBanner ? "bg-primary w-4" : "bg-muted-foreground/25 w-1"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={item} className="grid grid-cols-3 gap-2 mb-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="inner-card rounded-lg p-2.5">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                  <Icon className="w-2 h-2 text-primary" />
                </div>
                <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
              </div>
              <p className="text-[13px] font-extrabold text-foreground tracking-tight">{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item}>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Quick Actions</p>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map(({ icon: Icon, label, highlight, path }) => (
              <button
                key={label}
                onClick={() => path && navigate(path)}
                className="inner-card flex flex-col items-center gap-2 py-3 rounded-lg transition-all duration-200 hover:border-primary/20 hover:shadow-[0_0_15px_hsla(85,80%,50%,0.05)] active:scale-[0.97]"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-200"
                  style={highlight
                    ? { background: "var(--gradient-cta)", boxShadow: "0 3px 12px hsla(85, 80%, 50%, 0.2)" }
                    : { background: "hsla(150, 30%, 18%, 0.8)" }
                  }
                >
                  <Icon className={`w-4 h-4 ${highlight ? "text-background" : "text-primary"}`} />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Main;
