import type { APIRoute } from "astro";
import { authorizeStudioRequest } from "~/features/api/auth";
import { sanityEditClient as sanityWriteClient } from "../../sanity/lib/client";

// Studio-triggered SEO screenshot capture: Microlink screenshot fetch, uploaded to Sanity as an
// image asset.
export const prerender = false;

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1008;
const JPEG_QUALITY = 85;
const DEFAULT_WAIT_SECONDS = 2;
const MAX_WAIT_SECONDS = 10;

type MicrolinkResponse = {
  status?: string;
  data?: {
    screenshot?: {
      url?: string;
      type?: string;
      width?: number;
      height?: number;
    };
  };
  message?: string;
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await authorizeStudioRequest(request);

  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();
    const targetUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!targetUrl) {
      return Response.json({ error: "Missing url." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return Response.json({ error: "Invalid url." }, { status: 400 });
    }

    const rawWait =
      typeof body?.waitSeconds === "number" && Number.isFinite(body.waitSeconds) ? body.waitSeconds : DEFAULT_WAIT_SECONDS;
    const waitSeconds = Math.max(0, Math.min(MAX_WAIT_SECONDS, rawWait));
    const waitMs = Math.round(waitSeconds * 1000);

    const params = new URLSearchParams({
      url: targetUrl,
      screenshot: "true",
      meta: "false",
      "viewport.width": String(VIEWPORT_WIDTH),
      "viewport.height": String(VIEWPORT_HEIGHT),
      "viewport.deviceScaleFactor": "1",
      "screenshot.type": "jpeg",
      "screenshot.quality": String(JPEG_QUALITY),
      "screenshot.fullPage": "false",
      waitUntil: "networkidle0",
      waitForTimeout: String(waitMs),
    });

    const microlinkRes = await fetch(`https://api.microlink.io/?${params.toString()}`);
    const payload = (await microlinkRes.json()) as MicrolinkResponse;

    if (!microlinkRes.ok || payload.status !== "success") {
      const reason = payload?.message ?? `HTTP ${microlinkRes.status}`;
      return Response.json({ error: `Microlink request failed: ${reason}` }, { status: 502 });
    }

    const screenshotUrl = payload.data?.screenshot?.url;
    if (!screenshotUrl) {
      return Response.json({ error: "Microlink returned no screenshot url." }, { status: 502 });
    }

    const imageRes = await fetch(screenshotUrl);
    if (!imageRes.ok) {
      return Response.json({ error: `Failed to fetch screenshot asset: HTTP ${imageRes.status}` }, { status: 502 });
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength === 0) {
      return Response.json({ error: "Screenshot asset was empty." }, { status: 502 });
    }

    const returnedType = payload.data?.screenshot?.type === "jpeg" ? "jpeg" : "png";
    const extension = returnedType === "jpeg" ? "jpg" : "png";
    const contentType = returnedType === "jpeg" ? "image/jpeg" : "image/png";

    const hostname = parsedUrl.hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const filename = `share-${hostname || "screenshot"}-${Date.now()}.${extension}`;

    const asset = await sanityWriteClient.assets.upload("image", buffer, {
      filename,
      contentType,
    });

    return Response.json({
      image: {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: asset._id,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screenshot generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
};
