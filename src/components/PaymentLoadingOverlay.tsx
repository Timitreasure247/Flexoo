import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import flexooLogo from "@/assets/flexoo-logo.png";

const MESSAGES = [
  "Please wait…",
  "Preparing your payment details…",
  "Loading secure payment page…",
];

/**
 * Fullscreen fintech-style loading overlay shown between the payment notice
 * and the payment details step. Rotates status messages while a smooth
 * spinner + brand mark reassure the user.
 */
const PaymentLoadingOverlay = ({ show }: { show: boolean }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!show) {
      setIdx(0);
      return;
    }
    const t = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 900);
    return () => clearInterval(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-primary/15 blur-[110px] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center text-center px-8"
          >
            <div className="relative mb-6">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-primary/30 blur-2xl"
              />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_60px_rgba(132,204,22,0.35)] overflow-hidden">
                <img
                  src={flexooLogo}
                  alt="Flexoo"
                  className="w-14 h-14 object-contain"
                  loading="eager"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary animate-spin" strokeWidth={2.5} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-primary uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure Payment
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="text-base font-bold text-foreground min-h-[26px]"
              >
                {MESSAGES[idx]}
              </motion.p>
            </AnimatePresence>

            <p className="text-[11px] text-muted-foreground mt-2 max-w-[240px]">
              Setting up an encrypted session so you can complete your payment safely.
            </p>

            <div className="mt-6 w-56 h-1 rounded-full bg-primary/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: "5%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.4, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaymentLoadingOverlay;
