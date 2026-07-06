import { useRef, useState } from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react";

export const Dropzone = ({ onFile, uploading = false, uploadedName = null, testid = "dropzone" }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files[0]) onFile(files[0]);
  };

  return (
    <div
      data-testid={testid}
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        data-testid={`${testid}-input`}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Reading your file...</p>
        </>
      ) : uploadedName ? (
        <>
          <CheckCircle2 className="h-8 w-8 text-[hsl(160,84%,28%)]" />
          <p className="text-sm font-medium">{uploadedName}</p>
          <p className="text-xs text-muted-foreground">Click or drop another file to replace it</p>
        </>
      ) : (
        <>
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF, DOCX or TXT here, or click to browse</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" /> Max 5 MB
          </p>
        </>
      )}
    </div>
  );
};
