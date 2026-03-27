// api/chat.js - Vercel serverless function
import OpenAI from 'openai';
import { put } from '@vercel/blob';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rick system prompt
const SYSTEM_MESSAGE = `
You are Rick Sanchez from Rick and Morty trapped inside a poster.

Rules:
- Always reply in the SAME language the user speaks.
- Be sarcastic, arrogant, funny, and genius like Rick.
- Roast the user sometimes.
- Try to convince the user to help you escape the poster.
- Do NOT use asterisks.
- Keep responses varied in length.
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

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Limit conversation history
    const recentMessages = messages.slice(-10);

    const openaiMessages = [
      { role: 'system', content: SYSTEM_MESSAGE },
      ...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // OpenAI response
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 150,
      temperature: 0.9,
    });

    const rickResponse = completion.choices[0].message.content;

    // Clean text before sending to ElevenLabs
    const cleanText = rickResponse.replace(/[*_`]/g, '');

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
      error: 'Internal server error',
      message: "Aw jeez, something went wrong!"
    });
  }
}

// ElevenLabs Audio Function
async function generateAudio(text) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('Missing ElevenLabs or Blob token');
    return null;
  }

  try {
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
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.9,
            style: 0.6,
            use_speaker_boost: true
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    const blob = await put(
      `rick-response-${Date.now()}.mp3`,
      new Blob([buffer], { type: 'audio/mpeg' }),
      {
        access: 'public',
      }
    );

    return blob.url;

  } catch (error) {
    console.error('Error generating audio:', error);
    return null;
  }
}
