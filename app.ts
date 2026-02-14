import express, { json, urlencoded } from "express";
import { RegisterRoutes } from "./generated/routes"; // Clean import!
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./generated/swagger.json";
import { errorHandler } from "./exceptions/exceptionHandler";
import cors from "cors";
import { createHmac } from "crypto";
import { handleSuccessfulPayment } from "./services/Payment";

export const app = express();
app.use(
  cors({
    origin: "*",
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);
app.use(urlencoded({ extended: true }), json());
// Webhooks usually don't have JWT auth because they come from Chapa

app.post("/payments/webhook", async (req, res) => {
  // 1. Get the signature from the header
  const signature = req.headers["x-chapa-signature"] as string;
  const secret = process.env.CHAPA_SECRET_KEY!;

  // 2. Re-calculate the hash using your secret and the raw body
  const hash = createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  // 3. Securely compare (using timingSafeEqual prevents "timing attacks")
  if (hash !== signature) {
    console.error("⚠️ Invalid Webhook Signature! Possible fraud attempt.");
    return res.status(401).send("Invalid signature");
  }

  // 4. If valid, process the payment
  const { tx_ref, status, amount } = req.body;
  if (status === "success") {
    await handleSuccessfulPayment(tx_ref, amount);
  }

  res.sendStatus(200);
});

RegisterRoutes(app);
app.use(errorHandler);
