import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import flexooLogo from "@/assets/flexoo-logo.png";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const particles = [
  { top: "8%", left: "15%", delay: 0 },
  { top: "12%", right: "10%", delay: 1.5 },
  { top: "45%", right: "5%", delay: 3 },
  { top: "70%", left: "25%", delay: 2 },
  { top: "60%", right: "18%", delay: 4 },
  { top: "30%", left: "8%", delay: 1 },
];

const Index = () => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background network/grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Curved network lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path d="M0 450 Q 360 300, 720 450 T 1440 450" fill="none" stroke="hsl(150, 30%, 30%)" strokeWidth="1" />
          <path d="M0 350 Q 400 500, 800 350 T 1440 380" fill="none" stroke="hsl(150, 30%, 25%)" strokeWidth="0.8" />
          <ellipse cx="720" cy="420" rx="350" ry="200" fill="none" stroke="hsl(150, 25%, 20%)" strokeWidth="0.6" opacity="0.5" />
          <ellipse cx="720" cy="420" rx="500" ry="280" fill="none" stroke="hsl(150, 25%, 18%)" strokeWidth="0.4" opacity="0.3" />
        </svg>
      </div>

      {/* Floating green particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle absolute w-1.5 h-1.5 rounded-full bg-primary/60"
          style={{
            top: p.top,
            left: p.left,
            right: p.right,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Central glow */}
      <div className="bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />

      {/* Main content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center px-4 max-w-2xl mx-auto"
      >
        {/* Logo */}
        <motion.div variants={item} className="mb-6">
          <img src={flexooLogo} alt="Flexoo Logo" className="w-16 h-16 object-contain" />
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={item}
          className="text-5xl md:text-6xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, hsl(140, 70%, 50%), hsl(85, 80%, 55%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textWrap: "balance",
          }}
        >
          Flexoo
        </motion.h1>

        {/* Subtitle */}
        <motion.p variants={item} className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-md">
          The future of banking. Seamless, secure, and built for you.
        </motion.p>

        {/* Feature badges */}
        <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <FeatureBadge icon={<Zap className="w-4 h-4 text-primary" />} label="Instant Transfers" />
          <FeatureBadge icon={<Shield className="w-4 h-4 text-primary" />} label="Bank-Grade Security" />
        </motion.div>
        <motion.div variants={item} className="mt-3 flex justify-center">
          <FeatureBadge icon={<Sparkles className="w-4 h-4 text-primary" />} label="Smart Earnings" />
        </motion.div>

        {/* CTA Card */}
        <motion.div
          variants={item}
          className="mt-10 w-full max-w-sm rounded-2xl p-6"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), var(--glow-green)",
          }}
        >
          <Link
            to="/signup"
            className="w-full h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg cursor-pointer no-underline"
            style={{
              background: "var(--gradient-cta)",
              color: "hsl(150, 30%, 6%)",
            }}
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>

        {/* Trust bar */}
        <motion.div variants={item} className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary/70" />
          Secure • Fast • Trusted
        </motion.div>
      </motion.div>
    </div>
  );
};

const FeatureBadge = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div
    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-foreground/80"
    style={{
      background: "hsla(150, 20%, 12%, 0.5)",
      border: "1px solid hsla(150, 15%, 22%, 0.4)",
    }}
  >
    {icon}
    {label}
  </div>
);

export default Index;
