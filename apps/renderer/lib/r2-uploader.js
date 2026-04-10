import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.STORAGE_BUCKET || "relic-images";
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing Cloudflare R2 configuration: CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    );
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

export async function uploadToR2(tokenId, buffer) {
  try {
    const client = getS3Client();
    const key = `relics/${tokenId}.webp`;

    console.log(`[R2] Uploading ${key} (${buffer.length} bytes) to R2`);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
      CacheControl: "max-age=31536000, immutable",
      Metadata: {
        token_id: String(tokenId),
        uploaded_at: new Date().toISOString(),
      },
    });

    await client.send(command);

    // Generate public URL
    let publicUrl;
    if (R2_PUBLIC_URL) {
      publicUrl = `${R2_PUBLIC_URL}/${key}`;
    } else {
      // Fallback to standard R2 public URL pattern
      // Format: https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>
      publicUrl = `https://${R2_BUCKET}.r2.cloudflarestorage.com/${key}`;
    }

    console.log(`[R2] Upload successful: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error(`[R2] Upload failed for token ${tokenId}:`, error);
    throw error;
  }
}

export async function checkImageExists(tokenId) {
  try {
    const client = getS3Client();
    const key = `relics/${tokenId}.webp`;

    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error(`[R2] Error checking if image exists:`, error);
    throw error;
  }
}
