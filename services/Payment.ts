import { eq } from "drizzle-orm";
import { db } from "../db";
import { equbPayments } from "../db/schema";

export async function handleSuccessfulPayment(tx_ref: string, amount: number) {
  const [existingPayment] = await db.select()
    .from(equbPayments)
    .where(eq(equbPayments.txReference, tx_ref));

  if (existingPayment?.status === "completed") {
    return; // Already processed, ignore duplicate
  }

  // Update payment status and check if lottery is ready...
  await db.update(equbPayments)
    .set({ status: "completed" })
    .where(eq(equbPayments.txReference, tx_ref));

  // Additional logic to check if all payments are completed and perform draw
}   