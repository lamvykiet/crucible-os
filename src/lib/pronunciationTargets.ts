/**
 * Những chỗ phát âm khó, chia theo thứ tiếng.
 *
 * Danh sách này **viết tay**, không để AI sinh. Lý do: hỏi AI "âm nào khó" thì
 * mỗi lượt trả một danh sách khác nhau, và người học không có cách nào biết mình
 * đã đi qua những gì. Một danh sách cố định thì luyện được theo thứ tự, và tiến
 * độ mới có nghĩa.
 *
 * Chỗ khó được chọn theo hướng "người nói tiếng Việt học thứ tiếng này": ví dụ
 * âm cuối rụng và cụm phụ âm là vấn đề thật với tiếng Anh, còn với tiếng Trung
 * thì thanh điệu không phải vấn đề vì tiếng Việt cũng có thanh — vấn đề là
 * thanh nào ánh sang thanh nào sai.
 *
 * `hint` là chỉ dẫn miệng, lưỡi, hơi — thứ mà nghe mẫu một trăm lần cũng không
 * tự rút ra được.
 */

export interface PronTarget {
  id: string;
  /** Ký hiệu ngắn để hiện trên thẻ: IPA, pinyin, hay tên thanh. */
  symbol: string;
  en: string;
  vi: string;
  hintEn: string;
  hintVi: string;
  /** Vài từ mẫu để AI lấy làm chuẩn khi soạn bài. */
  seeds: string[];
}

const EN: PronTarget[] = [
  {
    id: "final-consonants",
    symbol: "-t -d -k -p",
    en: "Final consonants", vi: "Âm cuối",
    hintEn: "Vietnamese stops the airflow at the end; English releases it. Let a small puff out after the last sound.",
    hintVi: "Tiếng Việt chặn hơi ở âm cuối, tiếng Anh thì nhả hơi ra. Sau âm cuối phải bật ra một hơi nhỏ.",
    seeds: ["cat", "did", "look", "stop", "worked"],
  },
  {
    id: "th",
    symbol: "/θ/ /ð/",
    en: "The two th sounds", vi: "Hai âm th",
    hintEn: "Tongue tip touches the bottom of the upper teeth, air passes over it. Not /t/, not /s/.",
    hintVi: "Đầu lưỡi chạm mặt dưới của răng trên, hơi đi qua khe đó. Không phải /t/, cũng không phải /s/.",
    seeds: ["think", "three", "this", "mother", "breathe"],
  },
  {
    id: "final-s",
    symbol: "-s / -z / -ɪz",
    en: "Plural and third-person -s", vi: "Âm -s số nhiều và ngôi ba",
    hintEn: "One spelling, three sounds, decided by the sound before it: /s/ after voiceless, /z/ after voiced, /ɪz/ after s, z, sh, ch, ge.",
    hintVi: "Một cách viết nhưng ba âm, quyết bởi âm đứng trước: /s/ sau âm vô thanh, /z/ sau âm hữu thanh, /ɪz/ sau s, z, sh, ch, ge.",
    seeds: ["books", "dogs", "watches", "boxes", "plays"],
  },
  {
    id: "ed",
    symbol: "-ed",
    en: "Past tense -ed", vi: "Âm -ed quá khứ",
    hintEn: "Also three sounds: /t/, /d/, or /ɪd/. Only verbs ending in t or d get the extra syllable.",
    hintVi: "Cũng ba âm: /t/, /d/, hoặc /ɪd/. Chỉ động từ kết thúc bằng t hoặc d mới thêm một âm tiết.",
    seeds: ["walked", "played", "wanted", "needed", "stopped"],
  },
  {
    id: "clusters",
    symbol: "str- spl- -sks",
    en: "Consonant clusters", vi: "Cụm phụ âm",
    hintEn: "Say every consonant without slipping a vowel between them. No \"sư-treet\".",
    hintVi: "Đọc hết mọi phụ âm mà không chèn nguyên âm vào giữa. Không phải \"sư-trít\".",
    seeds: ["street", "splash", "asks", "texts", "strengths"],
  },
  {
    id: "long-short-i",
    symbol: "/iː/ vs /ɪ/",
    en: "Long and short i", vi: "i dài và i ngắn",
    hintEn: "Not just length — /ɪ/ is looser and lower. Ship and sheep are different words.",
    hintVi: "Không chỉ khác độ dài — /ɪ/ lỏng hơn và thấp hơn. Ship và sheep là hai từ khác nhau.",
    seeds: ["ship", "sheep", "fit", "feet", "live", "leave"],
  },
  {
    id: "l-r",
    symbol: "/l/ vs /r/",
    en: "l and r", vi: "l và r",
    hintEn: "For /l/ the tongue tip touches the ridge behind the teeth; for /r/ it touches nothing at all.",
    hintVi: "Với /l/ đầu lưỡi chạm gờ sau răng; với /r/ thì lưỡi không chạm vào đâu cả.",
    seeds: ["light", "right", "collect", "correct", "play", "pray"],
  },
  {
    id: "word-stress",
    symbol: "STRESS",
    en: "Word stress", vi: "Trọng âm từ",
    hintEn: "Every English word of two syllables or more has one strong syllable. Put it on the wrong one and the word stops being recognisable.",
    hintVi: "Mọi từ tiếng Anh từ hai âm tiết trở lên đều có một âm tiết mạnh. Đặt sai chỗ là người nghe không nhận ra từ nữa.",
    seeds: ["photograph", "photographer", "comfortable", "develop", "necessary"],
  },
  {
    id: "sentence-stress",
    symbol: "• — •",
    en: "Sentence rhythm", vi: "Nhịp câu",
    hintEn: "Content words get the beat, grammar words get squeezed. A flat, evenly-timed sentence is the biggest giveaway.",
    hintVi: "Từ mang nghĩa được nhấn, từ ngữ pháp bị bóp lại. Câu đọc đều tăm tắp là dấu hiệu lộ rõ nhất.",
    seeds: ["I'd like a cup of coffee.", "What do you want to do?", "She's been waiting for an hour."],
  },
  {
    id: "schwa",
    symbol: "/ə/",
    en: "The weak vowel", vi: "Nguyên âm yếu",
    hintEn: "Unstressed vowels collapse into one lazy sound. Read every letter fully and you sound spelled out.",
    hintVi: "Nguyên âm không nhấn đều rút về một âm lười duy nhất. Đọc đủ từng chữ cái là nghe như đang đánh vần.",
    seeds: ["banana", "about", "computer", "problem", "support"],
  },
  {
    id: "linking",
    symbol: "◡",
    en: "Linking between words", vi: "Nối âm giữa các từ",
    hintEn: "A final consonant runs into the next vowel, so the words share a boundary instead of each standing alone.",
    hintVi: "Phụ âm cuối chạy sang nguyên âm đầu của từ sau, hai từ dính vào nhau thay vì đứng tách rời.",
    seeds: ["pick it up", "an hour and a half", "turn it on", "a lot of it"],
  },
  {
    id: "v-w",
    symbol: "/v/ vs /w/",
    en: "v and w", vi: "v và w",
    hintEn: "For /v/ the top teeth touch the bottom lip; for /w/ the lips round with no teeth involved.",
    hintVi: "Với /v/ răng trên chạm môi dưới; với /w/ thì tròn môi và răng không tham gia.",
    seeds: ["very", "wary", "vine", "wine", "invest", "west"],
  },
];

