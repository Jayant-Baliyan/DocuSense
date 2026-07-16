import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple check for API key
const getApiKey = () => {
  return process.env.GEMINI_API_KEY || '';
};

// Helper to parse PDF text on the server
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

// Smart Mock Generator that analyzes the text to return custom summaries/insights
function generateMockResponse(text: string, action: string, question?: string) {
  const cleanText = text.trim();
  const titleMatch = cleanText.split('\n')[0] || 'Document';
  const docTitle = titleMatch.length > 60 ? titleMatch.substring(0, 57) + '...' : titleMatch;
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  
  if (action === 'qa' && question) {
    const query = question.toLowerCase();
    // Search the text for keywords from the question
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

    return {
      answer,
      isMock: true
    };
  }

  // Generate Summary and Key Insights
  // 1. Extract some sentences for summary
  const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const coreHighlights = sentences.slice(0, Math.min(sentences.length, 5));
  
  // 2. Identify key entities/insights (sentences with numbers, project, important, results)
  const insightsList: Array<{ tag: string; title: string; desc: string }> = [];
  
  const keywords = [
    { key: 'project', tag: 'Scope', title: 'Project Definition' },
    { key: 'relev', tag: 'Context', title: 'Relevance Analysis' },
    { key: 'system', tag: 'Architecture', title: 'System details' },
    { key: 'result', tag: 'Outcome', title: 'Key Outcome' },
    { key: 'cost', tag: 'Financial', title: 'Cost Analysis' },
    { key: 'percent', tag: 'Metrics', title: 'Quantitative Data' },
    { key: '%', tag: 'Metrics', title: 'Quantitative Data' },
    { key: 'must', tag: 'Requirement', title: 'Action Item' },
    { key: 'need', tag: 'Requirement', title: 'Action Item' },
    { key: 'should', tag: 'Recommendation', title: 'Best Practice' }
  ];

  for (const sentence of sentences) {
    if (insightsList.length >= 6) break;
    for (const kw of keywords) {
      if (sentence.toLowerCase().includes(kw.key) && sentence.length > 25 && sentence.length < 150) {
        // Avoid duplicate titles
        if (!insightsList.some(item => item.title === kw.title)) {
          insightsList.push({
            tag: kw.tag,
            title: kw.title,
            desc: sentence + '.'
          });
          break;
        }
      }
    }
  }

  // Default insights if we didn't find enough
  if (insightsList.length < 3) {
    insightsList.push(
      { tag: 'Overview', title: 'Primary Summary', desc: 'The document begins by introducing key concepts and outlining structural context.' },
      { tag: 'Structure', title: 'Content Density', desc: `Contains approximately ${wordCount} words organized into distinct segments.` },
      { tag: 'Focus', title: 'Key Topic', desc: `Focuses on concepts surrounding "${docTitle}".` }
    );
  }

  // Build markdown summary
  const summaryMarkdown = `### Executive Summary
The document titled **${docTitle}** contains around **${wordCount} words** of raw text. 

Here are the primary highlights parsed from the content:
${coreHighlights.map(h => `* ${h}.`).join('\n')}

### Core Themes
Based on an initial scan, the document centers around the following structure:
1. **Introduction & Context**: Establishes the background and scope.
2. **Key Parameters**: Addresses operational or technical constraints.
3. **Synthesis & Outlook**: Provides conclusions and proposed actions.

> **Note**: This analysis was generated in *Demo Mock Mode*. Once a Gemini API key is provided in your \`.env.local\`, this tool will generate deep contextual summaries and insights powered by Gemini.`;

  return {
    summary: summaryMarkdown,
    insights: insightsList,
    isMock: true
  };
}

// Helper to clean response JSON if wrapped in markdown code blocks
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleaned = lines.join('\n').trim();
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = formData.get('action') as string || 'analyze';
    const textContent = formData.get('text') as string || '';
    const question = formData.get('question') as string || '';
    const file = formData.get('file') as File | null;

    let text = textContent;

    // 1. If file is uploaded, extract its text content
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (file.name.endsWith('.pdf')) {
        text = await extractTextFromPdf(buffer);
      } else if (file.name.endsWith('.txt')) {
        text = buffer.toString('utf-8');
      } else {
        return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or TXT file.' }, { status: 400 });
      }
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'No text or file provided for analysis.' }, { status: 400 });
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

    // 2. If no API Key is available, return mock analysis response
    if (provider === 'mock') {
      const mockResult = generateMockResponse(text, action, question);
      return NextResponse.json({
        ...mockResult,
        provider: 'mock',
        text: action === 'analyze' ? text : undefined // Send back parsed text on initial load
      });
    }

    let responseText = '';

    if (provider === 'grok') {
      const prompt = action === 'qa'
        ? `You are an AI document assistant. You have access to the following document text:
---
${text.substring(0, 45000)}
---
Using ONLY the context provided above, answer the user's question. If the answer cannot be found or inferred from the document text, politely state that you cannot find the answer in the document.

Question: ${question}
Answer:`
        : `You are a professional document analyst. You are given the following document text:
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

      const grokModel = process.env.GROK_MODEL || 'grok-4.5';
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${xaiKey}`
        },
        body: JSON.stringify({
          model: grokModel,
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || '';
    } else {
      // Use real Gemini SDK
      const ai = new GoogleGenerativeAI(geminiKey);
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const model = ai.getGenerativeModel({ model: geminiModel });

      if (action === 'qa') {
        const prompt = `You are an AI document assistant. You have access to the following document text:
---
${text.substring(0, 45000)}
---
Using ONLY the context provided above, answer the user's question. If the answer cannot be found or inferred from the document text, politely state that you cannot find the answer in the document.

Question: ${question}
Answer:`;

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        responseText = result.response.text();
      } else {
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

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        responseText = result.response.text();
      }
    }

    if (action === 'qa') {
      return NextResponse.json({
        answer: responseText,
        isMock: false,
        provider
      });
    } else {
      const cleanedResponse = cleanJsonResponse(responseText);
      const parsedData = JSON.parse(cleanedResponse);
      return NextResponse.json({
        summary: parsedData.summary,
        insights: parsedData.insights,
        isMock: false,
        provider,
        text: text // Send back parsed text on initial load
      });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    // Determine provider fallback
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const xaiKey = process.env.XAI_API_KEY || '';
    let provider: 'gemini' | 'grok' | 'mock' = 'mock';
    if (xaiKey) provider = 'grok';
    else if (geminiKey) provider = 'gemini';

    return NextResponse.json({ 
      error: error.message || 'An error occurred during analysis.',
      isMock: true,
      provider,
      // fallback in case of API failure
      summary: '### Error Analysis\nAn error occurred while calling the AI API. Standard mockup fallback loaded.',
      insights: [
        { tag: 'Status', title: 'API Connection Error', desc: error.message || 'Verification of API keys failed.' }
      ]
    }, { status: 500 });
  }
}
