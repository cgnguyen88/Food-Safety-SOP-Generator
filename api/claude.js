async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: {
        message: "Server missing OPENROUTER_KEY. Set it in Vercel Environment Variables and redeploy.",
      },
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body?.messages || !Array.isArray(body.messages)) {
      res.status(400).json({
        error: { message: "Invalid request body: missing messages array." },
      });
      return;
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://food-safety-sop-generator.vercel.app",
        "X-Title": "Food Safety SOP Generator",
      },
      body: JSON.stringify(body),
    });

    if (body.stream && upstream.ok) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.status(upstream.status);

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
      return;
    }

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: "OpenRouter returned non-JSON response." }, raw: text.slice(0, 300) };
    }

    if (upstream.ok && !data?.error) {
      res.status(200).json(data);
      return;
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: { message: err?.message || "Failed to reach OpenRouter API." },
    });
  }
}
