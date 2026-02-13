import express, { json, urlencoded } from "express";
import { RegisterRoutes } from "./generated/routes"; // Clean import!
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./generated/swagger.json";
import type { Response, Request, NextFunction } from "express";
import { ValidateError } from "tsoa";
import { HttpError } from "./services/HttpError";

export const app = express();
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(urlencoded({ extended: true }), json());

RegisterRoutes(app);


export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  if (err instanceof ValidateError) {
    console.warn(`Captured Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: "Validation Failed",
      details: err?.fields,
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      details: err.details,
    });
  }

  if (err instanceof Error) {
    console.error("Unhandled Error:", err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }

  next();
}