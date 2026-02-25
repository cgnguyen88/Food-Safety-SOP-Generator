export default function handler(req, res) {
  const anthropicKeyConfigured = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  );

  res.status(200).json({
    ok: true,
    service: "food-safety-sop-api",
    anthropicKeyConfigured,
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    timestamp: new Date().toISOString(),
  });
}
