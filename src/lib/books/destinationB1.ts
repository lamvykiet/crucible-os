import type { Book } from "./types";

/**
 * Destination B1 — Grammar and Vocabulary (Macmillan).
 *
 * Bản PDF người dùng đưa là BẢN QUÉT, không có lớp chữ, nên không trích thẳng
 * được. Cấu trúc dưới đây lấy bằng cách cho AI đọc trang mục lục: 42 unit và 14
 * bài ôn, xếp theo nhịp hai bài ngữ pháp rồi một bài từ vựng, cứ ba bài lại một
 * bài ôn.
 *
 * CHƯA CÓ danh sách từ của từng unit — phần đó nằm trong ruột sách, muốn lấy
 * phải OCR tiếp. Bước nào chưa có từ thì vẫn đứng trên đường học, chỉ là mở ra
 * thấy tên unit chứ chưa có bài.
 *
 * Tên unit là dữ kiện về cấu trúc sách. Không chép giải thích, ví dụ hay bài
 * tập nào của sách.
 */
export const DESTINATION_B1: Book = {
  id: "destination-b1",
  title: "Destination B1 Grammar and Vocabulary",
  langCode: "en",
  level: "B1",
  note: "42 unit ngữ pháp và từ vựng, 14 bài ôn, theo đúng thứ tự của sách.",
  provenance:
    "Cấu trúc unit đọc từ mục lục sách. Danh sách từ và phần dạy chưa có — sẽ bổ sung dần. Không chép nội dung sách.",
  steps: [
    { step: 1, label: "1", kind: "grammar", title: "Present simple, present continuous, stative verbs" },
    { step: 2, label: "2", kind: "grammar", title: "Past simple, past continuous, used to" },
    { step: 3, label: "3", kind: "vocabulary", title: "Fun and games" },
    { step: 4, label: "R1", kind: "review", title: "Units 1, 2 and 3" },
    { step: 5, label: "4", kind: "grammar", title: "Present perfect simple, present perfect continuous" },
    { step: 6, label: "5", kind: "grammar", title: "Past perfect simple, past perfect continuous" },
    { step: 7, label: "6", kind: "vocabulary", title: "Learning and doing" },
    { step: 8, label: "R2", kind: "review", title: "Units 4, 5 and 6" },
    { step: 9, label: "7", kind: "grammar", title: "Future time (present continuous, will, be going to, present simple)" },
    { step: 10, label: "8", kind: "grammar", title: "Prepositions of time and place" },
    { step: 11, label: "9", kind: "vocabulary", title: "Coming and going" },
    { step: 12, label: "R3", kind: "review", title: "Units 7, 8 and 9" },
    { step: 13, label: "10", kind: "grammar", title: "The passive 1" },
    { step: 14, label: "11", kind: "grammar", title: "The passive 2" },
    { step: 15, label: "12", kind: "vocabulary", title: "Friends and relations" },
    { step: 16, label: "R4", kind: "review", title: "Units 10, 11 and 12" },
    { step: 17, label: "13", kind: "grammar", title: "Countable and uncountable nouns" },
    { step: 18, label: "14", kind: "grammar", title: "Articles" },
    { step: 19, label: "15", kind: "vocabulary", title: "Buying and selling" },
    { step: 20, label: "R5", kind: "review", title: "Units 13, 14 and 15" },
    { step: 21, label: "16", kind: "grammar", title: "Pronouns and possessive determiners" },
    { step: 22, label: "17", kind: "grammar", title: "Relative clauses" },
    { step: 23, label: "18", kind: "vocabulary", title: "Inventions and discoveries" },
    { step: 24, label: "R6", kind: "review", title: "Units 16, 17 and 18" },
    { step: 25, label: "19", kind: "grammar", title: "Modals 1: ability, permission, advice" },
    { step: 26, label: "20", kind: "grammar", title: "Modals 2: obligation, probability, possibility" },
    { step: 27, label: "21", kind: "vocabulary", title: "Sending and receiving" },
    { step: 28, label: "R7", kind: "review", title: "Units 19, 20 and 21" },
    { step: 29, label: "22", kind: "grammar", title: "Modals 3: the modal perfect" },
    { step: 30, label: "23", kind: "grammar", title: "Questions, question tags, indirect questions" },
    { step: 31, label: "24", kind: "vocabulary", title: "People and daily life" },
    { step: 32, label: "R8", kind: "review", title: "Units 22, 23 and 24" },
    { step: 33, label: "25", kind: "grammar", title: "So and such, too and enough" },
    { step: 34, label: "26", kind: "grammar", title: "Comparatives and superlatives" },
    { step: 35, label: "27", kind: "vocabulary", title: "Working and earning" },
    { step: 36, label: "R9", kind: "review", title: "Units 25, 26 and 27" },
    { step: 37, label: "28", kind: "grammar", title: "Conditionals 1: (zero, first, second)" },
    { step: 38, label: "29", kind: "grammar", title: "Conditionals 2: (third)" },
    { step: 39, label: "30", kind: "vocabulary", title: "Body and lifestyle" },
    { step: 40, label: "R10", kind: "review", title: "Units 28, 29 and 30" },
    { step: 41, label: "31", kind: "grammar", title: "Reported speech" },
    { step: 42, label: "32", kind: "grammar", title: "Reported questions, orders, requests" },
    { step: 43, label: "33", kind: "vocabulary", title: "Creating and building" },
    { step: 44, label: "R11", kind: "review", title: "Units 31, 32 and 33" },
    { step: 45, label: "34", kind: "grammar", title: "Direct and indirect objects" },
    { step: 46, label: "35", kind: "grammar", title: "wish" },
    { step: 47, label: "36", kind: "vocabulary", title: "Nature and the universe" },
    { step: 48, label: "R12", kind: "review", title: "Units 34, 35 and 36" },
    { step: 49, label: "37", kind: "grammar", title: "-ing and infinitive" },
    { step: 50, label: "38", kind: "grammar", title: "Both, either, neither, so, nor" },
    { step: 51, label: "39", kind: "vocabulary", title: "Laughing and crying" },
    { step: 52, label: "R13", kind: "review", title: "Units 37, 38 and 39" },
    { step: 53, label: "40", kind: "grammar", title: "Connectives" },
    { step: 54, label: "41", kind: "grammar", title: "The causative" },
    { step: 55, label: "42", kind: "vocabulary", title: "Problems and solutions" },
    { step: 56, label: "R14", kind: "review", title: "Units 40, 41 and 42" },
  ],
};
