import { pool } from "../database/postgresql/connection.postgresql.database.js";
import { connect } from "../database/oracle/connection.oracle.database.js";
import { config } from "../../config.js";
import { constante } from "../helpers/constantes.helper.js";

let dbPgConnection;

export const listenStatusSifenService = async (io) => {
  try {
    dbPgConnection = await pool.connect();

    await dbPgConnection.query("LISTEN de_estado_sifen_cambiado");
    await dbPgConnection.query("LISTEN de_estado_gen_cambiado");

    io.on("connection", async (socket) => {
      console.log("Cliente conectado:", socket.id);

      // Guardamos los filtros del cliente
      socket.data.filtrosSifen = {};

      // El frontend envía parámetros iniciales
      socket.on("dashboard:sifen:init", async (params = {}) => {
        try {
          console.log("Parámetros iniciales recibidos:", params);

          socket.data.filtrosSifen = params;

          const metricas = await obtenerMetricasSifenService(params);

          console.log(`Enviando métricas iniciales a ${socket.id}:`, metricas);

          socket.emit("dashboard:sifen", metricas);
        } catch (error) {
          console.error("Error en dashboard:sifen:init:", error);
          socket.emit("dashboard:sifen:error", {
            message: "No se pudieron obtener las métricas iniciales.",
          });
        }
      });

      // El frontend puede volver a consultar con otros filtros
      socket.on("dashboard:sifen:consultar", async (params = {}) => {
        try {
          console.log("Parámetros de consulta recibidos:", params);

          socket.data.filtrosSifen = params;

          const metricas = await obtenerMetricasSifenService(params);

          console.log(
            `Enviando métricas consultadas a ${socket.id}:`,
            metricas,
          );

          socket.emit("dashboard:sifen", metricas);
        } catch (error) {
          console.error("Error en dashboard:sifen:consultar:", error);
          socket.emit("dashboard:sifen:error", {
            message: "No se pudieron consultar las métricas.",
          });
        }
      });

      socket.on("disconnect", (reason) => {
        console.log(`Cliente desconectado: ${socket.id}. Motivo: ${reason}`);
      });
    });

    dbPgConnection.on("notification", async (msg) => {
      try {
        console.log("Evento recibido:", msg.channel, msg.payload);

        switch (msg.channel) {
          case "de_estado_sifen_cambiado":
            console.log("Procesando evento de estado Sifen cambiado...");
            await actualizarEstadoSifenOracle(msg.payload);
            break;

          case "de_estado_gen_cambiado":
            console.log("Procesando evento de estado Generación cambiado...");
            await actualizarEstadoGeneracionOracle(msg.payload);
            break;

          default:
            console.log("Evento desconocido:", msg.channel);
            return;
        }

        // Recalcular y emitir a cada socket según sus filtros
        const sockets = await io.fetchSockets();

        for (const socket of sockets) {
          try {
            const filtros = socket.data?.filtrosSifen || {};
            const metricas = await obtenerMetricasSifenService(filtros);

            console.log(
              `Enviando métricas actualizadas a ${socket.id}:`,
              metricas,
            );

            socket.emit("dashboard:sifen", metricas);
          } catch (socketError) {
            console.error(
              `Error recalculando métricas para socket ${socket.id}:`,
              socketError,
            );
          }
        }
      } catch (error) {
        console.error("Error procesando notification de PostgreSQL:", error);
      }
    });

    console.log("Escuchando eventos PostgreSQL y conexiones Socket.IO...");
  } catch (error) {
    console.error("Error en listenStatusSifenService:", error);
    throw error;
  }
};

export const actualizarEstadoSifenOracle = async (payload) => {
  let dbOracleConnection;

  try {
    const data = JSON.parse(payload);

    if (data.tipo_de === constante.FACTURA) {
      dbOracleConnection = await connect(
        config.dbUserOracle,
        config.dbPasswordOracle,
      );

      await dbOracleConnection.execute(
        `
      UPDATE vt_comprobantes_cabecera a
         SET a.estado_sifen = :estado_nuevo,
             a.fec_estado = SYSDATE,
             a.id_de=:id
       WHERE a.cdc = :cdc
      `,
        {
          estado_nuevo: data.estado_nuevo,
          cdc: data.cdc,
          id: data.id,
        },
        { autoCommit: true },
      );
    } else if (data.tipo_de === constante.NOTA_CREDITO) {
      dbOracleConnection = await connect(
        config.dbUserOracle,
        config.dbPasswordOracle,
      );

      await dbOracleConnection.execute(
        `
      UPDATE cc_notas_debcred a
         SET a.estado_sifen = :estado_nuevo,
             a.id_de=:id
       WHERE a.cdc = :cdc
      `,
        {
          estado_nuevo: data.estado_nuevo,
          cdc: data.cdc,
          id: data.id,
        },
        { autoCommit: true },
      );
    }
  } catch (err) {
    console.error("Error actualizando en actualizarEstadoSifenOracle:", err);
  } finally {
    if (dbOracleConnection) {
      try {
        await dbOracleConnection.close();
        console.info("Conexión Oracle cerrada.");
      } catch (e) {
        console.error(
          "Error cerrando conexión Oracle en actualizarEstadoSifenOracle:",
          e,
        );
      }
    }
  }
};

