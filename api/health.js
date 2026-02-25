export default function handler(req, res) {
  const anthropicKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const defaultModel = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const envCandidates = (process.env.ANTHROPIC_MODEL_CANDIDATES || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const blockedModels = ["claude-3-7-sonnet-latest"];
  const modelCandidates = [
    ...new Set([
      defaultModel,
      ...envCandidates,
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-sonnet-4-0",
    ]),
  ].filter((m) => !blockedModels.includes(m));

  res.status(200).json({
    ok: true,
    service: "food-safety-sop-api",
    anthropicKeyConfigured,
    anthropicModelDefault: defaultModel,
    anthropicModelCandidates: modelCandidates,
    blockedModels,
    modelDebug:
      "For runtime selection, call /api/claude and inspect response _debug.modelUsed or header x-anthropic-model-used.",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    timestamp: new Date().toISOString(),
  });
}
