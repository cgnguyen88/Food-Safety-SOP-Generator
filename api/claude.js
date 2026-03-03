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

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
const ENV_MODEL_CANDIDATES = (process.env.ANTHROPIC_MODEL_CANDIDATES || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const MODEL_CANDIDATES = [
  DEFAULT_MODEL,
  ...ENV_MODEL_CANDIDATES,
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-haiku-20240307",
  "claude-sonnet-4-0",
];
const BLOCKED_MODELS = new Set(["claude-3-7-sonnet-latest"]);

function isModelError(status, data) {
  const code = (data?.error?.type || data?.error?.code || "").toLowerCase();
  const message = (data?.error?.message || "").toLowerCase();
  return status === 404 || code.includes("model") || message.includes("model");
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

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: {
        message: "Server missing Anthropic key. Set ANTHROPIC_API_KEY in Vercel Environment Variables and redeploy.",
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

    const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
    const modelCandidates = [
      ...new Set(
        [
          requestedModel && !BLOCKED_MODELS.has(requestedModel) ? requestedModel : "",
          ...MODEL_CANDIDATES,
        ].filter(Boolean)
      ),
    ];

    let finalStatus = 500;
    let finalData = { error: { message: "Anthropic request failed." } };
    let modelUnavailableCount = 0;

    for (const model of modelCandidates) {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: body.stream ? "text/event-stream" : "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...body, model }),
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
        data = { error: { message: "Anthropic returned non-JSON response." }, raw: text.slice(0, 300) };
      }

      finalStatus = upstream.status;
      finalData = data;

      if (upstream.ok && !data?.error) {
        res.setHeader("x-anthropic-model-used", model);
        data._debug = { ...(data._debug || {}), modelUsed: model };
        res.status(200).json(data);
        return;
      }

      if (isModelError(upstream.status, data)) {
        modelUnavailableCount += 1;
        continue;
      }

      res.status(upstream.status).json(data);
      return;
    }

    if (modelUnavailableCount >= modelCandidates.length) {
      res.status(400).json({
        error: {
          message:
            `No available model from candidates: ${modelCandidates.join(", ")}. ` +
            "Set ANTHROPIC_MODEL in Vercel Environment Variables to a model your account can access.",
        },
      });
      return;
    }

    res.status(finalStatus).json(finalData);
  } catch (err) {
    res.status(500).json({
      error: { message: err?.message || "Failed to reach Anthropic API." },
    });
  }
}
