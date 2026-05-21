import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const geminiService = {
  async translateChat(text: string, targetLang: 'th' | 'ko'): Promise<string> {
    const prompt = `Translate the following casual chat message to ${targetLang === 'th' ? 'Thai' : 'Korean'}. 
    Keep the tone natural and appropriate for a social dating app. 
    Message: "${text}"`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || text;
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  },

  async getIcebreakers(interests: string[], nationality: 'TH' | 'KR'): Promise<string[]> {
    const prompt = `Generate 3 creative icebreakers for a ${nationality === 'TH' ? 'Thai' : 'Korean'} person 
    interested in ${interests.join(', ')}. 
    The icebreakers should be in ${nationality === 'TH' ? 'Korean' : 'Thai'} (the target person's language) with translations.
    Format as a list of strings.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Icebreaker error:", error);
      return [];
    }
  },

  async checkScam(text: string): Promise<{ isSafe: boolean; reason?: string }> {
    const prompt = `Analyze this chat message for potential scams, suspicious behavior, or phishing in a dating context.
    Message: "${text}"
    Return JSON with isSafe (boolean) and reason (string if unsafe).`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSafe: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text || '{"isSafe":true}');
    } catch (error) {
      return { isSafe: true };
    }
  },
  
  async getReplySuggestions(topic: any, userProfile: any): Promise<{ style: string; text: string }[]> {
    const prompt = `[ROLE]
You are a social interaction expert.

[CONTEXT]
A user wants to reply to a topic.

[INPUT]
Topic: ${JSON.stringify(topic)}
User: ${JSON.stringify(userProfile)}

[TASK]
Generate 3 reply suggestions in English:
- friendly
- playful
- direct

[CONSTRAINT]
- Short and natural
- Encourage further conversation

[OUTPUT FORMAT]
[
  {"style":"friendly","text":"..."},
  {"style":"playful","text":"..."},
  {"style":"direct","text":"..."}
]`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                style: { type: Type.STRING },
                text: { type: Type.STRING }
              }
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Reply suggestions error:", error);
      return [];
    }
  },

  async translatePost(text: string, lang: 'TH' | 'KR' | 'EN'): Promise<string> {
    const prompt = `[ROLE]
You are a Thai-Korean translator for social community posts.

[CONTEXT]
Topics are casual and friendly.

[INPUT]
Text: ${text}
Target language: ${lang}

[TASK]
Translate naturally (not literal), keep friendly tone.

[OUTPUT FORMAT]
{
  "translated": "..."
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translated: { type: Type.STRING }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{"translated":""}');
      return data.translated || text;
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  },

  async checkTopicSafety(topic: string, profile: any): Promise<{ status: 'normal' | 'spam' | 'scam' | 'inappropriate'; reasons: string[] }> {
    const prompt = `[ROLE]
You are a safety AI for a dating community.

[INPUT]
Topic: ${topic}
User profile: ${JSON.stringify(profile)}

[TASK]
Detect if the topic is:
- normal
- spam
- scam
- inappropriate

Explain why.

[OUTPUT FORMAT]
{
  "status": "normal | spam | scam | inappropriate",
  "reasons": ["..."]
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      return JSON.parse(response.text || '{"status":"normal", "reasons":[]}');
    } catch (error) {
      console.error("Safety check error:", error);
      return { status: "normal", reasons: [] };
    }
  },

  async generateInvitation(topic: any, userProfile: any): Promise<string> {
    const prompt = `[ROLE]
You are a growth expert for social apps.

[CONTEXT]
We want to invite users to join a topic.

[INPUT]
Topic: ${JSON.stringify(topic)}
User: ${JSON.stringify(userProfile)}

[TASK]
Generate a short notification message that:
- Feels personal
- Encourages joining
- Matches user's interest

[CONSTRAINT]
- Max 20 words
- Friendly tone
- Not spammy

[OUTPUT FORMAT]
{
  "message": "..."
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{"message":"Hey, saw a post you might like!"}');
      return data.message || "Hey, check out this post!";
    } catch (error) {
      return "Hey, check out this post!";
    }
  },

  async calculateMatchScore(topic: any, userProfile: any): Promise<{ score: number; reason: string }> {
    const prompt = `[ROLE]
You are a matching AI for a social dating platform.

[CONTEXT]
We want to recommend users who are most likely to join a topic.

[INPUT]
Topic: ${JSON.stringify(topic)}
User: ${JSON.stringify(userProfile)}

[TASK]
Evaluate how well the user matches this topic based on:
- interests
- language
- intent
- location

Score from 0-100 and explain briefly.

[CONSTRAINT]
- Be practical and realistic
- Avoid bias

[OUTPUT FORMAT]
{
  "score": number,
  "reason": "..."
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text || '{"score":0, "reason":"Failed to calculate score"}');
    } catch (error) {
      console.error("Match score error:", error);
      return { score: 0, reason: "Error in calculation" };
    }
  },

  async classifyTopic(text: string): Promise<string> {
    const prompt = `[ROLE]
You are an AI classifier for community topics.

[INPUT]
Topic: ${text}

[TASK]
Classify the topic into one category:
- dating
- friend
- language
- event

[CONSTRAINT]
- Choose only ONE category
- Base on intent, not keywords only

[OUTPUT FORMAT]
{
  "category": "dating | friend | language | event"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{"category":"friend"}');
      return data.category || "friend";
    } catch (error) {
      return "friend";
    }
  },
  
  async rewriteTopic(userInput: string, profile: any): Promise<{ title: string; description: string; intent: string }> {
    const prompt = `[ROLE]
You are a social community expert for a Thai-Korean dating platform.

[CONTEXT]
Users create topics to find friends, dates, or language exchange partners.

[INPUT]
Raw topic: ${userInput}
User profile: ${JSON.stringify(profile)}

[TASK]
Rewrite the topic to be:
- More engaging and natural
- Friendly and inviting
- Clear intent (dating, friend, language, event)

[CONSTRAINT]
- Keep original meaning
- Avoid exaggeration or fake tone
- Make it suitable for cross-cultural communication (Thai-Korean)

[OUTPUT FORMAT]
{
  "title": "...",
  "description": "...",
  "intent": "dating | friend | language | event"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              intent: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Rewrite error:", error);
      return { title: "", description: userInput, intent: "friend" };
    }
  }
};
