// A liveness check. It says nothing about the server's configuration, which is not public.
export default function handler(_req, res) {
  res.status(200).json({ ok: true, service: 'food-safety-sop-api', timestamp: new Date().toISOString() });
}
