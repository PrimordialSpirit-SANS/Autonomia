export interface AutonomiaErrorOptions {
  status?: number;
  type?: string;
  code?: string;
  param?: string | null;
  retryAfter?: number | null;
  expose?: boolean;
}

export class AutonomiaError extends Error {
  status: number;
  type: string;
  code: string;
  param: string | null;
  retryAfter: number | null;
  expose: boolean;
  requestId?: string;

  constructor(
    message: string,
    {
      status = 500,
      type = "server_error",
      code = "internal_error",
      param = null,
      retryAfter = null,
      expose = true,
    }: AutonomiaErrorOptions = {},
  ) {
    super(message);
    this.name = "AutonomiaError";
    this.status = status;
    this.type = type;
    this.code = code;
    this.param = param;
    this.retryAfter = retryAfter;
    this.expose = expose;
  }
}

export function openAiErrorBody(error: unknown) {
  const safe =
    error instanceof AutonomiaError
      ? error
      : new AutonomiaError("Autonomia could not complete the request.", { expose: false });
  return {
    error: {
      message: safe.expose ? safe.message : "Autonomia could not complete the request.",
      type: safe.type,
      param: safe.param ?? null,
      code: safe.code,
    },
  };
}

export function invalidRequest(message: string, param: string | null = null, code = "invalid_request") {
  return new AutonomiaError(message, {
    status: 400,
    type: "invalid_request_error",
    code,
    param,
  });
}
