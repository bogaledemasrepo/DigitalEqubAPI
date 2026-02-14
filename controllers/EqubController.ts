import {
  Controller,
  Post,
  Body,
  Route,
  Security,
  Request,
  Tags,
  Path,
  Put,
  Get,
  Query,
  Delete,
  Patch,
} from "tsoa";
import { db } from "../db";
import { equbGroups, equbMembers, equbPayments, users } from "../db/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import { HttpError } from "../services/HttpError";
import { EqubService } from "../services/EqubService";

@Route("equb")
@Tags("Equb Logic")
@Security("jwt")
export class EqubController extends Controller {
  private equbService = new EqubService();

  @Get("list")
  public async getAllGroups() {
    const groups = await db
      .select({
        id: equbGroups.id,
        title: equbGroups.title,
        amount: equbGroups.amount,
        frequency: equbGroups.frequency,
        maxMembers: equbGroups.maxMembers,
        isActive: equbGroups.isActive,
        // Dynamic member count using a subquery
        currentMembers: sql<number>`(SELECT count(*) FROM ${equbMembers} WHERE ${equbMembers.groupId} = ${equbGroups.id})`,
      })
      .from(equbGroups)
      .where(eq(equbGroups.isActive, true));

    return groups;
  }

  @Get("my-groups")
  @Security("jwt")
  public async getMyGroups(@Request() request: any) {
    const userId = request.user.userId;

    return await db
      .select({
        groupId: equbGroups.id,
        title: equbGroups.title,
        amount: equbGroups.amount,
        isAdmin: sql<boolean>`CASE WHEN ${equbGroups.adminId} = ${userId} THEN true ELSE false END`,
        joinedAt: equbMembers.joinedAt,
      })
      .from(equbMembers)
      .innerJoin(equbGroups, eq(equbMembers.groupId, equbGroups.id))
      .where(eq(equbMembers.userId, userId));
  }

  @Get("search")
  public async searchGroups(@Query() q?: string) {
    const query = db
      .select({
        id: equbGroups.id,
        title: equbGroups.title,
        amount: equbGroups.amount,
        frequency: equbGroups.frequency,
        maxMembers: equbGroups.maxMembers,
        isActive: equbGroups.isActive,
        currentMembers: sql<number>`(SELECT count(*) FROM ${equbMembers} WHERE ${equbMembers.groupId} = ${equbGroups.id})`,
      })
      .from(equbGroups);

    // If a search term is provided, filter the results
    if (q) {
      return await query.where(
        and(
          eq(equbGroups.isActive, true),
          ilike(equbGroups.title, `%${q}%`), // ilike is case-insensitive in Postgres
        ),
      );
    }

    return await query.where(eq(equbGroups.isActive, true));
  }

  @Get("search/paged")
  public async searchGroupsPaged(
    @Query() q?: string,
    @Query() page: number = 1,
    @Query() limit: number = 10,
  ) {
    const offset = (page - 1) * limit;

    const filters = [eq(equbGroups.isActive, true)];
    if (q) filters.push(ilike(equbGroups.title, `%${q}%`));

    return await db
      .select({
        id: equbGroups.id,
        title: equbGroups.title,
        amount: equbGroups.amount,
      })
      .from(equbGroups)
      .where(and(...filters))
      .limit(limit)
      .offset(offset);
  }

  @Get("{groupId}/detail")
  @Security("jwt")
  public async getGroupDetail(@Path() groupId: string) {
    // 1. Get the Group info and Admin details
    const [group] = await db
      .select({
        id: equbGroups.id,
        title: equbGroups.title,
        amount: equbGroups.amount,
        frequency: equbGroups.frequency,
        maxMembers: equbGroups.maxMembers,
        adminName: users.name, // Joining users table to get admin's name
        createdAt: equbGroups.createdAt,
      })
      .from(equbGroups)
      .innerJoin(users, eq(equbGroups.adminId, users.id))
      .where(eq(equbGroups.id, groupId));

    if (!group) throw new HttpError(404, "Equb not found");

    // 2. Get the list of Members
    const membersList = await db
      .select({
        name: users.name,
        hasWon: equbMembers.hasWon,
        joinedAt: equbMembers.joinedAt,
      })
      .from(equbMembers)
      .innerJoin(users, eq(equbMembers.userId, users.id))
      .where(eq(equbMembers.groupId, groupId));

    return {
      ...group,
      members: membersList,
      memberCount: membersList.length,
    };
  }

  @Post("create")
  @Security("jwt")
  public async createGroup(
    @Request() request: any,
    @Body()
    body: {
      title: string;
      amount: string;
      frequency: string;
      maxMembers: number;
    },
  ) {
    const creatorId = request.user.userId;

    return await db.transaction(async (tx) => {
      // 1. Create the group with the creator as admin
      const [group] = await tx
        .insert(equbGroups)
        .values({
          ...body,
          adminId: creatorId,
        })
        .returning();
      if (!group) {
        throw new HttpError(500, "Failed to create Equb group");
      }
      // 2. Automatically add the creator as the first member
      await tx.insert(equbMembers).values({
        userId: creatorId,
        groupId: group.id,
      });

      return group;
    });
  }


