(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const recordBtn = document.getElementById("recordBtn");
  const timerEl = document.getElementById("recordTimer");
  const resultEl = document.getElementById("speechResult");
  const speakingCard = document.getElementById("speakingCard");

  if (!recordBtn || !timerEl || !resultEl || !speakingCard) return;

  let recognition = null;
  let timer = null;
  let startedAt = 0;
  let finalText = "";
  let interimText = "";

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}'\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function distance(a, b) {
    const dp = Array.from(
      { length: a.length + 1 },
      () => Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[a.length][b.length];
  }

  function analyze(target, heard) {
    const targetWords = normalize(target).split(" ").filter(Boolean);
    const heardWords = normalize(heard).split(" ").filter(Boolean);

    const d = distance(targetWords, heardWords);
    const max = Math.max(targetWords.length, heardWords.length, 1);

    const score = Math.max(
      0,
      Math.min(100, Math.round((1 - d / max) * 100))
    );

    const heardCopy = [...heardWords];
    const missing = [];

    for (const word of targetWords) {
      const index = heardCopy.indexOf(word);

      if (index >= 0) {
        heardCopy.splice(index, 1);
      } else {
        missing.push(word);
      }
    }

    return {
      score,
      missing,
      extra: heardCopy
    };
  }

  function feedback(score) {
    if (score >= 95)
      return "ممتاز جدًا 👏 نطقك اتسمع قريب جدًا من الجملة الأصلية.";

    if (score >= 85)
      return "ممتاز 👌 كرر الجملة مرة كمان بنفس الإيقاع.";

    if (score >= 70)
      return "كويس جدًا. ركز على الكلمات الموضحة وجرب مرة تانية.";

    if (score >= 50)
      return "محاولة كويسة. اسمع الجملة ببطء وكررها جزء جزء.";

    return "اسمع الجملة على سرعة 0.75x وكرر كل جزء لوحده.";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showResult(target, heard) {
    const result = analyze(target, heard);

    resultEl.hidden = false;

    resultEl.innerHTML = `
      <div class="score">${result.score}%</div>

      <p><b>الجملة المطلوبة:</b></p>
      <div dir="ltr">${escapeHtml(target)}</div>

      <p><b>المتصفح سمع:</b></p>
      <div dir="ltr">${escapeHtml(heard || "لم يتم التعرف على كلام واضح")}</div>

      ${
        result.missing.length
          ? `
            <p>
              <b>ركز على الكلمات دي:</b>
              <span dir="ltr">
                ${result.missing.map(escapeHtml).join(", ")}
              </span>
            </p>
          `
          : ""
      }

      ${
        result.extra.length
          ? `
            <p>
              <b>اتسمع بشكل مختلف:</b>
              <span dir="ltr">
                ${result.extra.map(escapeHtml).join(", ")}
              </span>
            </p>
          `
          : ""
      }

      <p>${feedback(result.score)}</p>

      <small>
        التقييم تقريبي ويعتمد على تحويل الكلام إلى نص،
        وليس تحليلًا احترافيًا لمخارج الحروف أو اللكنة.
      </small>
    `;
  }

  function reset() {
    if (timer) clearInterval(timer);

    timer = null;
    recognition = null;

    recordBtn.classList.remove("recording");
    recordBtn.textContent = "🎙️ ابدأ التسجيل";
  }

  recordBtn.onclick = () => {
    if (!SpeechRecognition) {
      resultEl.hidden = false;

      resultEl.innerHTML = `
        ⚠️ المتصفح لا يدعم Speech Recognition.
        <br>
        <small>استخدم Google Chrome أو Microsoft Edge.</small>
      `;

      return;
    }

    if (recognition) {
      recognition.stop();
      return;
    }

    const target = speakingCard.dataset.text;

    if (!target) {
      alert("مش لاقي الجملة المطلوب نطقها.");
      return;
    }

    finalText = "";
    interimText = "";

    const rec = new SpeechRecognition();

    recognition = rec;

    rec.lang =
      document.getElementById("voiceLocale")?.value || "en-US";

    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      startedAt = Date.now();

      recordBtn.classList.add("recording");
      recordBtn.textContent = "⏹️ إيقاف";

      resultEl.hidden = false;
      resultEl.innerHTML =
        "🎙️ بتسمعك دلوقتي... قول الجملة بالإنجليزي.";

      timer = setInterval(() => {
        const seconds =
          Math.floor((Date.now() - startedAt) / 1000);

        timerEl.textContent =
          `00:${String(seconds).padStart(2, "0")}`;
      }, 250);
    };

    rec.onresult = event => {
      interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const text =
          event.results[i][0]?.transcript || "";

        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interimText += text + " ";
        }
      }

      const heard =
        (finalText + interimText).trim();

      resultEl.innerHTML = `
        🎙️ <b>سمعت:</b>
        <div dir="ltr">
          ${escapeHtml(heard || "...")}
        </div>
      `;
    };

    rec.onerror = event => {
      reset();

      const errors = {
        "not-allowed":
          "لازم تسمح للمتصفح باستخدام الميكروفون.",

        "no-speech":
          "ماسمعتش كلام واضح. جرب تاني واتكلم قريب من الميكروفون.",

        "audio-capture":
          "المتصفح مش قادر يوصل للميكروفون.",

        "network":
          "خدمة التعرف على الصوت محتاجة إنترنت."
      };

      resultEl.hidden = false;

      resultEl.innerHTML =
        `⚠️ ${errors[event.error] || event.error}`;
    };

    rec.onend = () => {
      const heard =
        (finalText || interimText).trim();

      reset();

      showResult(target, heard);
    };

    rec.start();
  };
})();
