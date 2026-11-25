import argon2 from "argon2";

// Keep unknown-email login attempts on the same expensive Argon2id verification
// path as known users. This valid hash is not an application credential.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$Az7Tujw2El+hbx/snBZ5Ag$x5mB81OGMs6T3T6ADFYGPTY6cx2DQ563pfF8I48up3s";

export async function verifyCredentialsPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  const matches = await argon2.verify(storedHash ?? DUMMY_PASSWORD_HASH, password);
  return storedHash !== null && matches;
}
