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
    const resp = await db.collection("participants").findOne({ name: name });
    if (resp) return res.sendStatus(409);
    await db.collection("participants").insertOne({
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
  } catch (err) {
    return res.status(500).send(err);
  }
});

app.get("/participants", (req, res) => {
  db.collection("participants")
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
    const resp = await db.collection("participants").findOne({ name: user });
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
  } catch (err) {
    return res.status(500).send(err);
  }
});

app.get("/messages", (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;
  if (limit > 0) {
    db.collection("messages")
      .find({
        $or: [
          { to: "Todos" },
          { to: user },
          { from: user },
          { type: "message" },
        ],
      })
      .toArray()
      .then((messages) => {
        res.send(messages.slice(limit * -1));
      })
      .catch((err) => res.status(500).send(err.message));
  } else if (!limit) {
    db.collection("messages")
      .find({
        $or: [
          { to: "Todos" },
          { to: user },
          { from: user },
          { type: "message" },
        ],
      })
      .toArray()
      .then((messages) => res.send(messages))
      .catch((err) => res.status(500).send(err.message));
  } else {
    return res.sendStatus(422);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  if (!user) return res.sendStatus(404);
  try {
    const resp = db.collection("participants").findOne({ name: user });
    if (resp) {
      await db.collection("participants").updateOne(
        { name: user },
        {
          $set: {
            lastStatus: Date.now(),
          },
        }
      );
      return res.sendStatus(200);
    } else if (!resp) return res.sendStatus(404);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

setInterval(async () => {
  try {
    const resp = await db
      .collection("participants")
      .find({ lastStatus: { $lte: Date.now() - 10000 } })
      .toArray();

    resp.forEach(async (user) => {
      await db.collection("messages").insertOne({
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
      });

      db.collection("participants").deleteOne({
        name: user.name,
      });
    });
  } catch (error) {
    console.log(error.message);
  }
}, 15000);

app.listen(PORT, () => console.log(`O servidor está online na porta ${PORT}`));
