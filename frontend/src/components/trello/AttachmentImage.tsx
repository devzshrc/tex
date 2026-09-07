import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Authed image preview: cookies don't ride cross-origin <img>, so fetch a blob URL. */
export function AttachmentImage({ attachmentId, alt, className }: { attachmentId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;
    api
      .blobUrl(`/attachments/${attachmentId}/file`)
      .then((u) => {
        if (!live) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  if (failed || !url) {
    return (
      <span className={cn("flex items-center justify-center rounded bg-muted", className)}>
        <FileText className="size-4 text-muted-foreground" />
      </span>
    );
  }
  return <img src={url} alt={alt} className={cn("rounded object-cover", className)} loading="lazy" />;
}
