import pg from "pg";
import { config } from "../../../config.js";

const Pool = pg.Pool;

export const pool = new Pool({
  user: config.dbUserPostgresql,
  host: config.dbHostPostgresql,
  database: config.dbSidPostgresql,
  password: config.dbPasswordPostgresql,
  port: config.dbPortPostgresql,
});

pool.on("connect", () => {
  console.info(
    `Conectando...(Conectado a Db SIFEN en ${config.dbSidPostgresql}).`,
  );
});

pool.on("error", (err) => {
  console.error("Error conectando a Db SIFEN:", err);
  process.exit(-1);
});
