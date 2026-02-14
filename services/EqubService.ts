import { db } from "../db";
import {
  equbMembers,
  equbWinners,
  equbPayments,
  equbGroups,
  users,
} from "../db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { HttpError } from "./HttpError";

export class EqubService {
  // Check if all active members have paid for the current round
  public async verifyRoundPayments(
    groupId: string,
    roundNumber: number,
  ): Promise<boolean> {
    // 1. Get total number of members in the group
    const members = await db
      .select()
      .from(equbMembers)
      .where(
        and(
          eq(equbMembers.groupId, groupId),
          eq(equbMembers.status, "approved"),
        ),
      );
    const totalMembers = members.length;

    // 2. Count completed payments for this round
    const [paymentCount] = await db
      .select({ value: count() })
      .from(equbPayments)
      .where(
        and(
          eq(equbPayments.groupId, groupId),
          eq(equbPayments.roundNumber, roundNumber),
          eq(equbPayments.status, "completed"),
        ),
      );

    return paymentCount?.value === totalMembers;
  }

  public async performDraw(groupId: string) {
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));

    if (!group?.isActive) {
      throw new HttpError(
        400,
        "The Equb is currently paused. Activate it to perform a draw.",
      );
    }
    return await db.transaction(async (tx) => {
      // 1. Get eligible members (those who haven't won)
      const eligibleMembers = await tx
        .select()
        .from(equbMembers)
        .where(
          and(
            eq(equbMembers.groupId, groupId),
            eq(equbMembers.hasWon, false),
            eq(equbMembers.status, "approved"),
          ),
        )
        .orderBy(sql`RANDOM()`) // Let Postgres handle the randomness
        .limit(1);
      const winner = eligibleMembers[0];
      if (!winner) {
        throw new HttpError(400, "No eligible members left in this Equb group");
      } else {
        // 2. Mark member as won
        await tx
          .update(equbMembers)
          .set({ hasWon: true })
          .where(eq(equbMembers.id, winner.id));

        // 3. Record the win in the winners history
        // You could calculate roundNumber based on existing wins
        await tx.insert(equbWinners).values({
          groupId,
          userId: winner.userId,
          roundNumber: 1, // Logic to increment this based on previous rounds
        });

        return winner;
      }
    });
  }
  public async processWinnerPayout(groupId: string, winnerUserId: string) {
    // 1. Calculate the Pot
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));
    const members = await db
      .select()
      .from(equbMembers)
      .where(eq(equbMembers.groupId, groupId));
    if (!group) throw new HttpError(400, "Equb group not found!");
    const totalCollected = Number(group.amount) * members.length;
    const platformFee = totalCollected * 0.02; // 2% service fee
    const payoutAmount = totalCollected - platformFee;

    // 2. Get winner's payment details (assuming you store these in users table)
    const [winner] = await db
      .select()
      .from(users)
      .where(eq(users.id, winnerUserId));
    if (!winner) throw new HttpError(400, "Equb group not found!");
    // 3. Trigger Chapa Transfer
    try {
      const response = await fetch("https://api.chapa.co/v1/transfers", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
        body: JSON.stringify({
          account_name: winner.name,
          account_number: 10003000400112, // Bank account or Telebirr phone
          amount: payoutAmount,
          currency: "ETB",
          bank_code: 656, // e.g., '656' for Telebirr
          reference: `payout-${groupId}-${winnerUserId}-${Date.now()}`,
        }),
      });

      return response.json();
    } catch (error) {
      console.error("Payout failed:", error);
      throw new HttpError(
        500,
        "Automated payout failed. Manual intervention required.",
      );
    }
  }
}
