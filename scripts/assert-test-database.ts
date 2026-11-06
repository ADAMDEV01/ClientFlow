/**
 * Refuse to run destructive/integration suites against a production or shared database.
 * The test suites must use a dedicated PostgreSQL database on the local machine/CI runner.
 */
const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  console.error("Test database safety check failed: DATABASE_URL is not set.");
  process.exit(1);
}

let databaseUrl: URL;
try {
  databaseUrl = new URL(rawUrl);
} catch {
  console.error("Test database safety check failed: DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const host = databaseUrl.hostname.toLowerCase();
const databaseName = decodeURIComponent(
  databaseUrl.pathname.slice(1),
).toLowerCase();
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const dedicatedTestDatabase =
  /(?:^|[_-])(test|integration|e2e)(?:$|[_-])/.test(databaseName);

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  console.error("Test database safety check failed: only PostgreSQL test databases are supported.");
  process.exit(1);
}

if (!localHosts.has(host) || !dedicatedTestDatabase) {
  console.error(
    "Test database safety check failed. Use a dedicated local database named with _test, _integration, or _e2e on localhost/127.0.0.1. Production and shared databases are blocked.",
  );
  process.exit(1);
}

console.log(`Test database safety check passed (local database: ${databaseName}).`);
