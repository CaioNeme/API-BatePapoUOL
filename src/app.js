import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
dotenv.config();

const PORT = 5000;
const app = express();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
const time = dayjs(Date.now()).format("HH:mm:ss");

app.use(json());
app.use(cors());

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch((err) => console.log(err.message));

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const participantesSchema = joi.object({
    name: joi.string().required(),
  });
  const validacao = participantesSchema.validate(req.body);

  if (validacao.error) {
    const errors = validacao.error.details.map((detalhes) => detalhes.message);
    console.log(errors);
    return res.sendStatus(422);
  }

  try {
    const resp = await db.collection("participantes").findOne({ name: name });
    if (resp) return res.sendStatus(409);
    await db.collection("participantes").insertOne({
      name: name,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "Entra na sala...",
      type: "status",
      time: time,
    });
    return res.sendStatus(201);
  } catch {
    return res.status(500).send(err);
  }
});

app.get("/participants", (req, res) => {
  db.collection("participantes")
    .find()
    .toArray()
    .then((participantes) => res.send(participantes))
    .catch((err) => res.status(500).send(err.message));
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const mensagemSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
  });

  const validacao = mensagemSchema.validate(req.body);
  if (validacao.error) {
    const errors = validacao.error.details.map((detalhes) => detalhes.message);
    console.log(errors);
    return res.sendStatus(422);
  }
  try {
    const resp = await db.collection("participantes").findOne({ name: user });
    if (resp) {
      await db.collection("messages").insertOne({
        from: user,
        to: to,
        text: text,
        type: type,
        time: time,
      });
      return res.sendStatus(201);
    } else {
      return res.sendStatus(422);
    }
  } catch {
    return res.status(500).send(err);
  }
});

app.get("/messages", (req, res) => {
  db.collection("messages")
    .find()
    .toArray()
    .then((messages) => res.send(messages))
    .catch((err) => res.status(500).send(err.message));
});

app.listen(PORT, () => console.log(`O servidor está online na porta ${PORT}`));