const FR: PronTarget[] = [
  {
    id: "nasal-vowels",
    symbol: "/ɑ̃/ /ɛ̃/ /ɔ̃/",
    en: "Nasal vowels", vi: "Nguyên âm mũi",
    hintEn: "Air goes out through the nose while the mouth holds the vowel, and no n is pronounced at the end.",
    hintVi: "Hơi ra qua mũi trong khi miệng giữ nguyên âm, và không đọc âm n ở cuối.",
    seeds: ["banc", "bain", "bon", "enfant", "vingt"],
  },
  {
    id: "u-ou",
    symbol: "/y/ vs /u/",
    en: "u and ou", vi: "u và ou",
    hintEn: "For /y/ say /i/ then round the lips without moving the tongue. For /u/ the tongue pulls back.",
    hintVi: "Với /y/ hãy nói /i/ rồi tròn môi mà không di chuyển lưỡi. Với /u/ thì lưỡi kéo về sau.",
    seeds: ["tu", "tout", "rue", "roue", "sur", "sour"],
  },
  {
    id: "french-r",
    symbol: "/ʁ/",
    en: "The French r", vi: "Âm r tiếng Pháp",
    hintEn: "Made at the back of the throat, not with the tongue tip. Close to a soft gargle.",
    hintVi: "Phát ở cuống họng, không dùng đầu lưỡi. Gần với tiếng khò nhẹ.",
    seeds: ["Paris", "rouge", "merci", "français", "arriver"],
  },
  {
    id: "silent-endings",
    symbol: "-s -t -e",
    en: "Silent final letters", vi: "Chữ cuối không đọc",
    hintEn: "Most final consonants stay silent. Reading them out is the clearest foreign accent marker.",
    hintVi: "Phần lớn phụ âm cuối không đọc. Đọc chúng ra là dấu hiệu lộ rõ nhất của người nước ngoài.",
    seeds: ["petit", "vous", "grand", "beaucoup", "salut"],
  },
  {
    id: "liaison",
    symbol: "◡",
    en: "Liaison", vi: "Nối âm",
    hintEn: "A silent final consonant wakes up before a vowel: les amis becomes le-zami.",
    hintVi: "Phụ âm cuối vốn im lại thức dậy khi gặp nguyên âm: les amis thành le-zami.",
    seeds: ["les amis", "vous avez", "un homme", "trois ans"],
  },
  {
    id: "even-stress",
    symbol: "— — —",
    en: "Even stress", vi: "Trọng âm đều",
    hintEn: "French does not stress one syllable in a word; the slight lift goes on the last syllable of the phrase.",
    hintVi: "Tiếng Pháp không nhấn một âm tiết trong từ; chỗ hơi lên nằm ở âm tiết cuối của cả ngữ.",
    seeds: ["important", "impossible", "un café au lait", "à tout à l'heure"],
  },
];

