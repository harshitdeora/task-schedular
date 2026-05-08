import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/User.js";
import Variable from "../models/Variable.js";

dotenv.config();

const TEST_USER = {
  username: "demo.user",
  email: "demo.user@taskscheduler.local",
  password: "Demo@12345",
  name: "Demo User"
};

async function seedUser() {
  let user = await User.findOne({ email: TEST_USER.email });

  if (!user) {
    user = await User.create(TEST_USER);
    return user;
  }

  user.username = TEST_USER.username;
  user.name = TEST_USER.name;
  user.password = TEST_USER.password;
  await user.save();
  return user;
}

async function seedVariables(userId) {
  const variableSeeds = [
    {
      name: "API_BASE_URL",
      value: "https://jsonplaceholder.typicode.com/todos/1",
      isSecret: false,
      description: "Sample API endpoint for http node testing",
      tags: ["demo", "api"]
    },
    {
      name: "ALERT_EMAIL",
      value: "demo.user@taskscheduler.local",
      isSecret: false,
      description: "Sample recipient address used by email tasks",
      tags: ["demo", "email"]
    }
  ];

  for (const seed of variableSeeds) {
    await Variable.findOneAndUpdate(
      { userId, name: seed.name },
      { ...seed, userId, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function run() {
  try {
    await connectDB();

    const user = await seedUser();
    await seedVariables(user._id);

    console.log("Seed complete.");
    console.log(`User email: ${TEST_USER.email}`);
    console.log(`User password: ${TEST_USER.password}`);
    console.log(`User id: ${user._id}`);
    console.log("Seeded variables: API_BASE_URL, ALERT_EMAIL");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
