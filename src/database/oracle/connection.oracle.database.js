import { config } from "../../../config.js";
import oracledb from "oracledb";

export const connect = async (username, password) => {
  try {
    oracledb.initOracleClient({ libDir: config.oracleClient });
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    console.info(
      `Conectando a ${config.dbHostOracle}:${config.dbPortOracle}/${config.dbSidOracle}.`,
    );
    const connection = await oracledb.getConnection({
      username: username,
      password: password,
      connectString: `${config.dbHostOracle}:${config.dbPortOracle}/${config.dbSidOracle}`,
    });
    console.info(
      `Conectado a ${config.dbHostOracle}:${config.dbPortOracle}/${config.dbSidOracle}`,
    );
    return connection;
  } catch (error) {
    console.error(
      `Error conectando a ${config.dbHostOracle}:${config.dbPortOracle}/${config.dbSidOracle}: ${error}`,
    );
    throw error;
  }
};
