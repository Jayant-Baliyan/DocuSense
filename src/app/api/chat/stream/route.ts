import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, question } = body;

    if (!text || !question) {
      return NextResponse.json({ error: 'Text and question are required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY || '';
    const xaiKey = process.env.XAI_API_KEY || '';

    // Determine provider
    let provider: 'gemini' | 'grok' | 'mock' = 'mock';
    if (process.env.AI_PROVIDER === 'grok' && xaiKey) {
      provider = 'grok';
    } else if (process.env.AI_PROVIDER === 'gemini' && geminiKey) {
      provider = 'gemini';
    } else if (xaiKey) {
      provider = 'grok';
    } else if (geminiKey) {
      provider = 'gemini';
    }

    if (provider === 'mock') {
      const cleanText = text.trim();
      const titleMatch = cleanText.split('\n')[0] || 'Document';
      const docTitle = titleMatch.length > 60 ? titleMatch.substring(0, 57) + '...' : titleMatch;
      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
      const query = question.toLowerCase();
      const sentences = cleanText.split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean);
      const matchingSentences = sentences.filter((s: string) => 
        s.toLowerCase().includes(query) || 
        query.split(' ').some((word: string) => word.length > 4 && s.toLowerCase().includes(word))
      );

      let answer = '';
      if (matchingSentences.length > 0) {
        answer = `Based on the document, here is what I found regarding your question:\n\n` +
                 matchingSentences.slice(0, 3).map((s: string) => `* "${s}."`).join('\n') + 
                 `\n\nIs there anything else you would like to know about this section?`;
      } else {
        answer = `I couldn't find an exact match for "${question}" in the document. However, here is general context:\n\nThe document contains ${wordCount} words and discusses topics related to **${docTitle}**. Could you try rephrasing your question or asking about key concepts mentioned in the text?`;
      }

      const encoder = new TextEncoder();
      const words = answer.split(' ');

      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < words.length; i++) {
            controller.enqueue(encoder.encode(words[i] + ' '));
            await new Promise(resolve => setTimeout(resolve, 40));
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        }
      });
    }

    const prompt = `You are an AI document assistant. You have access to the following document text:
---
${text.substring(0, 45000)}
---
Using ONLY the context provided above, answer the user's question. If the answer cannot be found or inferred from the document text, politely state that you cannot find the answer in the document.

Question: ${question}
Answer:`;

    const encoder = new TextEncoder();

    if (provider === 'grok') {
      const grokModel = process.env.GROK_MODEL || 'grok-4.5';
      const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${xaiKey}`
        },
        body: JSON.stringify({
          model: grokModel,
          messages: [{ role: "user", content: prompt }],
          stream: true
        })
      });

      if (!grokRes.ok) {
        const errText = await grokRes.text();
        throw new Error(`Grok API error (${grokRes.status}): ${errText}`);
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = grokRes.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const cleanedLine = line.trim();
              if (!cleanedLine || cleanedLine === 'data: [DONE]') continue;
              if (cleanedLine.startsWith('data: ')) {
                try {
                  const json = JSON.parse(cleanedLine.substring(6));
                  const delta = json.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    controller.enqueue(encoder.encode(delta));
                  }
                } catch (e) {
                  // Ignore JSON parse errors for partial chunks
                }
              }
            }
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    } else {
      // Gemini streaming
      const ai = new GoogleGenerativeAI(geminiKey);
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const model = ai.getGenerativeModel({ model: geminiModel });
      const resultStream = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText));
            }
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

  } catch (error: any) {
    console.error('Chat stream error:', error);
    return NextResponse.json({ error: error.message || 'Failed to stream Q&A response' }, { status: 500 });
  }
}
