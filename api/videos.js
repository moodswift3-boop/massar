const API_BASE = "https://api.json2video.com/v2/movies";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getApiKey() {
  return process.env.JSON2VIDEO_API_KEY;
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { message: text.slice(0, 500) }; }
}

export default async function handler(req, res) {
  const apiKey = getApiKey();

  if (req.method === "GET" && req.query?.health === "1") {
    return send(res, 200, {
      ok: true,
      route: "swiftmedia-api",
      configured: Boolean(apiKey),
      message: apiKey ? "API key is configured." : "JSON2VIDEO_API_KEY is not configured for this deployment."
    });
  }

  if (!apiKey) {
    return send(res, 503, {
      error: "server_not_configured",
      message: "لم يتم إعداد JSON2VIDEO_API_KEY في بيئة Vercel الخاصة بهذا النشر."
    });
  }

  if (req.method === "GET") {
    const project = typeof req.query?.project === "string" ? req.query.project.trim() : "";
    if (!project || !/^[a-zA-Z0-9_-]{4,100}$/.test(project)) {
      return send(res, 400, { error: "invalid_project", message: "معرّف المشروع غير صالح أو غير موجود." });
    }
    try {
      const upstream = await fetch(API_BASE + "?project=" + encodeURIComponent(project), {
        method: "GET",
        headers: { "x-api-key": apiKey, "Accept": "application/json" }
      });
      const data = await readJson(upstream);
      if (!upstream.ok) {
        return send(res, upstream.status >= 500 ? 502 : upstream.status, {
          error: "render_status_failed",
          message: data.message || data.error || "تعذر الحصول على حالة الفيديو من JSON2Video."
        });
      }
      const movie = data.movie || {};
      return send(res, 200, {
        project,
        status: movie.status || "unknown",
        url: movie.url || null,
        message: movie.message || "",
        progress: movie.progress ?? null
      });
    } catch {
      return send(res, 502, { error: "provider_unavailable", message: "تعذر الاتصال بخدمة JSON2Video. حاول مرة أخرى." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method_not_allowed", message: "الطريقة غير مدعومة." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
  const narration = typeof body.narration === "string" ? body.narration.trim().slice(0, 6000) : "";
  const format = body.format === "vertical" ? "instagram-story" : "full-hd";

  if (!topic || !narration) {
    return send(res, 400, { error: "missing_content", message: "أدخل عنوان الفيديو ونص التعليق الصوتي أولًا." });
  }

  const movie = {
    resolution: format,
    scenes: [{
      elements: [
        {
          type: "text",
          text: topic,
          style: "001",
          duration: 4,
          position: "center-center"
        },
        {
          type: "voice",
          text: narration,
          voice: "ar-EG-SalmaNeural",
          model: "azure"
        },
        {
          type: "subtitles",
          language: "ar",
          model: "default",
          settings: {
            "max-words-per-line": 5,
            "font-size": 54,
            "font-weight": "700",
            "all-caps": false,
            "position": "bottom-center",
            "style": "classic",
            "outline-color": "#123d68",
            "outline-width": 3
          }
        }
      ]
    }]
  };

  try {
    const upstream = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(movie)
    });
    const data = await readJson(upstream);
    if (!upstream.ok || !data.project) {
      return send(res, upstream.status >= 500 ? 502 : (upstream.status || 502), {
        error: "render_submit_failed",
        message: data.message || data.error || "رفضت JSON2Video طلب إنشاء الفيديو. تحقق من المفتاح وصلاحيات الحساب."
      });
    }
    return send(res, 202, { success: true, project: data.project, status: "queued" });
  } catch {
    return send(res, 502, {
      error: "provider_unavailable",
      message: "تعذر الاتصال بخدمة JSON2Video. تحقق من الاتصال وحاول مرة أخرى."
    });
  }
}
