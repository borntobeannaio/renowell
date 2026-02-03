import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const S3_ENDPOINT = 'https://storage.yandexcloud.net';

interface UploadRequest {
  fileName: string;
  fileBase64: string;
  contentType: string;
  folder?: string;
}

// Generate AWS v4 signature for S3
async function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  payload: Uint8Array,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = path;
  const canonicalQueryString = '';

  // Compute content hash
  const payloadHashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(payload) as unknown as ArrayBuffer);
  const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Build canonical headers
  const sortedHeaders = Object.entries({
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }).sort(([a], [b]) => a.localeCompare(b));

  const canonicalHeaders = sortedHeaders
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .join('\n') + '\n';

  const signedHeaders = sortedHeaders
    .map(([k]) => k.toLowerCase())
    .join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalRequestHashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalRequest)
  );
  const canonicalRequestHash = Array.from(new Uint8Array(canonicalRequestHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature
  const getSignatureKey = async (key: string, dateStamp: string, region: string, service: string) => {
    const kDate = await hmacSha256(`AWS4${key}`, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    return kSigning;
  };

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(stringToSign)
  );
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'Authorization': authorizationHeader,
  };
}

async function hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKeyId = Deno.env.get('YANDEX_S3_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('YANDEX_S3_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('YANDEX_S3_BUCKET_NAME');

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing S3 credentials');
    }

    const body: UploadRequest = await req.json();
    const { fileName, fileBase64, contentType, folder = 'chat-files' } = body;

    if (!fileName || !fileBase64) {
      throw new Error('Missing fileName or fileBase64');
    }

    // Decode base64 to binary
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const objectPath = `/${bucketName}/${folder}/${uniqueFileName}`;
    const host = 'storage.yandexcloud.net';

    const headers: Record<string, string> = {
      'Host': host,
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': bytes.length.toString(),
    };

    // Sign the request
    const signedHeaders = await signRequest(
      'PUT',
      objectPath,
      headers,
      bytes,
      accessKeyId,
      secretAccessKey,
      'ru-central1',
      's3'
    );

    // Upload to S3
    const uploadUrl = `${S3_ENDPOINT}${objectPath}`;
    console.log('Uploading to:', uploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: signedHeaders,
      body: bytes,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('S3 upload error:', uploadResponse.status, errorText);
      throw new Error(`S3 upload failed: ${uploadResponse.status}`);
    }

    // Consume response body
    await uploadResponse.text();

    // Return the public URL
    const publicUrl = `${S3_ENDPOINT}/${bucketName}/${folder}/${uniqueFileName}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        fileName: uniqueFileName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Upload failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
