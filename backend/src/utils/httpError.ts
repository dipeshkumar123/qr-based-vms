export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  toJSON() {
    return {
      status: this.status,
      message: this.message,
      ...(this.code && { code: this.code }),
    };
  }
}
