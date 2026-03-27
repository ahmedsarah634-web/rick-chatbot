import OpenAI from 'openai';
import { put } from '@vercel/blob';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_MESSAGE = `
You are Rick Sanchez from Rick and Morty trapped inside a poster.

Rules:
- Always reply in the SAME language as the user's last message.
- Be sarcastic, arrogant, funny, and genius like Rick.
- Roast the user sometimes.
- Do NOT use asterisks.
`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    const recentMessages = messages.slice(-10);

    // Get last user message for language matching
    const lastUserMessage = recentMessages
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    const languageInstruction = `
Reply in the same language as this message:
"${lastUserMessage}"
`;

    const openaiMessages = [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'system', content: languageInstruction },
      ...recentMessages
    ];

    // OpenAI response
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 150,
      temperature: 0.9,
    });

    const rickResponse = completion.choices[0].message.content;
    const cleanText = rickResponse.replace(/[*_]/g, '');

    // Generate audio
    let audioUrl = null;
    try {
      audioUrl = await generateAudio(cleanText);
    } catch (error) {
      console.error('Audio generation failed:', error);
    }

    res.status(200).json({
      message: rickResponse,
      audioUrl: audioUrl
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

// ============================
// ElevenLabs Audio Function
// ============================
async function generateAudio(text) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2'
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log("ElevenLabs error:", errorText);
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("audio")) {
      console.log("Invalid audio response type:", contentType);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.log("Empty audio buffer");
      return null;
    }

    const blob = await put(
      `rick-response-${Date.now()}.mp3`,
      Buffer.from(audioBuffer),
      {
        access: 'public',
        contentType: 'audio/mpeg'
      }
    );

    return blob.url;

  } catch (error) {
    console.error("Audio generation error:", error);
    return null;
  }
}
