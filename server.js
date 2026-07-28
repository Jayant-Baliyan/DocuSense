const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

async function extractTextFromPdf(buffer) {
  try {
    const { default: pdf } = await import('pdf-parse');
    const data = await pdf(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

function generateMockAnalysis(text) {
  const cleanText = text.trim();
  const titleMatch = cleanText.split('\n')[0] || 'Document';
  const docTitle = titleMatch.length > 60 ? titleMatch.substring(0, 57) + '...' : titleMatch;
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const coreHighlights = sentences.slice(0, Math.min(sentences.length, 5));

  const insightsList = [
    { tag: 'Overview', title: 'Primary Summary', desc: 'The document begins by introducing key concepts and outlining structural context.' },
    { tag: 'Structure', title: 'Content Density', desc: `Contains approximately ${wordCount} words organized into distinct segments.` },
    { tag: 'Focus', title: 'Key Topic', desc: `Focuses on concepts surrounding "${docTitle}".` }
  ];

  const summaryMarkdown = `### Executive Summary
The document titled **${docTitle}** contains around **${wordCount} words** of raw text. 

Here are the primary highlights parsed from the content:
${coreHighlights.map(h => `* ${h}.`).join('\n')}

### Core Themes
1. **Introduction & Context**: Establishes the background and scope.
2. **Key Parameters**: Addresses operational or technical constraints.
3. **Synthesis & Outlook**: Provides conclusions and proposed actions.

> **Note**: This analysis was generated in *Demo Mock Mode*. Once an API key is provided, this tool will generate deep contextual summaries and insights powered by Gemini or Groq.`;

  return {
    summary: summaryMarkdown,
    insights: insightsList,
    isMock: true
  };
}

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1].startsWith('```')) lines.pop();
    cleaned = lines.join('\n').trim();
  }
  return cleaned;
}

async function callGemini(prompt, apiKey) {
  const ai = new GoogleGenerativeAI(apiKey);
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const model = ai.getGenerativeModel({ model: geminiModel });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  return result.response.text();
}

async function callGroq(prompt, apiKey) {
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function streamGemini(prompt, apiKey, res) {
  const ai = new GoogleGenerativeAI(apiKey);
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const model = ai.getGenerativeModel({ model: geminiModel });
  const resultStream = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  for await (const chunk of resultStream.stream) {
    res.write(chunk.text());
  }
}

async function streamOpenAICompatible(prompt, apiKey, endpoint, modelName, res) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep partial line

    for (const line of lines) {
      const cleanedLine = line.trim();
      if (!cleanedLine || cleanedLine === 'data: [DONE]') continue;
      if (cleanedLine.startsWith('data: ')) {
        try {
          const json = JSON.parse(cleanedLine.substring(6));
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            res.write(delta);
          }
        } catch (e) {
          // Ignore partial JSON parse errors
        }
      }
    }
  }
}

// Endpoint to analyze PDF/TXT files or raw text input
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    const textContent = req.body.text || '';
    const file = req.file;
    let text = textContent;

    if (file) {
      if (file.originalname.endsWith('.pdf')) {
        text = await extractTextFromPdf(file.buffer);
      } else if (file.originalname.endsWith('.txt')) {
        text = file.buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or TXT file.' });
      }
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'No text or file provided for analysis.' });
    }

    const geminiKey = process.env.GEMINI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';

    // Determine provider priority sequence
    const providersToTry = [];
    const mainPref = (process.env.AI_PROVIDER || '').toLowerCase();

    if (mainPref === 'groq' && groqKey) providersToTry.push({ name: 'groq', key: groqKey });
    else if (mainPref === 'gemini' && geminiKey) providersToTry.push({ name: 'gemini', key: geminiKey });

    if (geminiKey && !providersToTry.some(p => p.name === 'gemini')) providersToTry.push({ name: 'gemini', key: geminiKey });
    if (groqKey && !providersToTry.some(p => p.name === 'groq')) providersToTry.push({ name: 'groq', key: groqKey });

    if (providersToTry.length === 0) {
      const mockResult = generateMockAnalysis(text);
      return res.json({
        ...mockResult,
        provider: 'mock',
        text: text
      });
    }

    const prompt = `You are a professional document analyst. You are given the following document text:
---
${text.substring(0, 45000)}
---
Perform two tasks:
1. Provide an executive summary of the document in markdown format. Use sections like "Executive Summary" and "Core Themes", and include bullet points or quotes where appropriate.
2. Extract 4 to 6 key insights from the document. Format the response as a JSON array of insights with the keys "tag" (e.g. "Scope", "Metrics", "Requirement"), "title" (short title), and "desc" (1-2 sentences description).

Format your ENTIRE response as a valid JSON object matching the following structure exactly (do not output anything outside this JSON structure, do not include markdown code block tags around the JSON):
{
  "summary": "markdown_formatted_summary_here",
  "insights": [
    { "tag": "TAG1", "title": "TITLE1", "desc": "DESC1" },
    ...
  ]
}`;

    let responseText = '';
    let usedProvider = '';
    let lastError = null;

    for (const p of providersToTry) {
      try {
        if (p.name === 'gemini') {
          responseText = await callGemini(prompt, p.key);
        } else if (p.name === 'groq') {
          responseText = await callGroq(prompt, p.key);
        }
        usedProvider = p.name;
        break;
      } catch (err) {
        console.warn(`AI Provider '${p.name}' failed during analysis:`, err.message || err);
        lastError = err;
      }
    }

    if (!usedProvider) {
      throw lastError || new Error('All AI providers failed');
    }

    const cleanedResponse = cleanJsonResponse(responseText);
    const parsedData = JSON.parse(cleanedResponse);

    return res.json({
      summary: parsedData.summary,
      insights: parsedData.insights,
      isMock: false,
      provider: usedProvider,
      text: text
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred during analysis.',
      summary: '### Error Analysis\nAn error occurred while calling the AI API. Standard mockup fallback loaded.',
      insights: [
        { tag: 'Status', title: 'API Connection Error', desc: error.message || 'Verification of API keys failed.' }
      ]
    });
  }
});

