import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

export const config = {
  port: process.env.PORT,
  env: process.env.NODE_ENV,
  //Oracle DB
  dbSidOracle: process.env.DB_SID_ORACLE,
  dbHostOracle: process.env.DB_HOST_ORACLE,
  dbPortOracle: process.env.DB_PORT_ORACLE,
  oracleClient: process.env.ORACLE_CLIENT,
  dbUserOracle: process.env.DB_USER_ORACLE,
  dbPasswordOracle: process.env.DB_PASSWORD_ORACLE,
  //Postgresql DB
  dbSidPostgresql: process.env.DB_SID_POSTGRESQL,
  dbHostPostgresql: process.env.DB_HOST_POSTGRESQL,
  dbPortPostgresql: process.env.DB_PORT_POSTGRESQL,
  dbUserPostgresql: process.env.DB_USER_POSTGRESQL,
  dbPasswordPostgresql: process.env.DB_PASSWORD_POSTGRESQL,
};
