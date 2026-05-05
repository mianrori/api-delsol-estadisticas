import { constante } from "../../helpers/constantes.helper.js";
import { pool } from "../postgresql/connection.postgresql.database.js";

export const getStateFacturas = async (numero) => {
  let dbConnection;

  try {
    dbConnection = await pool.connect();

    const { rows } = await dbConnection.query(
      `SELECT
	A.ID,
	A.ESTADO COD_ESTADO_GENERACION,
	B.DESCRIPCION ESTADO_GENERACION,
	LOWER(COALESCE(A.ESTADO_SIFEN, 'pendiente')) ESTADO_SIFEN
FROM
	DE A
	INNER JOIN ESTADO_DE B ON B.ID = A.ESTADO
WHERE
	A.TIPO_DE = $1
	AND A.NUMERO = $2`,
      [constante.FACTURA, numero],
    );

    console.log("Resultado de getStateFacturas:", rows);
    return rows[0] || null;
  } catch (error) {
    console.error("Error en getStateFacturas", error);
    throw new Error(
      `Error en getStateFacturas: ${error.message.replace(/['"]+/g, "")}`,
    );
  } finally {
    if (dbConnection) {
      dbConnection.release();
    }
  }
};

export const getLogStateGenerationFactura = async (id) => {
  let dbConnection;

  try {
    dbConnection = await pool.connect();

    const { rows } = await dbConnection.query(
      `SELECT
	TO_CHAR(A.FECHA, 'dd/mm/yyyy hh24:mi:ss') FECHA,
	A.MENSAJE LOG
FROM
	LOG_DE A
WHERE
	A.DE = $1
	AND A.TIPO = 'error'
ORDER BY
	A.ID DESC
LIMIT
	10`,
      [id],
    );

    return rows || null;
  } catch (error) {
    console.error("Error en getLogStateGenerationFactura", error);
    throw new Error(
      `Error en getLogStateGenerationFactura: ${error.message.replace(/['"]+/g, "")}`,
    );
  } finally {
    if (dbConnection) {
      dbConnection.release();
    }
  }
};

export const getLogStateSifenFactura = async (id) => {
  let dbConnection;

  try {
    dbConnection = await pool.connect();

    const { rows } = await dbConnection.query(
      `SELECT
	TO_CHAR(E.FECHA_ENVIO, 'dd/mm/yyyy hh24:mi:ss') FECHA_ENVIO,
	TO_CHAR(E.FECHA_PROCESO, 'dd/mm/yyyy hh24:mi:ss') FECHA_PROCESO,
	C.MENSAJE LOG
FROM
	ENVIO_DE_LOTE_DET AS A
	INNER JOIN ENVIO_DE_LOTE_RES AS B ON B.ID_LOTE_DET = A.ID
	INNER JOIN SIFEN_MENSAJE C ON C.CODIGO = B.CODIGO_RESPUESTA
	INNER JOIN DE D ON D.ID = A.ID_DE
	INNER JOIN ENVIO_DE_LOTE E ON E.ID = A.ID_LOTE
WHERE
	D.ID = $1
	AND A.NRO_TRANSACCION IS NULL
ORDER BY
	A.ID DESC
LIMIT
	1`,
      [id],
    );

    return rows || null;
  } catch (error) {
    console.error("Error en getLogStateSifenFactura", error);
    throw new Error(
      `Error en getLogStateSifenFactura: ${error.message.replace(/['"]+/g, "")}`,
    );
  } finally {
    if (dbConnection) {
      dbConnection.release();
    }
  }
};
