import { config } from "./config.js";
import express from "express";
import morganBody from "morgan-body";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import { router } from "./src/routes/index.js";
import { listenStatusSifenService } from "./src/services/listen.service.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

morganBody(app, { maxBodyLength: 2000 });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.use("/delsoldashboard/api", router);

async function startServer() {
  try {
    await listenStatusSifenService(io);

    server.listen(config.port, () => {
      console.log(
        `Server API delSol dashboard running on port ${config.port} in ${config.env} mode.`,
      );
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();
