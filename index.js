require("dotenv").config();

const child = require("child_process");
const wait = require("timers/promises").setTimeout;

const express = require("express");
const app = express();
app.use(express.json());

const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

const key = process.env.KEY;
const port = process.env.PORT || 5000;

if (!key) {
  logger.error("Missing key from .env");
  return console.error("Missing key from .env");
}

app.post("/command", (req, res) => {
  const auth = req.headers["authorization"];
  if (auth !== key) {
    logger.warn("Unauthorized request");
    return res.status(401).send("Unauthorized");
  }

  const command = req.body.command;
  if (!command) {
    logger.warn("Authorized request, but Missing command");
    return res.status(400).send("Missing command");
  }
  logger.info(`Received command: ${command}`);

  const process = child.spawn(command, {
    shell: true,
    stdio: "inherit",
  });

  if (!process) {
    logger.error("Command failed");
    return res.status(500).send("Command failed");
  }

  let statusErr = "";
  let statusOut = "";

  process.stdout.on("data", (data) => {
    statusOut += data;
  });

  process.stderr.on("data", (data) => {
    statusErr += data;
  });

  process.on("error", (error) => {
    logger.error(`Command error: ${error.message}`);
  });

  process.on("close", (code) => {
    logger.info(`Command exited with code ${code}`);
    const response = {
      stdout: statusOut,
      stderr: statusErr,
      exitCode: code,
    };

    if (
      statusOut.includes("OK") ||
      statusOut.toUpperCase().includes("SUCCESS")
    ) {
      return res.status(200); //.send(response);
    } else if (statusOut.includes("FAIL")) {
      return res.status(500).send(response);
    }
  });
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
