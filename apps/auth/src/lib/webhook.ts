import { createHmac, timingSafeEqual } from "crypto"

export function validateWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")

  const expectedBuf = Buffer.from(expected, "hex")
  const signatureBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex")

  if (expectedBuf.length !== signatureBuf.length) return false

  return timingSafeEqual(expectedBuf, signatureBuf)
}
