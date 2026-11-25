// O drizzle precisa de uma URL para ser criado; o Pool só conecta no primeiro uso.
// Nos testes unitários o banco é sempre mockado. Com RUN_DB_TESTS usa o .env real.
if (!process.env.RUN_DB_TESTS) {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";
}
