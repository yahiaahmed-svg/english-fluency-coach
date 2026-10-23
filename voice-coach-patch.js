(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const AI_SCREEN_ID = "aiScreen";
  const CFG_KEY = "voice_coach_settings_v1";

  const settings = (() => {
    try {
      return Object.assign(
        { autoSpeak: true, micLang: "en-US" },
        JSON.parse(localStorage.getItem(CFG_KEY) || "{}")
      );
    } catch {
      return { autoSpeak: true, micLang: "en-US" };
    }
  })();

  function saveSettings() {
    localStorage.setItem(CFG_KEY, JSON.stringify(settings));
  }

  function getEnglishVoice(locale = "en-US") {
    const voices = speechSynthesis.getVoices() || [];

    return (
      voices.find(v => v.lang === locale) ||
      voices.find(v =>
        v.lang?.toLowerCase().startsWith(
          locale.slice(0, 2).toLowerCase()
        )
      ) ||
      voices.find(v =>
        v.lang?.toLowerCase().startsWith("en")
      ) ||
      null
    );
  }

  function speakText(text) {
    if (
      !settings.autoSpeak ||
      !text ||
      !("speechSynthesis" in window)
    ) return;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);

    const selectedLocale =
      document.getElementById("voiceLocale")?.value ||
      "en-US";

    u.lang = selectedLocale;
    u.rate = Number(
      document.getElementById("voiceRate")?.value || 1
    );
    u.pitch = 1;

    const voice = getEnglishVoice(selectedLocale);

    if (voice) {
      u.voice = voice;
    }

    const stopBtn =
      document.getElementById("aiVoiceStop");

    if (stopBtn) {
      stopBtn.hidden = false;
    }

    u.onend = () => {
      if (stopBtn) {
        stopBtn.hidden = true;
      }
    };

    u.onerror = () => {
      if (stopBtn) {
        stopBtn.hidden = true;
      }
    };

    speechSynthesis.speak(u);
  }

  function answerText(data) {
    if (!data || typeof data !== "object") return "";

    return (
      data.reply_english ||
      data.english ||
      data.message ||
      data.text ||
      ""
    );
  }

  function enhanceCloudVoice() {
    if (
      !window.Cloud ||
      window.Cloud.__voiceWrapped
    ) return;

    const original =
      window.Cloud.invokeAI?.bind(window.Cloud);

    if (!original) return;

    window.Cloud.invokeAI = async payload => {
      const data = await original(payload);

      setTimeout(() => {
        const text = answerText(data);

        if (text) {
          speakText(text);
        }
      }, 120);

      return data;
    };

    window.Cloud.__voiceWrapped = true;
  }

  let recognition = null;
  let finalTranscript = "";

  function status(text, tone = "") {
    const el =
      document.getElementById("aiVoiceStatus");

    if (!el) return;

    el.textContent = text || "";
    el.dataset.tone = tone;
  }

  function stopRecognition() {
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
  }

  function startRecognition() {
    if (!SpeechRecognition) {
      status(
        "⚠️ المتصفح ده مش بيدعم Speech Recognition. استخدم Chrome أو Edge.",
        "error"
      );
      return;
    }

    if (recognition) {
      stopRecognition();
      return;
    }

    const input =
      document.getElementById("aiInput");

    const send =
      document.getElementById("aiSend");

    const micBtn =
      document.getElementById("aiMicBtn");

    if (!input || !send) return;

    finalTranscript = "";

    const r = new SpeechRecognition();

    recognition = r;

    r.lang =
      settings.micLang || "en-US";

    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }

      if (micBtn) {
        micBtn.classList.add("listening");
        micBtn.textContent = "⏹️ إيقاف";
      }

      status(
        "🎙️ بسمعك... اتكلم دلوقتي",
        "listening"
      );
    };

    r.onresult = event => {
      let interim = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const t =
          event.results[i][0]?.transcript || "";

        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interim += t + " ";
        }
      }

      const live =
        (finalTranscript + interim).trim();

      input.value = live;

      status(
        live
          ? `سمعت: ${live}`
          : "🎙️ بسمعك...",
        "listening"
      );
    };

    r.onerror = event => {
      const messages = {
        "not-allowed":
          "اسمح للموقع باستخدام الميكروفون.",

        "service-not-allowed":
          "خدمة التعرف على الصوت مش متاحة هنا.",

        "no-speech":
          "ماسمعتش كلام واضح. جرّب تاني.",

        "audio-capture":
          "مش قادر أوصل للميكروفون.",

        "network":
          "التعرف على الصوت محتاج اتصال إنترنت.",

        "language-not-supported":
          "لغة الميكروفون المختارة غير مدعومة."
      };

      status(
        `⚠️ ${
          messages[event.error] ||
          event.error
        }`,
        "error"
      );
    };

    r.onend = () => {
      recognition = null;

      if (micBtn) {
        micBtn.classList.remove("listening");
        micBtn.textContent = "🎙️ اتكلم";
      }

      const text =
        input.value.trim();

      if (text) {
        status(
          "✅ فهمتك. ببعت الكلام للـCoach...",
          "ok"
        );

        setTimeout(() => {
          if (!send.disabled) {
            send.click();
          }
        }, 250);
      } else {
        status(
          "اضغط 🎙️ واتكلم بالإنجليزي.",
          ""
        );
      }
    };

    try {
      r.start();
    } catch {
      recognition = null;

      status(
        "⚠️ تعذر تشغيل الميكروفون. جرّب مرة تانية.",
        "error"
      );
    }
  }

  function addUI() {
    const screen =
      document.getElementById(AI_SCREEN_ID);

    const actions =
      screen?.querySelector(".composerActions");

    if (
      !screen ||
      !actions ||
      document.getElementById("aiMicBtn")
    ) return;

    const voiceBar =
      document.createElement("div");

    voiceBar.className = "aiVoiceBar";

    voiceBar.innerHTML = `
      <button
        id="aiMicBtn"
        type="button"
        class="aiVoiceMic"
      >
        🎙️ اتكلم
      </button>

      <button
        id="aiAutoSpeak"
        type="button"
        class="aiVoiceToggle"
      >
        ${
          settings.autoSpeak
            ? "🔊 الرد الصوتي: شغال"
            : "🔇 الرد الصوتي: مقفول"
        }
      </button>

      <button
        id="aiVoiceStop"
        type="button"
        class="aiVoiceStop"
        hidden
      >
        ⏹️ اسكت
      </button>

      <select
        id="aiMicLang"
        class="aiVoiceLang"
      >
        <option value="en-US">
          🎙️ American English
        </option>

        <option value="en-GB">
          🎙️ British English
        </option>

        <option value="ar-EG">
          🎙️ عربي مصري
        </option>
      </select>

      <div
        id="aiVoiceStatus"
        class="aiVoiceStatus"
      >
        اضغط 🎙️ واتكلم،
        والـCoach هيرد عليك كتابة وصوت.
      </div>
    `;

    actions.parentElement.insertBefore(
      voiceBar,
      actions
    );

    const micBtn =
      document.getElementById("aiMicBtn");

    const autoBtn =
      document.getElementById("aiAutoSpeak");

    const stopBtn =
      document.getElementById("aiVoiceStop");

    const lang =
      document.getElementById("aiMicLang");

    lang.value =
      settings.micLang;

    micBtn.onclick =
      startRecognition;

    autoBtn.onclick = () => {
      settings.autoSpeak =
        !settings.autoSpeak;

      saveSettings();

      if (
        !settings.autoSpeak &&
        "speechSynthesis" in window
      ) {
        speechSynthesis.cancel();
        stopBtn.hidden = true;
      }

      autoBtn.textContent =
        settings.autoSpeak
          ? "🔊 الرد الصوتي: شغال"
          : "🔇 الرد الصوتي: مقفول";

      status(
        settings.autoSpeak
          ? "الـCoach هيقرأ الرد الإنجليزي بصوت."
          : "الرد الصوتي اتقفل؛ الرد هيظهر كتابة بس.",
        "ok"
      );
    };

    stopBtn.onclick = () => {
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }

      stopBtn.hidden = true;

      status(
        "⏹️ وقفت الصوت.",
        ""
      );
    };

    lang.onchange = () => {
      settings.micLang =
        lang.value;

      saveSettings();

      status(
        lang.value.startsWith("ar")
          ? "الميكروفون دلوقتي هيفهم عربي مصري."
          : "الميكروفون دلوقتي هيفهم إنجليزي.",
        "ok"
      );
    };
  }

  function addStyles() {
    if (
      document.getElementById(
        "voiceCoachPatchStyles"
      )
    ) return;

    const style =
      document.createElement("style");

    style.id =
      "voiceCoachPatchStyles";

    style.textContent = `
      .aiVoiceBar {
        display: grid;
        grid-template-columns:
          1fr 1fr auto;
        gap: 8px;
        margin: 0 0 12px;
        direction: rtl;
      }

      .aiVoiceBar button,
      .aiVoiceBar select {
        min-height: 46px;
        border-radius: 13px;
        border: 1px solid #d0d5dd;
        background: #fff;
        font: inherit;
        font-weight: 800;
        padding: 9px 12px;
      }

      .aiVoiceMic {
        background: #101828 !important;
        color: #fff !important;
        border-color: #101828 !important;
      }

      .aiVoiceMic.listening {
        background: #f04438 !important;
        border-color: #f04438 !important;
        animation: voicePulse 1.1s infinite;
      }

      .aiVoiceToggle {
        background: #eef2ff !important;
        color: #3538cd !important;
      }

      .aiVoiceStop {
        color: #b42318 !important;
      }

      .aiVoiceLang {
        grid-column: 1 / -1;
        direction: ltr;
      }

      .aiVoiceStatus {
        grid-column: 1 / -1;
        background: #f9fafb;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
        color: #475467;
        line-height: 1.6;
      }

      .aiVoiceStatus[data-tone="listening"] {
        background: #fff4ed;
        color: #b54708;
      }

      .aiVoiceStatus[data-tone="error"] {
        background: #fef3f2;
        color: #b42318;
      }

      .aiVoiceStatus[data-tone="ok"] {
        background: #ecfdf3;
        color: #027a48;
      }

      @keyframes voicePulse {
        0%, 100% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.025);
        }
      }

      @media (max-width: 640px) {
        .aiVoiceBar {
          grid-template-columns:
            1fr 1fr;
        }

        .aiVoiceStop {
          grid-column: 1 / -1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    addStyles();
    enhanceCloudVoice();
    addUI();

    setTimeout(
      addUI,
      500
    );

    setTimeout(
      enhanceCloudVoice,
      500
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }
})();
(() => {
  const MODE_KEY = "ai_coach_language_mode_v1";
  let coachMode = localStorage.getItem(MODE_KEY) || "both";

  function modeInstruction(mode) {
    if (mode === "egyptian") {
      return `
IMPORTANT LANGUAGE INSTRUCTION:
Speak to the learner in natural Egyptian Arabic (Masri / Egyptian colloquial Arabic).
Do NOT use formal Modern Standard Arabic unless absolutely necessary.
The tone should sound like a normal Egyptian conversation.
Put the main Egyptian response in the "arabic" field.
"explanation_ar" and "reply_arabic" must also be Egyptian colloquial Arabic.
You may include English only when teaching or correcting an English sentence.
`;
    }

    if (mode === "english") {
      return `
IMPORTANT LANGUAGE INSTRUCTION:
Speak primarily in natural English.
Use clear conversational English.
If Arabic explanation is needed, make it short and in Egyptian Arabic, not formal Arabic.
`;
    }

    return `
IMPORTANT LANGUAGE INSTRUCTION:
Give the learner BOTH languages.
First give the natural English response.
Then explain or translate it in natural Egyptian Arabic (Masri), not formal Arabic.
The "arabic", "explanation_ar" and "reply_arabic" fields must sound Egyptian and conversational.
`;
  }

  function getVoice(lang) {
    const voices = speechSynthesis.getVoices() || [];

    if (lang === "ar-EG") {
      return (
        voices.find(v =>
          v.lang?.toLowerCase() === "ar-eg"
        ) ||
        voices.find(v =>
          v.lang?.toLowerCase().startsWith("ar")
        ) ||
        null
      );
    }

    return (
      voices.find(v =>
        v.lang?.toLowerCase() === "en-us"
      ) ||
      voices.find(v =>
        v.lang?.toLowerCase().startsWith("en")
      ) ||
      null
    );
  }

  function say(text, lang, done) {
    if (!text || !("speechSynthesis" in window)) {
      if (done) done();
      return;
    }

    const u = new SpeechSynthesisUtterance(text);

    u.lang = lang;
    u.rate = 0.95;
    u.pitch = 1;

    const voice = getVoice(lang);
    if (voice) u.voice = voice;

    u.onend = () => {
      if (done) done();
    };

    speechSynthesis.speak(u);
  }

  function speakAnswer(data) {
    if (
      localStorage.getItem("coach_voice_enabled") === "0"
    ) return;

    speechSynthesis.cancel();

    const english =
      data?.reply_english ||
      data?.english ||
      "";

    const arabic =
      data?.arabic ||
      data?.explanation_ar ||
      data?.reply_arabic ||
      "";

    if (coachMode === "egyptian") {
      say(arabic || data?.message, "ar-EG");
      return;
    }

    if (coachMode === "english") {
      say(english || data?.message, "en-US");
      return;
    }

    if (english && arabic) {
      say(english, "en-US", () => {
        setTimeout(() => {
          say(arabic, "ar-EG");
        }, 250);
      });
    } else if (english) {
      say(english, "en-US");
    } else {
      say(arabic || data?.message, "ar-EG");
    }
  }

  function wrapAI() {
    if (
      !window.Cloud ||
      !Cloud.invokeAI ||
      Cloud.__egyptianVoiceMode
    ) return false;

    const original = Cloud.invokeAI.bind(Cloud);

    Cloud.invokeAI = async payload => {
      const cleanText = payload?.text || "";

      const enhancedPayload = {
        ...payload,
        voice_mode: coachMode,
        text:
          cleanText +
          "\n\n" +
          modeInstruction(coachMode)
      };

      const data = await original(enhancedPayload);

      setTimeout(() => {
        speakAnswer(data);
      }, 150);

      return data;
    };

    Cloud.__egyptianVoiceMode = true;
    return true;
  }

  function setMicLanguage() {
    const select =
      document.getElementById("aiMicLang");

    if (!select) return;

    if (coachMode === "egyptian") {
      select.value = "ar-EG";
    } else {
      select.value = "en-US";
    }

    select.dispatchEvent(
      new Event("change")
    );
  }

  function addModeUI() {
    if (
      document.getElementById("aiCoachLanguageMode")
    ) return true;

    const bar =
      document.querySelector(".aiVoiceBar");

    if (!bar) return false;

    // Turn off the old automatic English-only speaker
    // because this patch controls the correct language voice.
    const oldAuto =
      document.getElementById("aiAutoSpeak");

    if (
      oldAuto &&
      oldAuto.textContent.includes("شغال")
    ) {
      oldAuto.click();
    }

    if (oldAuto) {
      oldAuto.style.display = "none";
    }

    const box = document.createElement("div");

    box.style.cssText = `
      grid-column:1/-1;
      display:grid;
      grid-template-columns:1fr auto;
      gap:8px;
      align-items:center;
      padding:10px;
      border-radius:14px;
      background:#f8f9fc;
      border:1px solid #eaecf0;
    `;

    box.innerHTML = `
      <select
        id="aiCoachLanguageMode"
        style="
          min-height:46px;
          border-radius:12px;
          border:1px solid #d0d5dd;
          padding:8px 12px;
          font:inherit;
          font-weight:800;
          background:white;
        "
      >
        <option value="egyptian">
          🇪🇬 مصري - كلام وصوت
        </option>

        <option value="english">
          🇺🇸 English - Voice & Chat
        </option>

        <option value="both">
          🔄 English + مصري
        </option>
      </select>

      <button
        id="coachVoiceToggle"
        type="button"
        style="
          min-height:46px;
          border-radius:12px;
          border:1px solid #d0d5dd;
          padding:8px 12px;
          font:inherit;
          font-weight:800;
          background:white;
          cursor:pointer;
        "
      ></button>
    `;

    bar.prepend(box);

    const modeSelect =
      document.getElementById("aiCoachLanguageMode");

    const voiceBtn =
      document.getElementById("coachVoiceToggle");

    modeSelect.value = coachMode;

    function refreshVoiceButton() {
      const on =
        localStorage.getItem("coach_voice_enabled") !== "0";

      voiceBtn.textContent =
        on
          ? "🔊 الصوت شغال"
          : "🔇 الصوت مقفول";
    }

    refreshVoiceButton();

    modeSelect.onchange = () => {
      coachMode = modeSelect.value;

      localStorage.setItem(
        MODE_KEY,
        coachMode
      );

      setMicLanguage();
      speechSynthesis.cancel();
    };

    voiceBtn.onclick = () => {
      const isOn =
        localStorage.getItem("coach_voice_enabled") !== "0";

      localStorage.setItem(
        "coach_voice_enabled",
        isOn ? "0" : "1"
      );

      if (isOn) {
        speechSynthesis.cancel();
      }

      refreshVoiceButton();
    };

    setMicLanguage();

    return true;
  }

  function bootEgyptianMode() {
    wrapAI();
    addModeUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        setTimeout(bootEgyptianMode, 600);
      }
    );
  } else {
    setTimeout(bootEgyptianMode, 600);
  }

  const timer = setInterval(() => {
    const a = wrapAI();
    const b = addModeUI();

    if (
      Cloud?.__egyptianVoiceMode &&
      document.getElementById("aiCoachLanguageMode")
    ) {
      clearInterval(timer);
    }
  }, 500);
})();
