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

    // Get last user message
    const lastUserMessage = recentMessages
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    // Language instruction
    const languageInstruction = `
Reply in the same language as this message:
"${lastUserMessage}"
`;

    const openaiMessages = [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'system', content: languageInstruction },
      ...recentMessages
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 150,
      temperature: 0.9,
    });

    const rickResponse = completion.choices[0].message.content;
    const cleanText = rickResponse.replace(/[*_]/g, '');

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

async function generateAudio(text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
      }),
    }
  );

  const buffer = await response.arrayBuffer();

  const blob = await put(
    `rick-response-${Date.now()}.mp3`,
    new Blob([buffer], { type: 'audio/mpeg' }),
    { access: 'public' }
  );

  return blob.url;
}
