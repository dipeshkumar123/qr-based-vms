import { createHash } from "crypto";
import { connectMongo } from "../db/pool.js";
import { CreateVisitorPayload, Visitor } from "../types/visitor.js";
import { v4 as uuidv4 } from "uuid";
import { ObjectId } from "mongodb";

interface LedgerEntry {
  hash: string;
  visitorId: string;
  createdAt: string;
}

const inMemoryLedger: LedgerEntry[] = [];

export async function createVisitor(payload: CreateVisitorPayload): Promise<Visitor> {
  const db = await connectMongo();
  const qrToken = uuidv4();
  const status: Visitor["status"] = "registered";
  const createdAt = new Date().toISOString();
  const visitor: Visitor = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    purpose: payload.purpose,
    status,
    qrToken,
    createdAt,
  };
  const result = await db.collection("visitors").insertOne(visitor);
  visitor._id = result.insertedId.toString();
  recordLedgerEntry(visitor);
  return visitor;
}

export async function listVisitors(): Promise<Visitor[]> {
  const db = await connectMongo();
  const visitors = await db.collection("visitors").find().sort({ createdAt: -1 }).toArray();
  return visitors.map(v => ({ ...v, _id: v._id?.toString() }));
}

export async function findVisitorByQrToken(qrToken: string): Promise<Visitor | null> {
  const db = await connectMongo();
  const visitor = await db.collection("visitors").findOne({ qrToken });
  return visitor ? { ...visitor, _id: visitor._id?.toString() } : null;
}

export async function checkInVisitor(qrToken: string): Promise<Visitor | null> {
  const db = await connectMongo();
  const result = await db.collection("visitors").findOneAndUpdate(
    { qrToken },
    { $set: { status: "checked_in" } },
    { returnDocument: "after" }
  );
  const visitor = result.value ? { ...result.value, _id: result.value._id?.toString() } : null;
  if (visitor) {
    recordLedgerEntry(visitor);
  }
  return visitor;
}

export async function deleteVisitor(id: string): Promise<void> {
  const db = await connectMongo();
  await db.collection("visitors").deleteOne({ _id: new ObjectId(id) });
}

export function getLedger(): LedgerEntry[] {
  return inMemoryLedger;
}

function recordLedgerEntry(visitor: Visitor): void {
  const payload = JSON.stringify({
    id: visitor._id,
    status: visitor.status,
    qrToken: visitor.qrToken,
    timestamp: new Date().toISOString(),
  });

  const hash = createHash("sha256").update(payload).digest("hex");
  inMemoryLedger.push({
    hash,
    visitorId: visitor._id || "",
    createdAt: new Date().toISOString(),
  });
}
