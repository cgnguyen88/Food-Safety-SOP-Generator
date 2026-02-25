export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: {
        message:
          "Server missing Anthropic key. Set ANTHROPIC_API_KEY (preferred) or VITE_ANTHROPIC_API_KEY in Vercel Environment Variables and redeploy.",
      },
    });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body || {}),
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: "Anthropic returned non-JSON response." }, raw: text.slice(0, 300) };
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: { message: err?.message || "Failed to reach Anthropic API." },
    });
  }
}