const CMN: PronTarget[] = [
  {
    id: "tone-pairs",
    symbol: "1-2-3-4",
    en: "Telling the four tones apart", vi: "Phân biệt bốn thanh",
    hintEn: "Vietnamese has tones too, but they do not map one to one. Tone 2 rises from the middle, not from low like the Vietnamese sắc.",
    hintVi: "Tiếng Việt cũng có thanh, nhưng không ánh một-một. Thanh 2 lên từ giữa, không lên từ thấp như dấu sắc.",
    seeds: ["mā má mǎ mà", "bā bá bǎ bà", "yī yí yǐ yì"],
  },
  {
    id: "tone-three",
    symbol: "3 + 3",
    en: "Third tone in a row", vi: "Hai thanh ba liền nhau",
    hintEn: "Two third tones together: the first turns into a second tone. Nǐ hǎo is said ní hǎo.",
    hintVi: "Hai thanh ba đứng cạnh nhau thì cái trước đổi thành thanh hai. Nǐ hǎo đọc thành ní hǎo.",
    seeds: ["nǐ hǎo", "hěn hǎo", "wǒ xiǎng", "shuǐ guǒ"],
  },
  {
    id: "zh-ch-sh",
    symbol: "zh ch sh r",
    en: "Retroflex initials", vi: "Âm đầu uốn lưỡi",
    hintEn: "Curl the tongue tip up towards the roof of the mouth. Not the same as z, c, s.",
    hintVi: "Uốn đầu lưỡi lên phía vòm miệng. Không giống z, c, s.",
    seeds: ["zhōngguó", "chīfàn", "shuō", "rén"],
  },
  {
    id: "j-q-x",
    symbol: "j q x",
    en: "Palatal initials", vi: "Âm đầu mặt lưỡi",
    hintEn: "Tongue flat and forward, lips spread. q is aspirated, j is not — that puff is the whole difference.",
    hintVi: "Lưỡi phẳng và đưa ra trước, môi bẹt. q có bật hơi, j không — chính hơi bật đó là toàn bộ khác biệt.",
    seeds: ["jiā", "qī", "xiě", "jiǔ", "qiú"],
  },
  {
    id: "u-umlaut",
    symbol: "ü",
    en: "The ü vowel", vi: "Nguyên âm ü",
    hintEn: "Say i and round the lips while holding the tongue still. Distinct from u.",
    hintVi: "Nói i rồi tròn môi mà giữ lưỡi bất động. Khác hẳn u.",
    seeds: ["lǜ", "nǚ", "yú", "juǎn", "xuě"],
  },
  {
    id: "neutral-tone",
    symbol: "0",
    en: "Neutral tone", vi: "Thanh nhẹ",
    hintEn: "Short, light, no contour of its own. Giving it a full tone makes the phrase sound stiff.",
    hintVi: "Ngắn, nhẹ, không có đường thanh riêng. Đọc nó thành một thanh đầy đủ làm cả ngữ nghe cứng.",
    seeds: ["māma", "bàba", "xièxie", "de", "le"],
  },
];

