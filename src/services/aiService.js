const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const askAiAssistant = async (chatMessages) => {
  if (!GEMINI_API_KEY) {
    console.error("VITE_GEMINI_API_KEY is missing from your .env file!");
    return "API key not found. Please check your .env file and restart npm run dev.";
  }

  const systemInstruction = {
    parts: [
      { text: "You are Meta AI in svpp-chat, an advanced real-time messenger built with React and Supabase. Answer all user questions accurately, politely, and concisely in whatever language the user speaks." }
    ]
  };

  const contents = chatMessages.map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }]
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents: contents
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Gemini API Error Details:", data);
      return `API Error (${response.status}): ${data?.error?.message || 'Check browser console for details.'}`;
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || "I couldn't generate a response right now. Please try again!";
  } catch (err) {
    console.error('Network or Fetch Error:', err);
    return "Sorry, I encountered a network connection issue. Check your internet connection.";
  }
};