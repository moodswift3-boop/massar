// Vercel serverless endpoint for SwiftMedia.
const API_BASE = "https://api.json2video.com/v2";
function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}
async function readJson(response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : {}; } catch { return { message: raw.slice(0, 400) }; }
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET" && req.query?.health === "1") {
    return send(res, 200, { ok: true, service: "swiftmedia-video-api", configured: Boolean(process.env.JSON2VIDEO_API_KEY) });
  }
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) return send(res, 503, { error: "server_not_configured", message: "لم يصل مفتاح JSON2VIDEO_API_KEY إلى دالة Vercel المنشورة. تحقق من إعدادات المشروع وبيئة النشر ثم أعد النشر." });
  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const topic = String(body.topic || "").trim().slice(0, 180);
    const narration = String(body.narration || "").trim().slice(0, 8000);
    if (!topic || !narration) return send(res, 400, { error: "invalid_input", message: "أدخل عنوان الفيديو ونص التعليق الصوتي أولًا." });
    const format = body.format === "horizontal" ? "horizontal" : body.format === "square" ? "square" : "vertical";
    const movie = {
      resolution: format === "horizontal" ? "full-hd" : format === "square" ? "squared" : "instagram-story",
      quality: "medium",
      scenes: [
        { duration: 4, elements: [{ type: "text", text: topic, style: "001", position: "center" }] },
        { duration: 6, elements: [{ type: "text", text: "الفكرة الأساسية", style: "001", position: "top" }] },
        { duration: 5, elements: [{ type: "text", text: "خطوة صغيرة تبدأ بها اليوم", style: "001", position: "center" }] }
      ],
      elements: [
        { type: "voice", text: narration, voice: "ar-EG-SalmaNeural", model: "azure" },
        { type: "subtitles" }
      ],
      client_data: { app: "SwiftMedia", format }
    };
    try {
      const upstream = await fetch(API_BASE + "/movies", { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(movie) });
      const data = await readJson(upstream);
      if (!upstream.ok || !data.project) return send(res, 502, { error: "render_submit_failed", message: data.message || data.error || "رفض JSON2Video طلب الإنتاج.", provider_status: upstream.status });
      return send(res, 200, { success: true, project: data.project, status: "queued" });
    } catch { return send(res, 502, { error: "render_submit_failed", message: "تعذر الاتصال بخدمة JSON2Video. حاول مرة أخرى." }); }
  }
  if (req.method === "GET") {
    const project = String(req.query?.project || "").trim();
    if (!project || !/^[A-Za-z0-9_-]{4,100}$/.test(project)) return send(res, 400, { error: "invalid_project", message: "معرّف مشروع الفيديو غير صالح." });
    try {
      const upstream = await fetch(API_BASE + "/movies?project=" + encodeURIComponent(project), { headers: { "x-api-key": key } });
      const data = await readJson(upstream);
      if (!upstream.ok) return send(res, 502, { error: "render_status_failed", message: data.message || "تعذر قراءة حالة الفيديو.", provider_status: upstream.status });
      const movie = data.movie || data;
      return send(res, 200, { success: true, project, status: movie.status || "running", url: movie.url || null, message: movie.message || null });
    } catch { return send(res, 502, { error: "render_status_failed", message: "تعذر الاتصال بخدمة JSON2Video لمتابعة الفيديو." }); }
  }
  res.setHeader("Allow", "GET, POST, OPTIONS");
  return send(res, 405, { error: "method_not_allowed", message: "الطريقة غير مدعومة." });
}
