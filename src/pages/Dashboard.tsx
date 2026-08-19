import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  { top: "8%", left: "12%", delay: 0 },
  { top: "15%", right: "8%", delay: 1.5 },
  { top: "50%", right: "5%", delay: 3 },
  { top: "70%", left: "20%", delay: 2 },
  { top: "60%", right: "15%", delay: 4 },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-dash" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(150, 20%, 40%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dash)" />
        </svg>
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle absolute w-1.5 h-1.5 rounded-full bg-primary/60"
          style={{ top: p.top, left: p.left, right: p.right, animationDelay: `${p.delay}s` } as React.CSSProperties}
        />
      ))}

      {/* Central glow */}
      <div className="bg-glow absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />

      {/* Decorative circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-border/30 pointer-events-none" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center max-w-md w-full"
      >
        {/* Logo */}
        <motion.div
          variants={item}
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <img src={flexooLogo} alt="Flexoo Logo" className="w-12 h-12 object-contain" />
        </motion.div>

        {/* Heading */}
        <motion.h1 variants={item} className="text-3xl font-bold text-foreground mb-3">
          Welcome to <span className="text-primary">Flexoo</span>
        </motion.h1>

        <motion.p variants={item} className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
          Join our official Telegram channel to get started with announcements, tips & exclusive offers.
        </motion.p>

        {/* Telegram Card */}
        <motion.div
          variants={item}
          className="w-full rounded-2xl p-5"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {/* Channel info */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Send className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground text-sm">Flexoo Official</p>
              <p className="text-xs text-muted-foreground">Telegram Channel</p>
            </div>
          </div>

          {/* Join button */}
          <a
            href="https://t.me/+Mg7JaPJoFNVhMTc0"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg"
            style={{
              background: "var(--gradient-cta)",
              color: "hsl(150, 30%, 6%)",
            }}
          >
            <Send className="w-4 h-4" />
            Join Channel
          </a>

          {/* Already joined section */}
          <p className="text-xs text-muted-foreground/60 mt-4 mb-3">Already joined?</p>

          <button
            onClick={() => navigate("/home")}
            className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-primary/30 text-foreground hover:bg-primary/10"
            style={{
              background: "var(--glass-bg)",
            }}
          >
            <CheckCircle className="w-4 h-4 text-primary" />
            I've Joined — Continue
          </button>
        </motion.div>

        {/* Footer note */}
        <motion.p variants={item} className="mt-6 text-xs text-muted-foreground/60">
          You must join our Telegram channel to access the platform.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Dashboard;
