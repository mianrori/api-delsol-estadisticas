import express from "express";

export const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ status: "API delSol dashboard is running" });
});
