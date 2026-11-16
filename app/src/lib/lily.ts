import { DEMO } from './demo';
import { supabase } from './supabase';
import { TopicPref } from './topics';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Suggestion = Partial<TopicPref> & { topic_id: string; reason?: string };
export type LilyReply = { reply: string; suggestions: Suggestion[]; sources: { title: string; url: string }[] };

export async function askLily(messages: ChatMessage[]): Promise<LilyReply> {
  if (DEMO) {
    return {
      reply: 'Demo mode: Lily needs the backend to answer. Here is what a topic suggestion looks like.',
      suggestions: [{ topic_id: 'fx-dollar', enabled: true, difficulty: 'intermediate', frequency: 'daily', custom_notes: 'focus on the yen and the euro', reason: 'demo' }],
      sources: [],
    };
  }
  const { data, error } = await supabase.functions.invoke('lily-chat', { body: { messages } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { reply: data.reply ?? '', suggestions: data.suggestions ?? [], sources: data.sources ?? [] };
}
