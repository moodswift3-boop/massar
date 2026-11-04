const API_BASE = "https://api.json2video.com/v2/movies";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJson(response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return { message: raw.slice(0, 500) }; }
}

function splitNarration(value) {
  const parts = value.match(/[^.!?؟؛]+[.!?؟؛]?/g) || [value];
  const clean = parts.map(x => x.trim()).filter(Boolean);
  if (clean.length < 2) return [value];
  const groups = [[], [], [], []];
  clean.forEach((part, i) => groups[Math.min(3, Math.floor(i * 4 / clean.length))].push(part));
  return groups.map(x => x.join(" ")).filter(Boolean);
}

function resolutionFor(format) {
  if (format === "vertical") return "instagram-story";
  if (format === "square") return "squared";
  return "full-hd";
}

export default async function handler(req, res) {
  const apiKey = process.env.JSON2VIDEO_API_KEY;

  if (req.method === "GET" && req.query?.health === "1") {
    return send(res, 200, {
      ok: true,
      route: "swiftmedia-api",
      configured: Boolean(apiKey),
      provider: "JSON2Video",
      message: apiKey ? "تم إعداد مفتاح الخدمة على الخادم." : "مفتاح JSON2VIDEO_API_KEY غير مضبوط في Vercel."
    });
  }

  if (req.method === "GET") {
    if (!apiKey) return send(res, 503, { error: "server_not_configured", message: "مفتاح JSON2VIDEO_API_KEY غير مضبوط في Vercel." });
    const project = typeof req.query?.project === "string" ? req.query.project.trim() : "";
    if (!project || !/^[a-zA-Z0-9_-]{4,100}$/.test(project)) {
      return send(res, 400, { error: "invalid_project", message: "معرّف مشروع الفيديو غير صالح." });
    }
    try {
      const upstream = await fetch(API_BASE + "?project=" + encodeURIComponent(project), {
        headers: { "x-api-key": apiKey, "Accept": "application/json" }
      });
      const data = await readJson(upstream);
      if (!upstream.ok) return send(res, upstream.status >= 500 ? 502 : upstream.status, {
        error: "render_status_failed",
        message: data.message || data.error || "تعذر جلب حالة الإنتاج من JSON2Video."
      });
      const movie = data.movie || {};
      return send(res, 200, {
        project,
        status: movie.status || "unknown",
        url: movie.url || null,
        message: movie.message || "",
        progress: movie.progress ?? null
      });
    } catch {
      return send(res, 502, { error: "provider_unavailable", message: "تعذر الاتصال بخدمة JSON2Video أثناء متابعة الإنتاج." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method_not_allowed", message: "طريقة الطلب غير مدعومة." });
  }
  if (!apiKey) return send(res, 503, {
    error: "server_not_configured",
    message: "مفتاح JSON2VIDEO_API_KEY غير مضبوط في إعدادات Vercel. أضفه إلى Production ثم أعد النشر."
  });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
  const narration = typeof body.narration === "string" ? body.narration.trim().slice(0, 6000) : "";
  const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 120) : "المشاهد";
  const format = resolutionFor(body.format);
  const voiceTone = body.voice === "energetic" ? "ar-EG-SalmaNeural" : "ar-EG-SalmaNeural";

  if (!topic || !narration) return send(res, 400, {
    error: "missing_content",
    message: "أدخل عنوان الفيديو ونص التعليق الصوتي قبل بدء الإنتاج."
  });

  const segments = splitNarration(narration);
  const headings = ["الفكرة الأساسية", "لماذا تهمك؟", "خطوة عملية", "ابدأ الآن"];
  const colors = ["#07569a", "#0879a8", "#176f83", "#07569a"];
  const scenes = segments.map((segment, index) => ({
    "background-color": colors[index % colors.length],
    duration: Math.max(5, Math.min(18, Math.ceil(segment.length / 13) + 3)),
    elements: [
      {
        type: "text",
        text: index === 0 ? topic : headings[Math.min(index, headings.length - 1)],
        style: "001",
        duration: 4,
        position: "top-center",
        "font-size": 58,
        "font-color": "#ffffff"
      },
      {
        type: "text",
        text: segment,
        style: "001",
        duration: Math.max(5, Math.min(18, Math.ceil(segment.length / 13) + 3)),
        position: "center-center",
        "font-size": 42,
        "font-color": "#ffffff"
      },
      {
        type: "voice",
        text: segment,
        voice: voiceTone,
        model: "azure"
      },
      {
        type: "text",
        text: "مَسَار · خطوة صغيرة تصنع تقدمًا",
        style: "001",
        duration: 3,
        position: "bottom-center",
        "font-size": 26,
        "font-color": "#eaf7ff"
      }
    ]
  }));

  const movie = {
    resolution: format,
    quality: "medium",
    cache: true,
    comment: "SwiftMedia educational video for " + audience,
    scenes
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
        message: data.message || data.error || "لم تقبل خدمة JSON2Video سيناريو الفيديو."
      });
    }
    return send(res, 202, {
      success: true,
      project: data.project,
      status: "queued",
      scenes: scenes.length,
      message: "تم إرسال مشاهد الفيديو إلى محرك الإنتاج."
    });
  } catch {
    return send(res, 502, {
      error: "provider_unavailable",
      message: "تعذر الاتصال بخدمة JSON2Video. تحقق من إعدادات الخادم وحاول مجددًا."
    });
  }
}
