'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  accept?: string;
  maxSizeMb?: number;
  onUpload: (file: File) => Promise<void>;
  label?: string;
  hint?: string;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error';

export function FileDropzone({
  accept = '.pdf,.doc,.docx',
  maxSizeMb = 10,
  onUpload,
  label = '拖拽文件到这里，或点击选择',
  hint,
}: FileDropzoneProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`文件过大，最大允许 ${maxSizeMb}MB`);
        setState('error');
        return;
      }

      setFileName(file.name);
      setError(null);
      setState('uploading');

      try {
        await onUpload(file);
        setState('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败，请重试');
        setState('error');
      }
    },
    [maxSizeMb, onUpload]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setState('idle');
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        state === 'dragging' && 'border-primary bg-primary/5',
        state === 'error' && 'border-destructive/50 bg-destructive/5',
        state === 'done' && 'border-emerald-500/50 bg-emerald-500/5',
        state === 'idle' && 'border-border/50 hover:border-border hover:bg-accent/20',
        state === 'uploading' && 'border-primary/50 bg-primary/5'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setState('dragging');
      }}
      onDragLeave={() => state === 'dragging' && setState('idle')}
      onDrop={handleDrop}
      onClick={() => state !== 'uploading' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {state === 'uploading' ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在上传 {fileName}...</p>
        </div>
      ) : state === 'done' ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
          <p className="text-sm text-foreground">{fileName} 上传成功</p>
          <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-xs text-primary hover:underline">
            重新上传
          </button>
        </div>
      ) : state === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <X className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-xs text-primary hover:underline">
            重试
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/40">
            <FileText className="h-3 w-3" />
            <span>支持 PDF、Word（最大 {maxSizeMb}MB）</span>
          </div>
        </div>
      )}
    </div>
  );
}
