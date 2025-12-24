import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RTC token privilege
const Privileges = {
  kJoinChannel: 1,
  kPublishAudioStream: 2,
  kPublishVideoStream: 3,
  kPublishDataStream: 4,
};

// Pack functions
function packUint16(val: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  return buf;
}

function packUint32(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = val & 0xff;
  buf[1] = (val >> 8) & 0xff;
  buf[2] = (val >> 16) & 0xff;
  buf[3] = (val >> 24) & 0xff;
  return buf;
}

function packString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(str);
  const lenBytes = packUint16(strBytes.length);
  const result = new Uint8Array(lenBytes.length + strBytes.length);
  result.set(lenBytes, 0);
  result.set(strBytes, lenBytes.length);
  return result;
}

function packMapUint32(map: Map<number, number>): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(packUint16(map.size));
  map.forEach((value, key) => {
    parts.push(packUint16(key));
    parts.push(packUint32(value));
  });
  
  const totalLen = parts.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hmacSign(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function generateRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = "007";
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Build privileges map
  const privileges = new Map<number, number>();
  privileges.set(Privileges.kJoinChannel, privilegeExpiredTs);
  privileges.set(Privileges.kPublishAudioStream, privilegeExpiredTs);
  privileges.set(Privileges.kPublishVideoStream, privilegeExpiredTs);
  privileges.set(Privileges.kPublishDataStream, privilegeExpiredTs);

  // Pack message
  const uidStr = uid.toString();
  const saltBytes = packUint32(salt);
  const tsBytes = packUint32(currentTimestamp);
  const uidBytes = packString(uidStr);
  const channelBytes = packString(channelName);
  const privilegeBytes = packMapUint32(privileges);
  
  const messageLen = saltBytes.length + tsBytes.length + uidBytes.length + channelBytes.length + privilegeBytes.length;
  const message = new Uint8Array(messageLen);
  let offset = 0;
  
  message.set(saltBytes, offset); offset += saltBytes.length;
  message.set(tsBytes, offset); offset += tsBytes.length;
  message.set(uidBytes, offset); offset += uidBytes.length;
  message.set(channelBytes, offset); offset += channelBytes.length;
  message.set(privilegeBytes, offset);

  // Generate signature
  const encoder = new TextEncoder();
  const key1 = await hmacSign(encoder.encode(appCertificate), encoder.encode(channelName));
  const key2 = await hmacSign(key1, encoder.encode(uidStr));
  const signature = await hmacSign(key2, message);

  // Pack content
  const sigLenBytes = packUint16(signature.length);
  const contentLen = sigLenBytes.length + signature.length + 2 + message.length;
  const content = new Uint8Array(contentLen);
  offset = 0;
  
  content.set(sigLenBytes, offset); offset += sigLenBytes.length;
  content.set(signature, offset); offset += signature.length;
  content.set(packUint16(message.length), offset); offset += 2;
  content.set(message, offset);

  // Build final token
  const contentBase64 = bytesToBase64(content);
  const token = version + appId + contentBase64;
  
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelName, uid } = await req.json();
    
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    
    if (!appId) {
      throw new Error('AGORA_APP_ID not configured');
    }

    if (!channelName) {
      throw new Error('Channel name is required');
    }

    const userUid = uid || 0;
    const expireTime = Math.floor(Date.now() / 1000) + 3600; // Token valid for 1 hour

    let token = null;
    
    // If certificate is available, generate token
    if (appCertificate) {
      console.log('Generating RTC token with certificate');
      token = await generateRtcToken(appId, appCertificate, channelName, userUid, expireTime);
      console.log('Token generated successfully');
    } else {
      console.log('No certificate, using App ID only mode');
    }

    return new Response(
      JSON.stringify({
        appId,
        channelName,
        uid: userUid,
        token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
