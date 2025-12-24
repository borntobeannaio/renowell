import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface Call {
  id: string;
  conversation_id: string | null;
  caller_id: string;
  channel_name: string;
  call_type: "video" | "audio";
  status: "ringing" | "active" | "ended";
  started_at: string;
  ended_at: string | null;
  created_at: string;
  caller?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string | null;
  left_at: string | null;
  status: "invited" | "joined" | "left" | "declined";
  created_at: string;
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export function useActiveCall() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: currentProfile } = useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: incomingCall } = useQuery({
    queryKey: ["incoming-call", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile) return null;
      
      // Check for calls where user is a participant with status 'invited'
      const { data: participations, error } = await supabase
        .from("call_participants")
        .select(`
          *,
          call:calls(
            *,
            caller:profiles!calls_caller_id_fkey(id, first_name, last_name, avatar_url)
          )
        `)
        .eq("user_id", currentProfile.id)
        .eq("status", "invited");
      
      if (error) throw error;
      
      // Filter for ringing calls
      const ringingCall = participations?.find(
        (p: any) => p.call?.status === "ringing"
      );
      
      if (ringingCall) {
        return {
          ...ringingCall.call,
          participantId: ringingCall.id,
        };
      }
      
      return null;
    },
    enabled: !!currentProfile,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  const { data: activeCall } = useQuery({
    queryKey: ["active-call", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile) return null;
      
      // Check for calls where user is caller or participant with status 'joined'
      const { data: callerCalls, error: callerError } = await supabase
        .from("calls")
        .select("*")
        .eq("caller_id", currentProfile.id)
        .eq("status", "active");
      
      if (callerError) throw callerError;
      if (callerCalls && callerCalls.length > 0) return callerCalls[0];
      
      const { data: participations, error } = await supabase
        .from("call_participants")
        .select(`
          *,
          call:calls(*)
        `)
        .eq("user_id", currentProfile.id)
        .eq("status", "joined");
      
      if (error) throw error;
      
      const activeParticipation = participations?.find(
        (p: any) => p.call?.status === "active"
      );
      
      return activeParticipation?.call || null;
    },
    enabled: !!currentProfile,
    refetchInterval: 2000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentProfile) return;

    const channel = supabase
      .channel("calls-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
          queryClient.invalidateQueries({ queryKey: ["active-call"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_participants" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
          queryClient.invalidateQueries({ queryKey: ["active-call"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProfile, queryClient]);

  return { incomingCall, activeCall, currentProfile };
}

export function useCreateCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      callerId,
      participantIds,
      callType,
    }: {
      conversationId?: string;
      callerId: string;
      participantIds: string[];
      callType: "video" | "audio";
    }) => {
      const channelName = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: call, error: callError } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId || null,
          caller_id: callerId,
          channel_name: channelName,
          call_type: callType,
          status: "ringing",
        })
        .select()
        .single();

      if (callError) throw callError;

      // Add participants
      const participantsToInsert = participantIds.map((userId) => ({
        call_id: call.id,
        user_id: userId,
        status: "invited" as const,
      }));

      const { error: participantsError } = await supabase
        .from("call_participants")
        .insert(participantsToInsert);

      if (participantsError) throw participantsError;

      return call;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
    },
  });
}

export function useAnswerCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, participantId }: { callId: string; participantId: string }) => {
      // Update call status to active
      const { error: callError } = await supabase
        .from("calls")
        .update({ status: "active" })
        .eq("id", callId);

      if (callError) throw callError;

      // Update participant status
      const { error: participantError } = await supabase
        .from("call_participants")
        .update({ status: "joined", joined_at: new Date().toISOString() })
        .eq("id", participantId);

      if (participantError) throw participantError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
    },
  });
}

export function useDeclineCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, participantId }: { callId: string; participantId?: string }) => {
      if (participantId) {
        const { error: participantError } = await supabase
          .from("call_participants")
          .update({ status: "declined" })
          .eq("id", participantId);

        if (participantError) throw participantError;
      }

      // Check if all participants declined
      const { data: participants } = await supabase
        .from("call_participants")
        .select("status")
        .eq("call_id", callId);

      const allDeclined = participants?.every((p) => p.status === "declined");

      if (allDeclined) {
        const { error: callError } = await supabase
          .from("calls")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", callId);

        if (callError) throw callError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
    },
  });
}

export function useEndCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from("calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-call"] });
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
    },
  });
}
