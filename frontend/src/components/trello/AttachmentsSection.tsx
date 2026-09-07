import { useRef, useState } from "react";
import { Download, ImagePlus, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import {
  useCardDetail,
  useDeleteAttachment,
  useUpdateCard,
  useUploadAttachment,
} from "@/lib/trello-queries";
import { AttachmentImage } from "./AttachmentImage";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime.toLowerCase());
}

async function download(attachmentId: string, fileName: string, onError: (e: unknown) => void) {
  try {
    const url = await api.blobUrl(`/attachments/${attachmentId}/file`);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (e) {
    onError(e);
  }
}

export function AttachmentsSection({ boardId, cardId, onError }: { boardId: string; cardId: string; onError: (e: unknown) => void }) {
  const { data: card } = useCardDetail(cardId);
  const upload = useUploadAttachment(boardId, cardId);
  const remove = useDeleteAttachment(boardId, cardId);
  const updateCard = useUpdateCard(boardId, cardId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await upload.mutateAsync({ file });
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        attachments{card && card.attachments.length > 0 ? ` · ${card.attachments.length}` : ""}
      </p>
      <div className="flex flex-col gap-2">
        {card?.attachments.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2">
            {isImage(a.mime) ? (
              <AttachmentImage attachmentId={a.id} alt={a.fileName} className="size-10 shrink-0" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                <Paperclip className="size-4 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{a.fileName}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatBytes(a.size)}{card.coverAttachmentId === a.id ? " · cover" : ""}
              </p>
            </div>
            {isImage(a.mime) && card.coverAttachmentId !== a.id ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-muted-foreground"
                onClick={() => updateCard.mutate({ coverAttachmentId: a.id }, { onError: (e) => onError(e) })}
              >
                <ImagePlus className="size-3.5" />
                Cover
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Download ${a.fileName}`} onClick={() => download(a.id, a.fileName, onError)}>
              <Download className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${a.fileName}`}
              onClick={() => remove.mutate({ attachmentId: a.id }, { onError: (e) => onError(e) })}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            aria-label="Attach a file"
          />
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Paperclip className="size-4" />
            {uploading ? "Uploading…" : "Attach a file"}
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">Images preview inline · 10 MB max · scripts blocked.</p>
        </div>
      </div>
    </section>
  );
}
