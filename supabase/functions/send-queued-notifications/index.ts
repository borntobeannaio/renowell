import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all queued notifications ready to send
    const { data: queued, error: fetchError } = await supabase
      .from("notifications")
      .select("id")
      .not("send_after", "is", null)
      .lte("send_after", new Date().toISOString())
      .eq("external_sent", false)
      .limit(200);

    if (fetchError) {
      console.error("Error fetching queued notifications:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!queued || queued.length === 0) {
      console.log("No queued notifications to send");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${queued.length} queued notifications`);

    let sent = 0;
    for (const notification of queued) {
      try {
        // Call send-external-notification for each
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-external-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ notification_id: notification.id }),
          }
        );

        if (response.ok) {
          // Mark as sent
          await supabase
            .from("notifications")
            .update({ external_sent: true })
            .eq("id", notification.id);
          sent++;
        } else {
          console.error(`Failed to send notification ${notification.id}:`, await response.text());
        }
      } catch (err) {
        console.error(`Error processing notification ${notification.id}:`, err);
      }
    }

    console.log(`Successfully sent ${sent}/${queued.length} queued notifications`);

    return new Response(
      JSON.stringify({ success: true, sent, total: queued.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-queued-notifications:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
