import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();

// Create Redis client using your Upstash credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

console.log("✅ Connected to Upstash Redis");

export default redis;
