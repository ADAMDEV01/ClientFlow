const raw = process.env.DATABASE_URL;

if (!raw) {
  throw new Error("DATABASE_URL is required for database tests.");
}

const url = new URL(raw);
const dbName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
const host = url.hostname.toLowerCase();
const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
const test = /(^|[_-])(test|integration|e2e)($|[_-])/.test(dbName);
const postgres = ["postgres:", "postgresql:"].includes(url.protocol);

if (!postgres || !local || !test) {
  throw new Error("Database tests require a dedicated local PostgreSQL test database.");
}

console.log(`Database test guard passed for ${dbName}.`);
