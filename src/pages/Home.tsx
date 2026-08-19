import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import flexooLogo from "@/assets/flexoo-logo.png";

const slides = [
  {
    title: "Welcome to Flexoo! 🎉",
    badge: "₦170,000 Welcome Bonus",
    description:
      "Your account is set up and ready to go. You've received a ₦170,000 welcome bonus in your wallet!",
  },
  {
    title: "Start Earning Today 💰",
    badge: "Daily Tasks Available",
    description:
      "Complete simple tasks daily to earn rewards. The more you do, the more you earn!",
  },
  {
    title: "Invite & Earn More 🤝",
    badge: "Referral Bonus",
    description:
      "Share your referral link with friends and earn bonus rewards for every successful signup!",
  },
  {
    title: "Withdraw Anytime 🏦",
    badge: "Instant Withdrawals",
    description:
      "Cash out your earnings directly to your bank account with fast and secure withdrawals.",
  },
  {
    title: "You're All Set! 🚀",
    badge: "Let's Go",
    description:
      "Everything is ready. Tap below to explore your dashboard and start your journey with Flexoo!",
  },
];

const Home = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else navigate("/main");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-home" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-home)" />
        </svg>
      </div>

      {/* Central glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />

      {/* Skip */}
      <button
        onClick={() => navigate("/main")}
        className="absolute top-5 right-5 z-20 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Skip
      </button>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm rounded-2xl p-6 flex flex-col items-center text-center"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "var(--gradient-cta)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <Sparkles className="w-8 h-8" style={{ color: "hsl(150, 30%, 6%)" }} />
        </div>

        {/* Slide content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <h1 className="text-xl font-bold text-foreground mb-4">
              {slides[current].title}
            </h1>

            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{
                background: "var(--gradient-cta)",
                color: "hsl(150, 30%, 6%)",
              }}
            >
              {slides[current].badge}
            </span>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mb-6">
              {slides[current].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={next}
          className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg"
          style={{
            background: "var(--gradient-cta)",
            color: "hsl(150, 30%, 6%)",
          }}
        >
          {current < slides.length - 1 ? "Next" : "Get Started"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

export default Home;
