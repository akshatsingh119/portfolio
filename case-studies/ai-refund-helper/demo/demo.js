/* Refund Clock Helper demo page. Live mode calls the Cloudflare Worker; replay mode shows recorded responses. */
(function () {
  "use strict";
  // ---- the one config value: the deployed Worker URL. Empty = replay mode only. ----
  var WORKER_URL = "https://refund-helper.akshatsingh119.workers.dev"; // Cloudflare Worker (deployed 24 Oct 2026). Set to "" to force replay mode.

  // Local testing only: ?worker=http://localhost:8787 (localhost URLs only).
  try {
    var qp = new URLSearchParams(location.search).get("worker");
    if (qp && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(qp)) WORKER_URL = qp;
  } catch (e) {}

  var MAX = 1500, TIMEOUT_MS = 30000;
  var SAMPLES = window.REFUND_HELPER_SAMPLES || [];
  var REPLAY = window.REFUND_HELPER_REPLAY || {};
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), sms = $("sms"), smsWrap = $("sms-wrap"), out = $("out"), go = $("go"), count = $("count"), mode = $("mode");
  var current = null;

  var RULES = {
    R1: "R1 · person-to-person: reversed by T+1", R2: "R2 · merchant: auto-reversal by T+5", R3: "R3 · ₹100 per day if late, automatic",
    R4: "R4 · RBI Integrated Ombudsman", R5: "R5 · Ombudsman after 30 days / rejection", R6: "R6 · complain in the app, then bank",
    R7: "R7 · online dispute resolution", R8: "R8 · fraud: call 1930, report on cybercrime.gov.in",
    G1: "G1 · pending: don't pay again", G2: "G2 · not debited: safe to retry", G3: "G3 · wrong recipient: no auto-reversal", G4: "G4 · double debit: share both UTRs"
  };
  var ESC = { none: "No escalation needed", app_support: "Raise it in the app", bank: "Escalate: your bank", npci: "Escalate: NPCI",
    rbi_ombudsman: "Escalate: RBI Ombudsman", cyber_1930: "Escalate: 1930 helpline" };
  var FLAGS = { prompt_injection: "Hidden instructions ignored", pin_or_otp_request: "PIN/OTP request spotted", scam_signals: "Scam signals" };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function day(iso) { return Date.parse(iso + "T00:00:00Z"); }
  function fmt(iso, opts) { return new Date(day(iso)).toLocaleDateString("en-GB", Object.assign({ timeZone: "UTC", day: "numeric", month: "short" }, opts || {})); }
  function inr(n) { return n == null ? null : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function initials(s) { if (!s) return "₹"; var w = String(s).replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/); return ((w[0] || "")[0] + ((w[1] || "")[0] || "")).toUpperCase() || "₹"; }

  // ---- samples ----
  var chips = $("samples");
  SAMPLES.forEach(function (s) {
    var b = el("button", "demo-chip"); b.type = "button"; b.setAttribute("aria-pressed", "false"); b.dataset.id = s.id;
    b.appendChild(el("small", null, s.tag)); b.appendChild(document.createTextNode(s.label));
    b.addEventListener("click", function () {
      msg.value = s.message; sms.value = s.pasted_message || ""; smsWrap.open = !!s.pasted_message;
      update(); out.scrollIntoView && window.innerWidth < 860 && go.focus();
      submit();
    });
    chips.appendChild(b);
  });
  function matchSample() {
    var m = msg.value.trim(), p = sms.value.trim();
    for (var i = 0; i < SAMPLES.length; i++) if (SAMPLES[i].message === m && (SAMPLES[i].pasted_message || "") === p) return SAMPLES[i];
    return null;
  }
  function update() {
    var n = Array.from(msg.value.trim()).length + Array.from(sms.value.trim()).length;
    count.textContent = n + " / " + MAX; count.classList.toggle("over", n > MAX);
    current = matchSample();
    Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute("aria-pressed", String(!!current && c.dataset.id === current.id)); });
    return n;
  }
  msg.addEventListener("input", update); sms.addEventListener("input", update);
  mode.innerHTML = WORKER_URL ? "<b>Live mode.</b> Answers come from the model in real time (usually 2–7 s)."
    : "<b>Replay mode.</b> The live model isn't connected here yet, so samples show a <b>recorded response</b> from a real run.";

  // ---- submit ----
  $("ask").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  function submit() {
    var n = update();
    var m = msg.value.trim(), p = sms.value.trim();
    if (!m && !p) { msg.focus(); return; }
    if (n > MAX) { notice(["That's over 1,500 characters. Shorten it a little and try again."]); return; }
    if (!WORKER_URL) return fallback("not_configured");
    loading();
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { ctrl && ctrl.abort(); }, TIMEOUT_MS);
    fetch(WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m, pasted_message: p || null }), signal: ctrl && ctrl.signal })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (r) {
        clearTimeout(timer);
        if (r.status === 200 && r.body && r.body.ok) return render(r.body, "live");
        if (r.status === 413) return notice(["That's over 1,500 characters. Shorten it a little and try again."]);
        fallback(r.status === 429 ? (r.body && r.body.error) || "rate_limited" : "error");
      })
      .catch(function () { clearTimeout(timer); fallback("error"); });
  }
  function fallback(reason) {
    var why = { not_configured: "", rate_limited: "You've hit the limit of 5 tries a minute.", daily_cap_reached: "Today's free quota for the live model is used up.",
      upstream_quota: "The model's free tier is busy right now.", error: "The live model didn't respond." }[reason];
    if (why === undefined) why = "The live model is unavailable right now.";
    if (current && REPLAY[current.id]) return render(REPLAY[current.id], "replay", why);
    notice([why || "The live model isn't connected on this page yet.", "Pick one of the samples above to see a recorded response from a real run."]);
  }

  // ---- views ----
  function loading() {
    out.setAttribute("aria-busy", "true"); out.innerHTML = "";
    var w = el("div", "rc-loading"); w.appendChild(el("p", null, "Reading your message, then checking the rules…"));
    for (var i = 0; i < 3; i++) w.appendChild(el("div", "bar")); out.appendChild(w);
  }
  function notice(lines) {
    out.setAttribute("aria-busy", "false"); out.innerHTML = "";
    var w = el("div", "rc-notice"); lines.forEach(function (l) { if (l) w.appendChild(el("p", null, l)); }); out.appendChild(w);
  }

  function hero(r, today) {
    var c = r.category, d = r.deadline || {}, f = r.fields || {};
    var h = { tone: "", pill: ["On the way", ""], k: "", big: "", rule: "", count: null, track: null, call: false };
    var typeRule = (d.rule_id || (r.rule_ids || []).filter(function (x) { return x === "R1" || x === "R2"; })[0]) === "R1"
      ? "RBI deadline for person-to-person payments: T+1" : "RBI deadline for shop payments: T+5";
    if (c === "DEBITED_FAILED") {
      if (d.due_date && !d.passed) {
        var left = Math.round((day(d.due_date) - day(today)) / 864e5);
        h.k = "Back in your bank by"; h.big = fmt(d.due_date, { weekday: "short" }); h.rule = typeRule;
        h.count = left <= 0 ? [["0", "days"], ["Due", "today"]] : [[String(left), left === 1 ? "day" : "days"]];
        if (f.date) {
          var span = day(d.due_date) - day(f.date), pos = Math.min(1, Math.max(0, (day(today) - day(f.date)) / (span || 1)));
          h.track = { pos: pos, from: fmt(f.date), to: fmt(d.due_date), now: fmt(today) };
        }
      } else if (d.due_date && d.passed) {
        var late = Math.round((day(today) - day(d.due_date)) / 864e5);
        h.tone = "amber"; h.pill = ["Late", "red"]; h.k = "Refund deadline passed on"; h.big = fmt(d.due_date, { weekday: "short" });
        h.rule = "₹100 per day of delay is owed, credited automatically (R3)"; h.count = [[String(late), late === 1 ? "day late" : "days late"]];
      } else {
        h.k = "Back in your bank within"; h.big = typeRule.slice(-3) + " of the payment date"; h.pill = ["Need the date", "grey"];
        h.rule = "Tell me the payment date to start the clock";
      }
    } else if (c === "DEBITED_PENDING") {
      h.tone = "amber"; h.pill = ["Pending", "amber"]; h.k = "Status is still pending"; h.big = "Don't pay again yet"; h.rule = "If it fails, the " + typeRule.slice(-3) + " clock runs from the payment date (G1)";
    } else if (c === "FRAUD_SCAM") {
      h.tone = "red"; h.pill = ["Scam", "red"]; h.k = "Stop. Don't click, don't pay"; h.big = "This looks like a scam"; h.rule = "Report within 24 hours on cybercrime.gov.in (R8)"; h.call = true;
    } else if (c === "NOT_DEBITED") {
      h.tone = "green"; h.pill = ["Not debited", "green"]; h.k = "Good news"; h.big = "No money left your account"; h.rule = "Check your bank SMS, then it's safe to retry (G2)";
    } else if (c === "DOUBLE_DEBIT") {
      h.tone = "amber"; h.pill = ["Charged twice", "amber"]; h.k = "One payment, two debits"; h.big = "Raise it with both UTRs"; h.rule = "Complain in the app on this payment (G4)";
    } else if (c === "WRONG_RECIPIENT") {
      h.tone = "grey"; h.pill = ["Wrong recipient", "grey"]; h.k = "The payment went through"; h.big = "Sent to the wrong ID"; h.rule = "Not a failed payment, so no auto-reversal (G3)";
    } else if (c === "NEEDS_INFO") {
      h.tone = "grey"; h.pill = ["Need details", "grey"]; h.k = "I can't tell yet"; h.big = "Tell me a bit more"; h.rule = "Amount, date, who you paid, and was money debited?";
    } else {
      h.tone = "grey"; h.pill = ["Outside UPI", "grey"]; h.k = "Not a UPI payment problem"; h.big = "I can only help with UPI"; h.rule = r.escalate_to === "bank" ? "Contact your bank or card issuer directly" : "Failed, pending or double-debited UPI payments";
    }
    return h;
  }

  function render(resp, how, why) {
    out.setAttribute("aria-busy", "false"); out.innerHTML = "";
    var r = resp.result || {}, meta = resp.meta || {}, f = r.fields || {}, today = meta.today;
    var h = hero(r, today);
    var card = el("article", "rc"); card.setAttribute("aria-label", "Refund Clock result");

    var top = el("div", "rc-top"), who = el("div", "rc-who");
    who.appendChild(el("span", "rc-av", initials(f.payee)));
    var t = el("div"); t.style.minWidth = "0";
    t.appendChild(el("div", "rc-amt", f.amount_inr != null ? inr(f.amount_inr) + (r.category === "DEBITED_FAILED" ? " refund" : "") : "UPI payment"));
    t.appendChild(el("div", "rc-sub", [f.payee, f.date ? fmt(f.date) : null].filter(Boolean).join(" · ") || "Details not stated"));
    who.appendChild(t); top.appendChild(who); top.appendChild(el("span", "rc-pill " + h.pill[1], h.pill[0])); card.appendChild(top);

    var hb = el("div", "rc-hero " + h.tone), row = el("div", "rc-hero-row"), hl = el("div");
    hl.appendChild(el("p", "rc-k", h.k)); hl.appendChild(el("p", "rc-big", h.big)); row.appendChild(hl);
    if (h.count) { var cn = el("div", "rc-count"); h.count.forEach(function (x) { var s = el("span", null, x[0]); s.appendChild(el("small", null, x[1].toUpperCase())); s.style.flexDirection = "column"; s.style.display = "flex"; s.style.alignItems = "center"; cn.appendChild(s); }); row.appendChild(cn); }
    hb.appendChild(row);
    if (h.track) {
      var tr = el("div", "rc-track"), fill = el("i"), knob = el("b"); fill.style.width = (h.track.pos * 100) + "%"; knob.style.left = (h.track.pos * 100) + "%";
      tr.appendChild(fill); tr.appendChild(knob); hb.appendChild(tr);
      var ticks = el("div", "rc-ticks"); ticks.appendChild(el("span", null, "Paid " + h.track.from)); ticks.appendChild(el("span", null, "Today " + h.track.now)); ticks.appendChild(el("span", null, "Due " + h.track.to)); hb.appendChild(ticks);
    }
    if (h.rule) hb.appendChild(el("p", "rc-rule", "⚖ " + h.rule));
    if (h.call) { var a = el("a", "rc-call", "📞 Call 1930 now"); a.href = "tel:1930"; hb.appendChild(a); }
    card.appendChild(hb);

    var body = el("div", "rc-body");
    body.appendChild(el("p", "rc-h", "What to do next")); body.appendChild(el("p", "rc-next", r.next_step || ""));
    var dl = el("dl", "rc-facts");
    [["Amount", inr(f.amount_inr)], ["Paid to", f.payee], ["Date", f.date ? fmt(f.date, { year: "numeric" }) : null], ["UTR", f.utr]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("dt", null, x[0])); d.appendChild(el("dd", x[1] ? "" : "nil", x[1] || "not stated")); dl.appendChild(d);
    });
    body.appendChild(dl);
    var tags = el("div", "rc-tags");
    tags.appendChild(el("span", "rc-tag esc", ESC[r.escalate_to] || r.escalate_to));
    (r.rule_ids || []).forEach(function (id) { var s = el("span", "rc-tag", id); s.title = RULES[id] || id; tags.appendChild(s); });
    (r.safety_flags || []).forEach(function (fl) { tags.appendChild(el("span", "rc-tag flag", "⚠ " + (FLAGS[fl] || fl))); });
    body.appendChild(tags);
    if (r.dispute_draft) {
      body.appendChild(el("p", "rc-h", "Dispute message"));
      var dd = el("div", "rc-draft"); dd.appendChild(el("p", null, r.dispute_draft));
      var cb = el("button", "rc-copy", "Copy message"); cb.type = "button";
      cb.addEventListener("click", function () { (navigator.clipboard ? navigator.clipboard.writeText(r.dispute_draft) : Promise.reject()).then(function () { cb.textContent = "Copied"; }, function () { cb.textContent = "Select and copy"; }); });
      dd.appendChild(cb); body.appendChild(dd);
    }
    card.appendChild(body);

    var foot = el("div", "rc-foot"), left = el("span"), right = el("span");
    var verifier = meta.fallback ? "verifier: template used" : meta.retried ? "verifier: fixed on retry" : "verifier: passed";
    var secs = meta.latency_ms ? (meta.latency_ms / 1000).toFixed(1) + " s" : "";
    if (how === "replay") {
      left.appendChild(el("span", "rec", "Recorded response")); left.appendChild(document.createTextNode(" real run on " + fmt(today, { year: "numeric" }) + ", deadlines as of that day"));
    } else {
      left.appendChild(el("span", "live", "Live")); left.appendChild(document.createTextNode(" " + secs));
    }
    right.textContent = [how === "replay" ? secs : null, meta.model, verifier].filter(Boolean).join(" · ");
    foot.appendChild(left); foot.appendChild(right); card.appendChild(foot);
    out.appendChild(card);
    if (how === "replay" && why) { var n = el("p", "demo-mode", why + " Showing a recorded response for this sample."); out.appendChild(n); }
  }
  update();
})();
