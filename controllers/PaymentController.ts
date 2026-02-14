import { equbGroups, equbPayments } from "../db/schema";
import { db } from "../db";
import { Controller, Path, Post, Request, Route, Security } from "tsoa";
import { eq } from "drizzle-orm";

@Route("payments")
@Security("jwt")
export class PaymentController extends Controller {
  @Post("initialize/{groupId}")
  public async initializePayment(
    @Request() request: any,
    @Path() groupId: string,
  ) {
    const userId = request.user.userId;
    const tx_ref = `tx-${userId}-${groupId}-${Date.now()}`;

    // 1. Get Equb amount
    const [group] = await db
      .select()
      .from(equbGroups)
      .where(eq(equbGroups.id, groupId));
    if (!group) {
      throw new Error("Equb group not found");
    }
    // 2. Call Chapa API
    const response = await fetch(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: group.amount,
          currency: "ETB",
          email: request.user.email,
          first_name: request.user.name,
          tx_ref: tx_ref,
          callback_url: "https://your-api.com/payments/webhook", // Your webhook
          "customization[title]": `Equb Payment: ${group.title}`,
        }),
      },
    );

    // 3. Save pending payment in your DB
    await db.insert(equbPayments).values({
      memberId: userId, // Logic to get memberId from userId
      groupId: groupId,
      amount: group.amount,
      roundNumber: 1, // Calculate current round
      status: "pending",
      txReference: tx_ref,
    });

    return await response.json(); // This contains the 'checkout_url'
  }
}
