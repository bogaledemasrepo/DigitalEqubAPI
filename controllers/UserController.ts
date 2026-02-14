import {
  Body,
  Controller,
  Post,
  Route,
  SuccessResponse,
  Get,
  Path,
  Security,
  Request,
} from "tsoa";

import { HttpError } from "../services/HttpError";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

interface UserRequest {
  email: string;
  age: number;
  username?: string; // Optional field
}

@Route("users")
export class UsersController extends Controller {
  @SuccessResponse("201", "Created")
  @Post()
  @Security("jwt")
  public async createUser(@Body() requestBody: UserRequest): Promise<void> {
    console.log("User data is 100% valid here:", requestBody);
    this.setStatus(201);
    return;
  }

  @Get("me")
  @Security("jwt")
  public async getMe(@Request() request: any) {
    const userId = request.user.userId; // 'user' comes from the 'resolve(decoded)' in authentication.ts
    console.log("Authenticated user ID:", userId);
    return await db.select().from(users).where(eq(users.id, userId));
  }

  @Get("{id}")
  public async getUser(@Path() id: string): Promise<any> {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (user.length === 0) {
      // Professional way to trigger a 404
      throw new HttpError(404, "User not found");
    }

    return user[0];
  }


}
