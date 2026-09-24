/**
 * Đổi đoạn thu âm của `MediaRecorder` sang WAV 16 kHz một kênh.
 *
 * Vì sao phải đổi: `MediaRecorder` trả `audio/webm;codecs=opus` trên Chrome và
 * `audio/mp4` trên Safari, mà Gemini KHÔNG nhận hai định dạng đó — nó nhận wav,
 * mp3, aiff, aac, ogg, flac. Gửi thẳng webm lên là lỗi 400, và lỗi đó chỉ hiện
 * ra lúc chấm bài, sau khi người học đã nói xong hai phút.
 *
 * 16 kHz một kênh là mức chuẩn cho tiếng nói: đủ cho dải âm giọng người, mà
 * nhẹ hơn 44.1 kHz hai kênh khoảng sáu lần. Hai phút nói ≈ 3,8 MB.
 */

/** Ghép header WAV 16-bit PCM vào trước dữ liệu mẫu. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);          // độ dài khối fmt
  view.setUint16(20, 1, true);           // 1 = PCM không nén
  view.setUint16(22, 1, true);           // một kênh
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte mỗi giây
  view.setUint16(32, 2, true);           // byte mỗi mẫu
  view.setUint16(34, 16, true);          // bit mỗi mẫu
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Float [-1,1] → số nguyên 16-bit có dấu. Kẹp biên trước khi nhân, vì mẫu
  // vượt biên một chút là chuyện thường và để tràn thì nghe thành tiếng rè.
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

const TARGET_RATE = 16_000;

/**
 * Giải mã đoạn thu, dồn về một kênh, hạ về 16 kHz, rồi đóng gói WAV.
 *
 * Máy nào không dựng được `OfflineAudioContext` ở 16 kHz thì giữ nguyên tần số
 * gốc — file to hơn nhưng vẫn chấm được, còn hơn là không nộp được bài.
 */
export async function toWav(blob: Blob): Promise<{ wav: Blob; seconds: number }> {
  const bytes = await blob.arrayBuffer();

  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decoder = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(bytes.slice(0));
  } finally {
    void decoder.close();
  }

  const seconds = decoded.duration;
  const rate = Math.min(TARGET_RATE, decoded.sampleRate);
  const frames = Math.ceil(decoded.duration * rate);

  let rendered: AudioBuffer;
  try {
    const offline = new OfflineAudioContext(1, frames, rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    rendered = await offline.startRendering();
  } catch {
    rendered = decoded;
  }

  // Sau khi render qua `OfflineAudioContext(1, …)` thì đã là một kênh. Nếu
  // render hỏng và ta rơi về buffer gốc thì có thể còn hai kênh — dồn lại.
  let samples = rendered.getChannelData(0);
  if (rendered.numberOfChannels > 1) {
    const mixed = new Float32Array(rendered.length);
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const channel = rendered.getChannelData(c);
      for (let i = 0; i < channel.length; i++) mixed[i] += channel[i] / rendered.numberOfChannels;
    }
    samples = mixed;
  }

  return { wav: encodeWav(samples, rendered.sampleRate), seconds };
}

/** Định dạng thu âm mà máy này nhận. Trả `null` nghĩa là không thu được. */
export function pickRecordingType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export const canRecord = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  pickRecordingType() !== null;

/** Blob → base64 không kèm tiền tố `data:`, dạng mà Gemini `inlineData` cần. */
export const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được đoạn thu"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
