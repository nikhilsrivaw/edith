/**
 * PayU webhook receiver.
 *
 * PayU posts a form-encoded body with a hash. Verify the hash before
 * trusting the payload.
 *
 * Hash spec (production):
 *   sha512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
 *
 * (Order of pipes/fields differs by API version — confirm against the PayU
 * docs for the exact API you are using before going live.)
 */
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function verifyPayuHash(body: Record<string, string>): boolean {
  if (!env.PAYU_MERCHANT_SALT || !env.PAYU_MERCHANT_KEY) return false;
  const received = body.hash;
  if (!received) return false;

  const parts = [
    env.PAYU_MERCHANT_SALT,
    body.status ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    body.email ?? "",
    body.firstname ?? "",
    body.productinfo ?? "",
    body.amount ?? "",
    body.txnid ?? "",
    env.PAYU_MERCHANT_KEY,
  ];
  const expected = crypto
    .createHash("sha512")
    .update(parts.join("|"))
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const body: Record<string, string> = {};
  formData.forEach((v, k) => {
    body[k] = typeof v === "string" ? v : "";
  });

  if (!verifyPayuHash(body)) {
    return new NextResponse("invalid hash", { status: 401 });
  }

  if (env.USE_FIXTURES) {
    console.log("[webhook/payu] received (fixtures mode — no DB write)", {
      status: body.status,
      txnid: body.txnid,
    });
    return NextResponse.json({ ok: true, mode: "fixtures" });
  }

  // TODO: idempotency insert into webhook_events, then update billing_subscriptions.

  return NextResponse.json({ ok: true });
}