export const actualizarEstadoGeneracionOracle = async (payload) => {
  let dbOracleConnection;

  try {
    const data = JSON.parse(payload);

    if (data.tipo_de === constante.FACTURA) {
      dbOracleConnection = await connect(
        config.dbUserOracle,
        config.dbPasswordOracle,
      );

      await dbOracleConnection.execute(
        `
      UPDATE vt_comprobantes_cabecera a
         SET a.estado_generacion = :estado_nuevo,
             a.fec_estado = SYSDATE,
             a.id_de=:id
       WHERE (SELECT nvl(m.establecimiento, '001') || '-' ||
                               nvl(m.punto_expedicion, '001')
                          FROM talonarios m
                         WHERE m.cod_empresa = a.cod_empresa
                           AND m.tip_talonario = a.tip_comprobante
                           AND m.serie = a.ser_comprobante
                           AND a.nro_comprobante BETWEEN m.numero_inicial AND
                               m.numero_final) || '-' ||
                       lpad(a.nro_comprobante, 7, '0') = :numero
      `,
        {
          estado_nuevo: data.estado_nuevo,
          numero: data.numero,
          id: data.id,
        },
        { autoCommit: true },
      );
    } else if (data.tipo_de === constante.NOTA_CREDITO) {
      dbOracleConnection = await connect(
        config.dbUserOracle,
        config.dbPasswordOracle,
      );

      await dbOracleConnection.execute(
        `
      UPDATE cc_notas_debcred a
         SET a.estado_generacion = :estado_nuevo,
             a.id_de=:id
       WHERE (SELECT nvl(m.establecimiento, '001') || '-' ||
                               nvl(m.punto_expedicion, '001')
                          FROM talonarios m
                         WHERE m.cod_empresa = a.cod_empresa
                           AND m.tip_talonario = a.tip_comprobante
                           AND m.serie = a.ser_comprobante
                           AND a.nro_comprobante BETWEEN m.numero_inicial AND
                               m.numero_final) || '-' ||
                       lpad(a.nro_comprobante, 7, '0') = :numero
      `,
        {
          estado_nuevo: data.estado_nuevo,
          numero: data.numero,
          id: data.id,
        },
        { autoCommit: true },
      );
    }
  } catch (err) {
    console.error(
      "Error actualizando en actualizarEstadoGeneracionOracle:",
      err,
    );
  } finally {
    if (dbOracleConnection) {
      try {
        await dbOracleConnection.close();
        console.info("Conexión Oracle cerrada.");
      } catch (e) {
        console.error(
          "Error cerrando conexión Oracle en actualizarEstadoGeneracionOracle:",
          e,
        );
      }
    }
  }
};

export const obtenerMetricasSifenService = async (params) => {
  try {
    const result = await dbPgConnection.query(
      `SELECT
	--Pendientes
	COUNT(*) FILTER (
		WHERE
			ESTADO_SIFEN IS NULL
			AND ESTADO = 1
	) AS PENDIENTES,
	COUNT(*) FILTER (
		WHERE
			ESTADO_SIFEN IS NULL
			AND ESTADO = 1
			AND TIPO_DE = 1
	) AS FAC_PENDIENTES,
	COUNT(*) FILTER (
		WHERE
			ESTADO_SIFEN IS NULL
			AND ESTADO = 1
			AND TIPO_DE = 5
	) AS NOC_PENDIENTES,
	--Rechazadas
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'rechazado'
	) AS RECHAZADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'rechazado'
			AND ESTADO = 1
			AND TIPO_DE = 1
	) AS FAC_RECHAZADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'rechazado'
			AND ESTADO = 1
			AND TIPO_DE = 5
	) AS NOC_RECHAZADAS,
	--Procesando
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'procesando'
	) AS PROCESANDO,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'procesando'
			AND ESTADO = 1
			AND TIPO_DE = 1
	) AS FAC_PROCESANDO,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'procesando'
			AND ESTADO = 1
			AND TIPO_DE = 5
	) AS NOC_PROCESANDO,
	--Aprobadas
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'aprobado'
	) AS APROBADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'aprobado'
			AND ESTADO = 1
			AND TIPO_DE = 1
	) AS FAC_APROBADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'aprobado'
			AND ESTADO = 1
			AND TIPO_DE = 5
	) AS NOC_APROBADAS,
	--Inutilizadas
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'inutilizado'
	) AS INUTILIZADOS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'inutilizado'
			AND ESTADO = 1
			AND TIPO_DE = 1
	) AS FAC_INUTILIZADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'inutilizado'
			AND ESTADO = 1
			AND TIPO_DE = 5
	) AS NOC_INUTILIZADAS,
	--Canceladas
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'cancelado'
	) AS CANCELADOS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'cancelado'
			AND TIPO_DE = 1
	) AS FAC_CANCELADAS,
	COUNT(*) FILTER (
		WHERE
			LOWER(ESTADO_SIFEN) = 'cancelado'
			AND TIPO_DE = 5
	) AS NOC_CANCELADAS,
	--No generadas
	COUNT(*) FILTER (
		WHERE
			ESTADO = 2
			AND CDC IS NULL
	) AS NO_GENERADAS,
	COUNT(*) FILTER (
		WHERE
			ESTADO = 2
			AND CDC IS NULL
			AND TIPO_DE = 1
	) AS FAC_NO_GENERADAS,
	COUNT(*) FILTER (
		WHERE
			ESTADO = 2
			AND CDC IS NULL
			AND TIPO_DE = 5
	) AS NOC_NO_GENERADAS
FROM
	DE
WHERE
	DATE_TRUNC('day', FECHA)::DATE BETWEEN $1::DATE AND $2::DATE`,
      [params.fechaDesde, params.fechaHasta],
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error en obtenerMetricasSifenService:", error);
  }
};