  @Post("{groupId}/request-join")
  @Security("jwt")
  public async requestToJoin(@Request() request: any, @Path() groupId: string) {
    const userId = request.user.userId;

    // 1. Check if group exists and is active
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));
    if (!group || !group.isActive)
      throw new HttpError(404, "Equb group not available");

    // 2. Check if a request already exists
    const [existing] = await db
      .select()
      .from(equbMembers)
      .where(
        and(eq(equbMembers.userId, userId), eq(equbMembers.groupId, groupId)),
      );

    if (existing)
      throw new HttpError(
        400,
        "Request already sent or you are already a member",
      );

    // 3. Insert as 'pending'
    await db.insert(equbMembers).values({ userId, groupId, status: "pending" });

    return { message: "Join request sent to the admin." };
  }

  @Get("{groupId}/pending-requests")
  @Security("jwt")
  public async getPendingRequests(
    @Request() request: any,
    @Path() groupId: string,
  ) {
    const adminId = request.user.userId;

    // 1. Ownership Check: Only the admin of the group should see the requests
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));

    if (!group) throw new HttpError(404, "Equb group not found");
    if (group.adminId !== adminId) {
      throw new HttpError(
        403,
        "Access denied: You are not the admin of this group.",
      );
    }

    // 2. Fetch Pending Members with User details
    const pendingMembers = await db
      .select({
        requestId: equbMembers.id,
        userId: users.id,
        userName: users.name,
        requestedAt: equbMembers.joinedAt,
      })
      .from(equbMembers)
      .innerJoin(users, eq(equbMembers.userId, users.id))
      .where(
        and(
          eq(equbMembers.groupId, groupId),
          eq(equbMembers.status, "pending"),
        ),
      );

    return pendingMembers;
  }

  @Patch("{groupId}/manage-request")
  @Security("jwt")
  public async manageRequest(
    @Request() request: any,
    @Path() groupId: string,
    @Body() body: { targetUserId: string; action: "approved" | "rejected" },
  ) {
    const adminId = request.user.userId;

    // 1. Ownership Check
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));
    if (!group || group.adminId !== adminId) {
      throw new HttpError(403, "Only the admin can approve members.");
    }

    // 2. Update the status
    const [result] = await db
      .update(equbMembers)
      .set({ status: body.action })
      .where(
        and(
          eq(equbMembers.groupId, groupId),
          eq(equbMembers.userId, body.targetUserId),
          eq(equbMembers.status, "pending"),
        ),
      )
      .returning();

    if (!result) throw new HttpError(404, "Pending request not found.");

    return { message: `User has been ${body.action}.` };
  }

  @Post("{groupId}/draw/{round}")
  @Security("jwt")
  public async triggerDraw(
    @Request() request: any,
    @Path() groupId: string,
    @Path() round: number,
  ) {
    const currentUserId = request.user.userId;

    // 1. Verify Ownership
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));

    if (!group) throw new HttpError(404, "Group not found");

    if (group.adminId !== currentUserId) {
      throw new HttpError(403, "Only the Equb creator can trigger the draw.");
    }

    // 2. Proceed with Payment Verification & Draw...
    // const isReady = await this.equbService.verifyRoundPayments(groupId, round);
    // if (!isReady) throw new HttpError(400, "Dues not fully paid.");

    // return await this.equbService.performDraw(groupId);
  }

  @Put("{groupId}/settings")
  @Security("jwt")
  @Tags("Equb Management")
  public async updateSettings(
    @Request() request: any,
    @Path() groupId: string,
    @Body() body: { title?: string; isActive?: boolean },
  ) {
    const userId = request.user.userId;

    // 1. Fetch the group to check ownership
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));

    if (!group) throw new HttpError(404, "Equb group not found");

    // 2. Authorization Check: Only the adminId can modify settings
    if (group.adminId !== userId) {
      throw new HttpError(
        403,
        "Forbidden: Only the group admin can change settings.",
      );
    }

    // 3. Update the record
    const [updatedGroup] = await db
      .update(equbGroups)
      .set({
        title: body.title ?? group.title,
        isActive: body.isActive ?? group.isActive,
      })
      .where(eq(equbGroups.id, groupId))
      .returning();

    return updatedGroup;
  }

  @Get("{groupId}/status/{round}")
  @Security("jwt")
  public async getGroupStatus(@Path() groupId: string, @Path() round: number) {
    return await db
      .select({
        userName: users.name,
        userId: users.id,
        hasPaid: sql<boolean>`CASE WHEN ${equbPayments.id} IS NOT NULL THEN true ELSE false END`,
      })
      .from(equbMembers)
      .innerJoin(users, eq(equbMembers.userId, users.id))
      .leftJoin(
        equbPayments,
        and(
          eq(equbPayments.memberId, equbMembers.id),
          eq(equbPayments.roundNumber, round),
          eq(equbPayments.status, "completed"),
        ),
      )
      .where(eq(equbMembers.groupId, groupId));
  }

  @Delete("{groupId}/members/{userId}")
  @Security("jwt")
  public async kickMember(
    @Request() request: any,
    @Path() groupId: string,
    @Path() userId: string,
  ) {
    const adminId = request.user.userId;

    // 1. Verify that the requester is the Admin of this group
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));
    if (!group || group.adminId !== adminId) {
      throw new HttpError(403, "Only the Equb admin can remove members.");
    }

    // 2. Prevent admin from kicking themselves (they should 'Delete Group' instead)
    if (userId === adminId) {
      throw new HttpError(
        400,
        "You cannot kick yourself. Use the Delete Group option.",
      );
    }

    // 3. Perform the removal
    await db
      .delete(equbMembers)
      .where(
        and(eq(equbMembers.groupId, groupId), eq(equbMembers.userId, userId)),
      );

    return { message: "Member removed from the Equb." };
  }
}
