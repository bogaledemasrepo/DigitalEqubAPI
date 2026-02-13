import { Body, Controller, Post, Route, SuccessResponse,Get, Path  } from "tsoa";

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
  public async createUser(@Body() requestBody: UserRequest): Promise<void> {
    console.log("User data is 100% valid here:", requestBody);
    this.setStatus(201);
    return;
  }
}


@Route("users")
export class UserController extends Controller {
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