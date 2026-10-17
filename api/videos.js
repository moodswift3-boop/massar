// Vercel serverless endpoint for SwiftMedia + JSON2Video.
// Configure JSON2VIDEO_API_KEY in Vercel Project Settings > Environment Variables.
// Never place the provider key in browser code or commit it to the repository.
const API_BASE = "https://api.json2video.com/v2/movies";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Same-origin deployment is recommended. Do not enable wildcard CORS for a secret-backed API.
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!process.env.JSON2VIDEO_API_KEY) {
    return json(res, 503, { error: "server_not_configured", message: "لم يتم إعداد مفتاح JSON2VIDEO_API_KEY في إعدادات الخادم." });
  }

  try {
    if (req.method === "POST") {
      const topic = clean(req.body && req.body.topic, 100);
      const narration = clean(req.body && req.body.narration, 1800);
      const format = clean(req.body && req.body.format, 20);
      if (!topic || !narration) return json(res, 400, { error: "missing_fields", message: "أرسل عنوان الفيديو ونص التعليق الصوتي." });
      if (!["vertical", "landscape", "square"].includes(format)) return json(res, 400, { error: "invalid_format", message: "مقاس الفيديو غير مدعوم." });

      const width = format === "vertical" ? 1080 : 1920;
      const height = format === "vertical" ? 1920 : format === "square" ? 1080 : 1080;
      const titleDuration = 5;
      const movie = {
        width, height, quality: "high", cache: true,
        scenes: [
          { duration: titleDuration, elements: [
            { type: "text", text: "SWIFTMEDIA", duration: titleDuration, style: "001", settings: { "font-family": "Arial", "font-size": format === "vertical" ? "72px" : "64px", "font-weight": "700", color: "#F3DCA8", "background-color": "#123F3C", "text-align": "center", "vertical-position": "top", "horizontal-position": "center" } },
            { type: "text", text: topic, duration: titleDuration, style: "001", settings: { "font-family": "Arial", "font-size": format === "vertical" ? "66px" : "58px", "font-weight": "700", color: "#FFFFFF", "background-color": "#176B62", "text-align": "center", "vertical-position": "center", "horizontal-position": "center" } }
          ]},
          { elements: [
            { type: "text", text: topic, duration: -2, style: "001", settings: { "font-family": "Arial", "font-size": format === "vertical" ? "54px" : "48px", "font-weight": "700", color: "#FFFFFF", "background-color": "#123F3C", "text-align": "center", "vertical-position": "top", "horizontal-position": "center" } },
            { type: "voice", text: narration, voice: "ar-EG-SalmaNeural", model: "azure" },
            { type: "subtitles", language: "ar", model: "default", settings: { "max-words-per-line": 5, "font-size": "48", "font-family": "Arial", "font-weight": "700", "style": "classic", "position": "bottom" } }
          ]}
        ]
      };

      const upstream = await fetch(API_BASE, {
        method: "POST",
        headers: { "x-api-key": process.env.JSON2VIDEO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(movie)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(res, upstream.status >= 500 ? 502 : upstream.status, { error: "render_submit_failed", message: data.message || "تعذر إرسال الفيديو إلى محرك الإنتاج." });
      return json(res, 202, { project: data.project, status: "queued", message: "تم إرسال طلب الفيديو إلى محرك الإنتاج." });
    }

    if (req.method === "GET") {
      const project = clean(req.query && req.query.project, 40);
      if (!/^[A-Za-z0-9_-]{8,40}$/.test(project)) return json(res, 400, { error: "invalid_project", message: "معرّف مشروع الفيديو غير صالح." });
      const upstream = await fetch(API_BASE + "?project=" + encodeURIComponent(project), {
        headers: { "x-api-key": process.env.JSON2VIDEO_API_KEY }
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(res, upstream.status >= 500 ? 502 : upstream.status, { error: "status_check_failed", message: data.message || "تعذر التحقق من حالة الفيديو." });
      const movie = data.movie || {};
      return json(res, 200, { project, status: movie.status || "unknown", url: movie.status === "done" ? movie.url : undefined, message: movie.message || "" });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "method_not_allowed", message: "الطريقة غير مدعومة." });
  } catch (error) {
    return json(res, 500, { error: "internal_error", message: "حدث خطأ داخلي أثناء معالجة طلب الفيديو." });
  }
};
