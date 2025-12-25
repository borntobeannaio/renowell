import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const CHANNEL_USERNAME = '@oparinandrey_renowell';

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    thumbnail?: {
      file_id: string;
    };
  };
}

interface TelegramUpdate {
  update_id: number;
  channel_post?: TelegramMessage;
}

async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const data = await response.json();
    
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
    }
    return null;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return null;
  }
}

async function getChannelMessages(): Promise<any[]> {
  try {
    // Get updates from the bot
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?allowed_updates=["channel_post"]&limit=50`
    );
    const data = await response.json();
    
    console.log('Telegram API response:', JSON.stringify(data, null, 2));
    
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return [];
    }
    
    const updates: TelegramUpdate[] = data.result || [];
    
    // Filter channel posts and transform them
    const posts = await Promise.all(
      updates
        .filter((update) => update.channel_post)
        .map(async (update) => {
          const post = update.channel_post!;
          let imageUrl: string | null = null;
          
          // Get the largest photo if available
          if (post.photo && post.photo.length > 0) {
            const largestPhoto = post.photo[post.photo.length - 1];
            imageUrl = await getFileUrl(largestPhoto.file_id);
          }
          
          // Get video thumbnail if available
          if (post.video?.thumbnail) {
            imageUrl = await getFileUrl(post.video.thumbnail.file_id);
          }
          
          return {
            id: post.message_id,
            text: post.text || post.caption || '',
            date: new Date(post.date * 1000).toISOString(),
            imageUrl,
            link: `https://t.me/oparinandrey_renowell/${post.message_id}`,
          };
        })
    );
    
    // Sort by date descending and take latest 20
    return posts
      .filter((post) => post.text || post.imageUrl)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    console.log('[telegram-channel] Fetching channel posts...');
    const posts = await getChannelMessages();
    console.log(`[telegram-channel] Found ${posts.length} posts`);

    return new Response(JSON.stringify({ posts }), {
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
