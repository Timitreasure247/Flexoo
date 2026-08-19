import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;

const PullToRefresh = ({ children }: { children: React.ReactNode }) => {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const dampened = Math.min(MAX_PULL, dy * 0.5);
        setPull(dampened);
      }
    };
    const onTouchEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        setTimeout(() => window.location.reload(), 400);
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing]);

  const progress = Math.min(1, pull / THRESHOLD);
  const visible = pull > 0 || refreshing;

  return (
    <>
      <div
        aria-hidden={!visible}
        className="fixed top-0 left-0 right-0 z-[100] flex items-start justify-center pointer-events-none"
        style={{
          height: refreshing ? 60 : pull,
          transition: refreshing || pull === 0 ? "height 0.25s ease" : "none",
        }}
      >
        <div
          className="mt-3 w-10 h-10 rounded-full glass-card flex items-center justify-center"
          style={{
            opacity: refreshing ? 1 : progress,
            transform: `rotate(${refreshing ? 0 : progress * 360}deg)`,
          }}
        >
          <RefreshCw
            className={`w-5 h-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          />
        </div>
      </div>
      {children}
    </>
  );
};

export default PullToRefresh;
