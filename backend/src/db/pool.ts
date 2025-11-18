import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/ii_vms";
const dbName = uri.split("/").pop() || "ii_vms";
let client: MongoClient;
let db: Db;

export async function connectMongo(): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log("MongoDB connected");
  }
  return db;
}
