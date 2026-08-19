import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "flexoo_install_dismissed_at";
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error iOS Safari
  window.navigator.standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const recentlyDismissed = () => {
  const v = localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = parseInt(v, 10);
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (isIOS()) {
      const t = setTimeout(() => setShowIOS(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
    setShowIOS(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show && !showIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] max-w-md mx-auto">
      <div
        className="glass-card rounded-2xl p-4 flex items-start gap-3 shadow-2xl"
        style={{ background: "var(--glass-bg-elevated)" }}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Flexoo</p>
          {showIOS ? (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tap <Share className="w-3 h-3 inline mx-0.5" /> Share, then{" "}
              <span className="text-foreground font-medium">"Add to Home Screen"</span>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Add to your home screen for faster access.
            </p>
          )}
          {show && !showIOS && (
            <button
              onClick={install}
              className="btn-cta mt-3 h-9 px-4 rounded-lg text-xs"
            >
              Install App
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
