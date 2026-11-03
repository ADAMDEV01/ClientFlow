import { describe, expect, it } from "vitest";
import { actionFailure, actionSuccess } from "@/server/action-result";
describe("action result helpers", () => {
 it("returns a typed success result", () => { expect(actionSuccess({ id: "project_1" })).toEqual({ ok: true, data: { id: "project_1" } }); });
 it("returns a typed failure result", () => { expect(actionFailure("FORBIDDEN", "Access denied")).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Access denied" } }); });
});
