"use client";
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "./backup-file-picker.css";

export type BackupFilePickerHandle = { reset: () => void };

export const BackupFilePicker = forwardRef<
  BackupFilePickerHandle,
  {
    label: string;
    disabled?: boolean;
    onSelect: (file: File | null) => void | Promise<void>;
  }
>(function BackupFilePicker({ label, disabled = false, onSelect }, ref) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  useImperativeHandle(ref, () => ({
    reset() {
      if (input.current) input.current.value = "";
      setFilename("");
    },
  }));
  return (
    <div className="backup-file-picker" data-disabled={disabled}>
      <input
        id={`${id}-input`}
        ref={input}
        className="backup-file-input"
        type="file"
        accept=".json,application/json"
        aria-label={label}
        aria-describedby={`${id}-filename`}
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          setFilename(file?.name ?? "");
          void onSelect(file);
        }}
      />
      <label
        className="button secondary backup-file-trigger"
        htmlFor={`${id}-input`}
      >
        Choose backup file
      </label>
      <p
        id={`${id}-filename`}
        className="backup-file-name"
        aria-live="polite"
        title={filename || undefined}
      >
        {filename || "No file selected"}
      </p>
    </div>
  );
});
