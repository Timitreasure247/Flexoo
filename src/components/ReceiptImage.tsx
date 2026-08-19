import { useEffect, useState } from "react";
import { getReceiptSignedUrl } from "@/lib/receiptUrl";
import { Loader2, ImageOff } from "lucide-react";

interface Props {
  receiptUrl: string | null | undefined;
  alt?: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders a private-storage receipt image via a signed URL.
 * Shows a spinner while resolving and a helpful error tile on failure.
 */
export const ReceiptImage = ({ receiptUrl, alt = "Payment receipt", className = "", imgClassName = "" }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setUrl(null);
    if (!receiptUrl) {
      setStatus("error");
      return;
    }
    getReceiptSignedUrl(receiptUrl).then((signed) => {
      if (cancelled) return;
      if (!signed) {
        setStatus("error");
        return;
      }
      setUrl(signed);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [receiptUrl]);

  if (status === "loading") {
    return (
      <div className={`flex items-center justify-center bg-secondary/50 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error" || !url) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-destructive/5 text-destructive text-[10px] px-2 text-center ${className}`}>
        <ImageOff className="w-4 h-4" />
        <span>Receipt unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={imgClassName}
      onError={() => setStatus("error")}
    />
  );
};