// Endpoint to handle Q&A Chat Streaming
app.post('/api/chat/stream', async (req, res) => {
  const { text, question } = req.body;

  if (!text || !question) {
    return res.status(400).json({ error: 'Text and question are required' });
  }

  // Set Chunked Encoding Headers
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';

  // Determine provider priority sequence
  const providersToTry = [];
  const mainPref = (process.env.AI_PROVIDER || '').toLowerCase();

  if (mainPref === 'groq' && groqKey) providersToTry.push({ name: 'groq', key: groqKey });
  else if (mainPref === 'gemini' && geminiKey) providersToTry.push({ name: 'gemini', key: geminiKey });

  if (geminiKey && !providersToTry.some(p => p.name === 'gemini')) providersToTry.push({ name: 'gemini', key: geminiKey });
  if (groqKey && !providersToTry.some(p => p.name === 'groq')) providersToTry.push({ name: 'groq', key: groqKey });

  if (providersToTry.length === 0) {
    // Stream Mock Answer
    const cleanText = text.trim();
    const titleMatch = cleanText.split('\n')[0] || 'Document';
    const docTitle = titleMatch.length > 60 ? titleMatch.substring(0, 57) + '...' : titleMatch;
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const query = question.toLowerCase();
    const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const matchingSentences = sentences.filter(s => 
      s.toLowerCase().includes(query) || 
      query.split(' ').some(word => word.length > 4 && s.toLowerCase().includes(word))
    );

    let answer = '';
    if (matchingSentences.length > 0) {
      answer = `Based on the document, here is what I found regarding your question:\n\n` +
               matchingSentences.slice(0, 3).map(s => `* "${s}."`).join('\n') + 
               `\n\nIs there anything else you would like to know about this section?`;
    } else {
      answer = `I couldn't find an exact match for "${question}" in the document. However, here is general context:\n\nThe document contains ${wordCount} words and discusses topics related to **${docTitle}**. Could you try rephrasing your question or asking about key concepts mentioned in the text?`;
    }

    const words = answer.split(' ');
    for (let i = 0; i < words.length; i++) {
      res.write(words[i] + ' ');
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return res.end();
  }

  const prompt = `You are an AI document assistant. You have access to the following document text:
---
${text.substring(0, 45000)}
---
Using ONLY the context provided above, answer the user's question. If the answer cannot be found or inferred from the document text, politely state that you cannot find the answer in the document.

Question: ${question}
Answer:`;

  let streamSuccess = false;
  for (const p of providersToTry) {
    try {
      if (p.name === 'gemini') {
        await streamGemini(prompt, p.key, res);
      } else if (p.name === 'groq') {
        const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        await streamOpenAICompatible(prompt, p.key, "https://api.groq.com/openai/v1/chat/completions", groqModel, res);
      }
      streamSuccess = true;
      break;
    } catch (error) {
      console.warn(`Provider '${p.name}' streaming failed:`, error.message || error);
    }
  }

  if (!streamSuccess) {
    res.write(`\n⚠️ Error during AI streaming across all configured providers.`);
  }
  res.end();
});

app.listen(port, () => {
  console.log(`Backend server running on http://127.0.0.1:${port}`);
});
