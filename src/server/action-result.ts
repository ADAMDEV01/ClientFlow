export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure(
  code: string,
  message: string,
): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export function toActionFailure(error: unknown): ActionResult<never> {
  if (error instanceof Error) {
    return actionFailure(error.name || "INTERNAL_ERROR", error.message);
  }
  return actionFailure("INTERNAL_ERROR", "Something went wrong.");
}
