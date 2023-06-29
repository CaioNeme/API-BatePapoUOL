import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const PORT = 5000;
const app = express();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch((err) => console.log(err.message));

app.use(json());
app.use(cors());

app.get("/teste", (req, res) => {
  res.send("ok");
});

app.post("/participantes", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.sendStatus(422);
  }
  db.collection("participantes")
    .findOne({ name: name })
    .then((participante) => {
      if (participante === null) {
        db.collection("participantes").insertOne({
          name: name,
          lastStatus: Date.now(),
        });
        return res.sendStatus(201);
      } else {
        res.sendStatus(409);
      }
    })
    .catch(() => {
      return res.status(500).send(err);
    });
});

app.get("/participantes", (req, res) => {
  db.collection("participantes")
    .find()
    .toArray()
    .then((participantes) => res.send(participantes))
    .catch((err) => res.status(500).send(err.message));
});

app.listen(PORT, () => console.log(`O servidor está online na porta ${PORT}`));
