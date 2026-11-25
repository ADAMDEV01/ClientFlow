import argon2 from "argon2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCredentialsPassword } from "@/lib/credential-password";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("credential password verification", () => {
  it("runs an Argon2id verification for an unknown email", async () => {
    const verify = vi.spyOn(argon2, "verify").mockResolvedValue(false);

    await expect(verifyCredentialsPassword("submitted-password", null)).resolves.toBe(
      false,
    );

    expect(verify).toHaveBeenCalledTimes(1);
    const [candidateHash, password] = verify.mock.calls[0];
    expect(candidateHash).toMatch(/^\$argon2id\$/);
    expect(password).toBe("submitted-password");
  });

  it("accepts only a password matching the stored account hash", async () => {
    const verify = vi.spyOn(argon2, "verify").mockResolvedValue(true);

    await expect(
      verifyCredentialsPassword("submitted-password", "$argon2id$stored-account-hash"),
    ).resolves.toBe(true);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toBe("$argon2id$stored-account-hash");
  });

  it("rejects an incorrect password for an existing account", async () => {
    vi.spyOn(argon2, "verify").mockResolvedValue(false);

    await expect(
      verifyCredentialsPassword("wrong-password", "$argon2id$stored-account-hash"),
    ).resolves.toBe(false);
  });
});
