// Server-only notification dispatcher. Sends order status updates via email + WhatsApp.
// Gracefully no-ops when the user hasn't configured a channel yet, so the rest of
// the app keeps working while they set up Twilio / Resend / Lovable Emails.

type OrderForNotify = {
  id: string;
  tracking_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string;
  status: string;
  carrier?: string | null;
  shipment_tracking_url?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Being prepared",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

function buildBody(order: OrderForNotify, publicTrackUrl: string) {
  const label = STATUS_LABEL[order.status] ?? order.status;
  const lines = [
    `Hi ${order.customer_name},`,
    ``,
    `Your order for "${order.product_name}" is now: ${label}.`,
    `Tracking #: ${order.tracking_number}`,
  ];
  if (order.carrier) lines.push(`Carrier: ${order.carrier}`);
  if (order.shipment_tracking_url) lines.push(`Carrier tracking: ${order.shipment_tracking_url}`);
  lines.push(``, `Track live: ${publicTrackUrl}`);
  return { subject: `Order ${order.tracking_number}: ${label}`, text: lines.join("\n") };
}

async function sendWhatsApp(order: OrderForNotify, body: string): Promise<{ ok: boolean; reason?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!lovableKey || !twilioKey || !from || !order.customer_phone) {
    return { ok: false, reason: "twilio-not-configured-or-no-phone" };
  }
  const to = order.customer_phone.startsWith("whatsapp:")
    ? order.customer_phone
    : `whatsapp:${order.customer_phone}`;

  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    console.warn("[notify] twilio failed", res.status, await res.text().catch(() => ""));
    return { ok: false, reason: `twilio-${res.status}` };
  }
  return { ok: true };
}

async function sendEmailViaLovable(
  order: OrderForNotify,
  subject: string,
  text: string,
  origin: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!order.customer_email) return { ok: false, reason: "no-email" };
  // Try Lovable's transactional email route (works once email domain + infra is set up).
  try {
    const res = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "order-status-update",
        recipientEmail: order.customer_email,
        idempotencyKey: `order-${order.id}-${order.status}`,
        templateData: {
          customerName: order.customer_name,
          productName: order.product_name,
          status: STATUS_LABEL[order.status] ?? order.status,
          trackingNumber: order.tracking_number,
          trackUrl: `${origin}/track?n=${encodeURIComponent(order.tracking_number)}`,
          carrier: order.carrier ?? null,
          carrierUrl: order.shipment_tracking_url ?? null,
        },
      }),
    });
    if (!res.ok) {
      console.warn("[notify] lovable email failed", res.status);
      return { ok: false, reason: `email-${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[notify] lovable email throw", e);
    return { ok: false, reason: "email-throw" };
  }
}

export async function notifyOrderStatus(order: OrderForNotify, origin: string) {
  const { subject, text } = buildBody(order, `${origin}/track?n=${encodeURIComponent(order.tracking_number)}`);
  const [email, whatsapp] = await Promise.all([
    sendEmailViaLovable(order, subject, text, origin),
    sendWhatsApp(order, text),
  ]);
  return { email, whatsapp };
}
