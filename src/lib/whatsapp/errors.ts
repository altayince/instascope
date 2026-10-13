export type WhatsAppErrorCode =
  | "selection"
  | "file-type"
  | "limit"
  | "format"
  | "timestamp"
  | "empty"
  | "system-only"
  | "encoding"
  | "zip-invalid"
  | "zip-unsupported"
  | "zip-ambiguous"
  | "zip-missing-chat"
  | "zip-integrity"
  | "worker"
  | "timeout"
  | "cancelled"
  | "read";

/** Error copy is static and never includes uploaded content or filenames. */
export class WhatsAppImportError extends Error {
  constructor(
    public readonly code: WhatsAppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WhatsAppImportError";
  }
}
