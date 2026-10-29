const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try {
    await page.goto("http://127.0.0.1:4173/index.html", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    // Homepage renders five paths and the progress indicator.
    assert.equal(await page.locator("#pathGrid .path-card").count(), 5, "homepage should show five paths");
    assert.ok(await page.locator('[role="progressbar"]').count(), "accessible progress bar should exist");

    // Open a unit, save a worksheet, complete it, then reload to prove persistence.
    await page.locator('[data-path="N1"]').click();
    await page.locator('[data-open-unit="N1|0"]').click();
    await page.locator('[data-ws-field="goal"]').fill("أخصص عشر دقائق للتدرب هذا الأسبوع");
    await page.locator('[data-ws-field="step"]').fill("أحدد موعدًا اليوم وأجهز الأدوات");
    const savedWorksheet = await page.evaluate(() => JSON.parse(localStorage.getItem("massar-worksheet-N1.1")));
    assert.equal(savedWorksheet.goal, "أخصص عشر دقائق للتدرب هذا الأسبوع", "worksheet should save to localStorage");
    await page.locator('[id="complete-N1.1"]').click();
    const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem("massar-progress-v2")));
    assert.equal(savedProgress["N1.1"], true, "completed unit should persist");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#doneCount").textContent(), "١", "progress count should survive reload");

    // Search and unit opening must work after rerendering the cards.
    await page.locator("#search").fill("الحدود الشخصية");
    assert.equal(await page.locator('[data-open-unit="N2|2"]').count(), 1, "search should expose matching unit");
    await page.locator('[data-open-unit="N2|2"]').click();
    assert.ok(await page.locator("#unitDetail").innerText().then(t => t.includes("الحدود الشخصية")), "search result should open the correct unit");

    // Visual library exercise checkboxes and quizzes must work and save locally.
    await page.goto("http://127.0.0.1:4173/visual-library.html", { waitUntil: "networkidle" });
    await page.locator('[data-done="N1-1"]').check();
    assert.equal(await page.evaluate(() => localStorage.getItem("massar-visual-N1-1")), "1", "exercise completion should persist");
    await page.locator('input[name="q-N1-1"][value="0"]').check();
    await page.locator('[data-check="N1-1"]').click();
    assert.ok((await page.locator("#f-N1-1").textContent()).includes("صحيح"), "quiz should display correct-answer feedback");

    // Verify a narrow viewport does not cause a horizontal page overflow.
    await page.setViewportSize({ width: 375, height: 812 });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 2, `mobile horizontal overflow: ${JSON.stringify(dimensions)}`);

    // Referral cards must render only for fully approved, terms-reviewed offers with valid HTTPS tracking URLs.
    const affiliateConfig = await page.evaluate(async () => await (await fetch("./affiliate-cards.json")).json());
    const approvedOfferCount = affiliateConfig.offers.filter(offer => {
      if (offer.approved_for_publication !== true || offer.terms_reviewed !== true) return false;
      if (!offer.course_title || !offer.tracking_url || !offer.commission_terms || !offer.price_text || !offer.review_date) return false;
      try { return new URL(offer.tracking_url).protocol === "https:"; } catch (_) { return false; }
    }).length;
    assert.equal(await page.locator(".partner-card").count(), approvedOfferCount, "only fully approved affiliate cards should display");
    assert.equal(await page.locator('[data-affiliate-slot="N5-6"]').count(), 1, "a contextual slot should exist for the freelancing lesson");

    // Privacy policy must be published and readable.
    await page.goto("http://127.0.0.1:4173/privacy.html", { waitUntil: "networkidle" });
    assert.ok((await page.locator("h1").textContent()).includes("سياسة الخصوصية"), "privacy page should render");

    assert.deepEqual(errors, [], "pages should not throw uncaught JavaScript errors");
    console.log("PASS browser smoke tests: five paths, worksheet autosave, progress persistence, search/open, exercise persistence, quiz feedback, mobile viewport, no uncaught page errors");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