const YUE: PronTarget[] = [
  {
    id: "six-tones",
    symbol: "1-6",
    en: "The six tones", vi: "Sáu thanh",
    hintEn: "Three level tones sit at different heights. Height alone separates them, so a wrong height is a wrong word.",
    hintVi: "Ba thanh bằng nằm ở ba độ cao khác nhau. Chỉ độ cao phân biệt chúng, nên sai độ cao là sai từ.",
    seeds: ["si1 si2 si3 si4 si5 si6", "fu1 fu2 fu3 fu4 fu5 fu6"],
  },
  {
    id: "final-stops",
    symbol: "-p -t -k",
    en: "Unreleased final stops", vi: "Âm cuối tắc không nhả",
    hintEn: "The mouth closes on the final consonant and no air comes out — the same habit Vietnamese already has.",
    hintVi: "Miệng đóng lại ở phụ âm cuối và không nhả hơi ra — đúng thói quen tiếng Việt vốn đã có.",
    seeds: ["sap6", "jat1", "sik6", "gwok3"],
  },
  {
    id: "final-nasals",
    symbol: "-m -n -ng",
    en: "Final nasals", vi: "Âm mũi cuối",
    hintEn: "Three different endings that often collapse into one. Keep -m with lips closed and -ng at the back.",
    hintVi: "Ba âm cuối khác nhau mà thường bị gộp thành một. Giữ -m với môi đóng, còn -ng ở phía sau.",
    seeds: ["sam1", "san1", "sang1", "taam1", "taan1"],
  },
  {
    id: "ng-initial",
    symbol: "ng-",
    en: "Initial ng", vi: "Âm đầu ng",
    hintEn: "A syllable can start with ng, which English never does but Vietnamese does.",
    hintVi: "Một âm tiết có thể mở đầu bằng ng — tiếng Anh không có, còn tiếng Việt thì có.",
    seeds: ["ngo5", "ngaam1", "ngau4", "ngon6"],
  },
  {
    id: "eoi-yu",
    symbol: "eoi / yu",
    en: "Rounded front vowels", vi: "Nguyên âm trước tròn môi",
    hintEn: "Lips round while the tongue stays forward — the pair most often flattened into a plain vowel.",
    hintVi: "Tròn môi trong khi lưỡi giữ phía trước — cặp âm hay bị làm phẳng thành nguyên âm thường nhất.",
    seeds: ["heoi3", "syu1", "zyu2", "leoi5"],
  },
];

const KO: PronTarget[] = [
  {
    id: "three-way-stops",
    symbol: "ㄱ ㅋ ㄲ",
    en: "Plain, aspirated, tense", vi: "Thường, bật hơi, căng",
    hintEn: "Three consonants where other languages have two. Plain is soft, aspirated has a puff, tense is tight with no puff.",
    hintVi: "Ba phụ âm ở chỗ các tiếng khác chỉ có hai. Thường thì nhẹ, bật hơi thì có hơi phụt, căng thì siết và không có hơi.",
    seeds: ["가 카 까", "다 타 따", "바 파 빠"],
  },
  {
    id: "batchim",
    symbol: "받침",
    en: "Final consonant", vi: "Phụ âm cuối",
    hintEn: "Final consonants are held, not released. Seven sounds cover every written ending.",
    hintVi: "Phụ âm cuối được giữ lại, không nhả ra. Bảy âm bao hết mọi cách viết âm cuối.",
    seeds: ["밥", "국", "꽃", "앞", "듣다"],
  },
  {
    id: "liaison-ko",
    symbol: "◡",
    en: "Final consonant moving on", vi: "Phụ âm cuối chạy sang",
    hintEn: "A final consonant jumps into the next syllable when that syllable starts with ㅇ: 한국어 sounds han-gu-geo.",
    hintVi: "Phụ âm cuối nhảy sang âm tiết sau khi âm tiết đó mở bằng ㅇ: 한국어 đọc thành han-gu-geo.",
    seeds: ["한국어", "음악", "맛있어요", "옷을"],
  },
  {
    id: "eo-o",
    symbol: "ㅓ vs ㅗ",
    en: "eo and o", vi: "ㅓ và ㅗ",
    hintEn: "ㅓ has relaxed lips, ㅗ has rounded lips. The pair most often merged.",
    hintVi: "ㅓ để môi thả lỏng, ㅗ thì tròn môi. Đây là cặp hay bị gộp nhất.",
    seeds: ["서울", "소울", "먹다", "목"],
  },
  {
    id: "eu",
    symbol: "ㅡ",
    en: "The eu vowel", vi: "Nguyên âm ㅡ",
    hintEn: "Lips spread flat, tongue high and back. Not the u of English, and not a schwa.",
    hintVi: "Môi bẹt ra, lưỡi cao và lùi về sau. Không phải u của tiếng Anh, cũng không phải âm yếu.",
    seeds: ["그", "은행", "스물", "크다"],
  },
  {
    id: "nasal-assimilation",
    symbol: "ㄱ+ㄴ → ㅇㄴ",
    en: "Sound changes across syllables", vi: "Biến âm giữa hai âm tiết",
    hintEn: "Written and spoken forms differ: 학년 is said hang-nyeon. Reading letter by letter sounds wrong.",
    hintVi: "Viết và đọc khác nhau: 학년 đọc thành hang-nyeon. Đọc từng chữ một là nghe sai.",
    seeds: ["학년", "입니다", "한국말", "꽃놀이"],
  },
];

const BY_CODE: Record<string, PronTarget[]> = { en: EN, fr: FR, cmn: CMN, yue: YUE, ko: KO };

/** Chỗ khó của một thứ tiếng. Tiếng chưa có danh sách riêng thì trả rỗng. */
export const targetsFor = (code: string): PronTarget[] => BY_CODE[code] ?? [];

export const targetById = (code: string, id: string) =>
  targetsFor(code).find((target) => target.id === id) ?? null;
