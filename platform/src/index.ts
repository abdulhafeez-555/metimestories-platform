import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { parentAuthRoutes } from "./routes/parent-auth";
import { childAuthRoutes } from "./routes/child-auth";
import { authorAuthRoutes } from "./routes/author-auth";
import { childrenRoutes } from "./routes/children";
import { storiesRoutes } from "./routes/stories";
import { personalisationRoutes } from "./routes/personalisation";
import { videoJobsRoutes } from "./routes/video-jobs";
import { webhookRoutes } from "./routes/webhook";
import { storyGenerationRoutes } from "./routes/story-generation";
import { authorStoriesRoutes } from "./routes/author-stories";
import { staffAuthRoutes } from "./routes/staff-auth";
import { staffReviewRoutes } from "./routes/staff-reviews";

dotenv.config();

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(jwt, { secret: process.env.JWT_SECRET || "dev-secret" });

app.register(parentAuthRoutes,  { prefix: "/api/auth/parent" });
app.register(childAuthRoutes,   { prefix: "/api/auth/child" });
app.register(authorAuthRoutes,  { prefix: "/api/auth/author" });

app.register(childrenRoutes,        { prefix: "/api/children" });
app.register(storiesRoutes,         { prefix: "/api/stories" });
app.register(personalisationRoutes, { prefix: "/api/personalisation" });
app.register(videoJobsRoutes,       { prefix: "/api/video-jobs" });
app.register(webhookRoutes,         { prefix: "/api/webhook" });
app.register(storyGenerationRoutes, { prefix: "/api/story-generation" });
app.register(authorStoriesRoutes,   { prefix: "/api/author/stories" });
app.register(staffAuthRoutes,       { prefix: "/api/auth/staff" });
app.register(staffReviewRoutes,     { prefix: "/api/staff/reviews" });

app.get("/healthz", async () => ({
  status: "ok",
  service: "MeTimeStories API",
  version: "1.0.0",
  timestamp: new Date().toISOString()
}));

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });
    console.log("MeTimeStories API running on http://localhost:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();


