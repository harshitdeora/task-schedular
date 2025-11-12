import redis from "./utils/redisClient.js";


(async () => {
  try {
    await redis.set("hello", "world");
    const value = await redis.get("hello");
    console.log("GET hello ->", value);
    process.exit(0);
  } catch (err) {
    console.error("Redis test error:", err);
    process.exit(1);
  }
})();
