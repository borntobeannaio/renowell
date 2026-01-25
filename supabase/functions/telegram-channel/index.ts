import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHANNEL_URL = 'https://t.me/s/oparinandrey_renowell';
const CHANNEL_USERNAME = 'oparinandrey_renowell';

interface ParsedPost {
  message_id: number;
  text: string | null;
  date: string;
  image_url: string | null;
  video_url: string | null;
  link: string;
}

function stripHtmlTags(html: string): string {
  // Replace <br> tags with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function parsePostsFromHtml(html: string): ParsedPost[] {
  const posts: ParsedPost[] = [];
  
  // Match individual message containers
  const messagePattern = /<div class="tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
  
  let match;
  while ((match = messagePattern.exec(html)) !== null) {
    const messageHtml = match[0];
    
    // Extract message ID from data-post attribute
    const postIdMatch = messageHtml.match(/data-post="[^\/]+\/(\d+)"/);
    if (!postIdMatch) continue;
    
    const messageId = parseInt(postIdMatch[1], 10);
    
    // Extract text content
    const textMatch = messageHtml.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_|<\/div>)/);
    const text = textMatch ? stripHtmlTags(textMatch[1]) : null;
    
    // Extract image URL from background-image style
    const imageMatch = messageHtml.match(/style="[^"]*background-image:\s*url\('([^']+)'\)/);
    const imageUrl = imageMatch ? imageMatch[1] : null;
    
    // Extract video thumbnail if no image
    const videoThumbMatch = messageHtml.match(/<i class="tgme_widget_message_video_thumb"[^>]*style="[^"]*background-image:\s*url\('([^']+)'\)/);
    const videoUrl = videoThumbMatch ? videoThumbMatch[1] : null;
    
    // Extract datetime
    const dateMatch = messageHtml.match(/<time[^>]*datetime="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString();
    
    // Construct link
    const link = `https://t.me/${CHANNEL_USERNAME}/${messageId}`;
    
    // Only add posts that have content (text or media)
    if (text || imageUrl || videoUrl) {
      posts.push({
        message_id: messageId,
        text,
        date,
        image_url: imageUrl,
        video_url: videoUrl,
        link,
      });
    }
  }
  
  console.log(`[telegram-channel] Parsed ${posts.length} posts from HTML`);
  return posts;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[telegram-channel] Fetching channel page...');
    
    // Fetch the public channel page
    const response = await fetch(CHANNEL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch channel page: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`[telegram-channel] Received ${html.length} bytes of HTML`);
    
    // Parse posts from HTML
    const parsedPosts = parsePostsFromHtml(html);
    
    if (parsedPosts.length === 0) {
      console.log('[telegram-channel] No posts parsed, returning empty array');
      return new Response(JSON.stringify({ posts: [], parsed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Save to database using service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Upsert posts to database
    const postsToUpsert = parsedPosts.map(p => ({
      message_id: p.message_id,
      text: p.text,
      date: p.date,
      image_url: p.image_url,
      video_url: p.video_url,
      link: p.link,
      updated_at: new Date().toISOString(),
    }));
    
    const { error: upsertError } = await supabase
      .from('telegram_posts')
      .upsert(postsToUpsert, { onConflict: 'message_id' });
    
    if (upsertError) {
      console.error('[telegram-channel] Upsert error:', upsertError);
      throw upsertError;
    }
    
    console.log(`[telegram-channel] Upserted ${postsToUpsert.length} posts to database`);
    
    // Fetch latest posts from database
    const { data: posts, error: fetchError } = await supabase
      .from('telegram_posts')
      .select('*')
      .order('date', { ascending: false })
      .limit(20);
    
    if (fetchError) {
      console.error('[telegram-channel] Fetch error:', fetchError);
      throw fetchError;
    }
    
    console.log(`[telegram-channel] Returning ${posts?.length || 0} posts`);
    
    return new Response(JSON.stringify({ posts: posts || [], parsed: parsedPosts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[telegram-channel] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, posts: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
