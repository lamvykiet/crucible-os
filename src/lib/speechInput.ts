/**
 * Nhận giọng nói thành chữ bằng Web Speech API có sẵn trong trình duyệt.
 *
 * Dùng cho chế độ "Nghe & nói" của Gõ câu: chỉ cần biết người học NÓI ra đúng
 * các chữ của câu hay chưa, không cần chấm phát âm chi tiết — việc đó đã có màn
 * Phát âm riêng (gửi bản ghi lên Gemini). Ở đây không tốn lượt AI nào.
 *
 * Chrome, Edge, Dia, Safari có; Firefox thì không. Không có thì màn hình tự lùi
 * về gõ phím và nói rõ lý do.
 */

interface RecognitionResultLike {
  0: { transcript: string };
}
interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechInputSupported = () => ctor() !== null;

const LOCALE: Record<string, string> = {
  en: "en-GB", fr: "fr-FR", de: "de-DE", cmn: "zh-CN", yue: "zh-HK", ko: "ko-KR",
};

/**
 * Nghe một lượt nói. `onText` được gọi liên tục với bản nghe tạm thời, rồi lần
 * cuối với bản chốt. Trả về hàm dừng.
 */
export function listenOnce(
  code: string,
  handlers: { onText: (text: string, final: boolean) => void; onEnd: () => void; onError: (msg: string) => void }
): () => void {
  const Rec = ctor();
  if (!Rec) {
    handlers.onError("Trình duyệt này không nhận giọng nói được.");
    handlers.onEnd();
    return () => {};
  }
  const rec = new Rec();
  rec.lang = LOCALE[code] ?? code;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let last = "";
  rec.onresult = (e) => {
    last = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
    handlers.onText(last, false);
  };
  rec.onerror = (e) => {
    const msg =
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Chưa cho phép dùng micro."
        : e.error === "no-speech"
          ? "Không nghe thấy gì. Bấm micro rồi nói lại."
          : `Lỗi nhận giọng nói: ${e.error}`;
    handlers.onError(msg);
  };
  rec.onend = () => {
    if (last) handlers.onText(last, true);
    handlers.onEnd();
  };
  rec.start();
  return () => {
    try {
      rec.stop();
    } catch {
      // Đã dừng rồi.
    }
  };
}
