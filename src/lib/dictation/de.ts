import type { DictationPack } from "./types";

/**
 * Tiếng Đức — bộ câu chép chính tả, xếp theo CEFR.
 *
 * Tiếng Đức viết gần như đúng như đọc, nên chỗ mất điểm không nằm ở chữ câm
 * như tiếng Pháp mà ở mấy thứ tai không phân biệt được: phụ âm cuối bị đọc
 * vô thanh (Rad và Rat nghe như nhau), nguyên âm dài hay ngắn quyết định viết
 * một hay hai phụ âm (Staat / Stadt, ihn / in), ß hay ss, ie hay ei — cộng
 * thêm luật viết hoa MỌI danh từ, và tiền tố tách được rơi xuống tận cuối câu.
 * Mỗi bộ dưới đây nhắm vào một trong những chỗ đó.
 */
export const DE_DICTATION: DictationPack = {
  code: "de",
  scale: "CEFR",
  levels: ["A1", "A2", "B1", "B2", "C1"],
  accepts: ["script"],
  sets: [
    {
      id: "de.a1.basics",
      title: "Câu đời thường",
      level: "A1",
      note: "Câu ngắn, để quen nhịp nghe, gõ ä ö ü ß và viết hoa danh từ.",
      lines: [
        { text: "Ich heiße Anna und wohne in Berlin.", phonetic: "/ɪç ˈhaɪ̯sə ˈana ʊnt ˈvoːnə ɪn bɛʁˈliːn/", meaning: "Tôi tên Anna và sống ở Berlin." },
        { text: "Wie spät ist es, bitte?", phonetic: "/viː ʃpɛːt ɪst ɛs ˈbɪtə/", meaning: "Xin hỏi mấy giờ rồi?" },
        { text: "Ich hätte gern einen Kaffee.", phonetic: "/ɪç ˈhɛtə ɡɛʁn ˈaɪ̯nən ˈkafeː/", meaning: "Cho tôi một ly cà phê." },
        { text: "Wir haben zwei Kinder.", phonetic: "/viːɐ̯ ˈhaːbn̩ tsvaɪ̯ ˈkɪndɐ/", meaning: "Chúng tôi có hai đứa con." },
        { text: "Der Zug fährt um acht Uhr ab.", phonetic: "/deːɐ̯ tsuːk fɛːɐ̯t ʊm axt uːɐ̯ ap/", meaning: "Tàu chạy lúc tám giờ." },
        { text: "Sie arbeitet in einer Schule.", phonetic: "/ziː ˈaʁbaɪ̯tət ɪn ˈaɪ̯nɐ ˈʃuːlə/", meaning: "Cô ấy làm việc ở một trường học." },
        { text: "Das Wetter ist heute schön.", phonetic: "/das ˈvɛtɐ ɪst ˈhɔɪ̯tə ʃøːn/", meaning: "Hôm nay trời đẹp." },
        { text: "Ich verstehe das nicht so gut.", phonetic: "/ɪç fɛɐ̯ˈʃteːə das nɪçt zoː ɡuːt/", meaning: "Tôi không hiểu lắm." },
      ],
    },
    {
      id: "de.a2.length",
      title: "Nguyên âm dài hay ngắn",
      level: "A2",
      note: "Nguyên âm ngắn kéo theo hai phụ âm, nguyên âm dài thì có h, ie hoặc nguyên âm đôi.",
      lines: [
        { text: "Die Stadt liegt nicht weit vom Meer.", phonetic: "/diː ʃtat liːkt nɪçt vaɪ̯t fɔm meːɐ̯/", meaning: "Thành phố nằm không xa biển." },
        { text: "Ich habe ihn im Bus gesehen.", phonetic: "/ɪç ˈhaːbə iːn ɪm bʊs ɡəˈzeːən/", meaning: "Tôi đã thấy anh ấy trên xe buýt." },
        { text: "Das Bett ist leider zu kurz.", phonetic: "/das bɛt ɪst ˈlaɪ̯dɐ tsuː kʊʁts/", meaning: "Tiếc là cái giường ngắn quá." },
        { text: "Er fährt jeden Morgen mit dem Rad.", phonetic: "/eːɐ̯ fɛːɐ̯t ˈjeːdn̩ ˈmɔʁɡn̩ mɪt deːm ʁaːt/", meaning: "Sáng nào anh ấy cũng đi xe đạp." },
        { text: "Wir wohnen in einer kleinen Wohnung.", phonetic: "/viːɐ̯ ˈvoːnən ɪn ˈaɪ̯nɐ ˈklaɪ̯nən ˈvoːnʊŋ/", meaning: "Chúng tôi ở trong một căn hộ nhỏ." },
        { text: "Komm bitte schnell, das Essen ist fertig.", phonetic: "/kɔm ˈbɪtə ʃnɛl das ˈɛsn̩ ɪst ˈfɛʁtɪç/", meaning: "Đến nhanh lên, đồ ăn xong rồi." },
        { text: "Sie trinkt lieber Tee als Kaffee.", phonetic: "/ziː tʁɪŋkt ˈliːbɐ teː als ˈkafeː/", meaning: "Cô ấy thích uống trà hơn cà phê." },
        { text: "Der Hund schläft im Garten.", phonetic: "/deːɐ̯ hʊnt ʃlɛːft ɪm ˈɡaʁtn̩/", meaning: "Con chó ngủ trong vườn." },
      ],
    },
    {
      id: "de.a2.endings",
      title: "Phụ âm cuối và ß",
      level: "A2",
      note: "Cuối từ d nghe như t, g như k, b như p — phải suy từ dạng số nhiều. Kèm ß sau nguyên âm dài.",
      lines: [
        { text: "Am Abend gehen wir durch den Wald.", phonetic: "/am ˈaːbn̩t ˈɡeːən viːɐ̯ dʊʁç deːn valt/", meaning: "Buổi tối chúng tôi đi qua khu rừng." },
        { text: "Das Kind spielt auf der Straße.", phonetic: "/das kɪnt ʃpiːlt aʊ̯f deːɐ̯ ˈʃtʁaːsə/", meaning: "Đứa bé chơi ngoài đường." },
        { text: "Er gibt mir einen guten Rat.", phonetic: "/eːɐ̯ ɡiːpt miːɐ̯ ˈaɪ̯nən ˈɡuːtn̩ ʁaːt/", meaning: "Anh ấy cho tôi một lời khuyên tốt." },
        { text: "Ich weiß, dass du müde bist.", phonetic: "/ɪç vaɪ̯s das duː ˈmyːdə bɪst/", meaning: "Tôi biết là cậu mệt." },
        { text: "Der Tag war lang und heiß.", phonetic: "/deːɐ̯ taːk vaːɐ̯ laŋ ʊnt haɪ̯s/", meaning: "Ngày hôm đó dài và nóng." },
        { text: "Wir essen das Brot mit Käse.", phonetic: "/viːɐ̯ ˈɛsn̩ das bʁoːt mɪt ˈkɛːzə/", meaning: "Chúng tôi ăn bánh mì với phô mai." },
        { text: "Sie hat einen großen Fuß.", phonetic: "/ziː hat ˈaɪ̯nən ˈɡʁoːsn̩ fuːs/", meaning: "Cô ấy có bàn chân to." },
        { text: "Das Schloss liegt auf einem Berg.", phonetic: "/das ʃlɔs liːkt aʊ̯f ˈaɪ̯nəm bɛʁk/", meaning: "Lâu đài nằm trên một ngọn núi." },
      ],
    },
    {
      id: "de.b1.word-order",
      title: "Động từ chạy xuống cuối",
      level: "B1",
      note: "Mệnh đề phụ đẩy động từ xuống cuối, tiền tố tách được rơi tận cuối câu — phải nghe hết mới chép được.",
      lines: [
        { text: "Ich rufe dich morgen Nachmittag an.", phonetic: "/ɪç ˈʁuːfə dɪç ˈmɔʁɡn̩ ˈnaːxmɪtaːk an/", meaning: "Chiều mai tôi gọi cho cậu." },
        { text: "Weil es geregnet hat, sind wir zu Hause geblieben.", phonetic: "/vaɪ̯l ɛs ɡəˈʁeːɡnət hat zɪnt viːɐ̯ tsuː ˈhaʊ̯zə ɡəˈbliːbn̩/", meaning: "Vì trời mưa nên chúng tôi ở nhà." },
        { text: "Sie fragt, ob der Laden heute geöffnet hat.", phonetic: "/ziː fʁaːkt ɔp deːɐ̯ ˈlaːdn̩ ˈhɔɪ̯tə ɡəˈœfnət hat/", meaning: "Cô ấy hỏi hôm nay cửa hàng có mở không." },
        { text: "Als ich ankam, war der Zug schon abgefahren.", phonetic: "/als ɪç ˈankaːm vaːɐ̯ deːɐ̯ tsuːk ʃoːn ˈapɡəfaːʁən/", meaning: "Khi tôi đến thì tàu đã chạy rồi." },
        { text: "Er hat vergessen, die Tür abzuschließen.", phonetic: "/eːɐ̯ hat fɛɐ̯ˈɡɛsn̩ diː tyːɐ̯ ˈaptsuʃliːsn̩/", meaning: "Anh ấy quên khoá cửa." },
        { text: "Wir steigen an der nächsten Haltestelle aus.", phonetic: "/viːɐ̯ ˈʃtaɪ̯ɡn̩ an deːɐ̯ ˈnɛːçstn̩ ˈhaltəʃtɛlə aʊ̯s/", meaning: "Chúng ta xuống ở trạm kế tiếp." },
        { text: "Ich glaube, dass sie das Buch schon gelesen hat.", phonetic: "/ɪç ˈɡlaʊ̯bə das ziː das buːx ʃoːn ɡəˈleːzn̩ hat/", meaning: "Tôi nghĩ là cô ấy đã đọc quyển sách rồi." },
        { text: "Kannst du mir sagen, wann der Kurs anfängt?", phonetic: "/kanst duː miːɐ̯ ˈzaːɡn̩ van deːɐ̯ kʊʁs ˈanfɛŋt/", meaning: "Cậu nói tôi biết khi nào khoá học bắt đầu được không?" },
      ],
    },
    {
      id: "de.b2.konjunktiv",
      title: "Câu giả định và bị động",
      level: "B2",
      note: "Hätte và hatte, wäre và war chỉ khác nhau một chấm umlaut — nghe sai là đổi cả nghĩa câu.",
      lines: [
        { text: "Wenn ich mehr Zeit hätte, würde ich öfter reisen.", phonetic: "/vɛn ɪç meːɐ̯ tsaɪ̯t ˈhɛtə ˈvʏʁdə ɪç ˈœftɐ ˈʁaɪ̯zn̩/", meaning: "Nếu có nhiều thời gian hơn, tôi sẽ đi du lịch thường hơn." },
        { text: "Er tut so, als ob er nichts davon wüsste.", phonetic: "/eːɐ̯ tuːt zoː als ɔp eːɐ̯ nɪçts daˈfɔn ˈvʏstə/", meaning: "Anh ta làm như không biết gì về chuyện đó." },
        { text: "Das Haus wurde im letzten Jahr renoviert.", phonetic: "/das haʊ̯s ˈvʊʁdə ɪm ˈlɛtstn̩ jaːɐ̯ ʁenoˈviːɐ̯t/", meaning: "Ngôi nhà được sửa lại vào năm ngoái." },
        { text: "Hättest du mich angerufen, wäre ich gekommen.", phonetic: "/ˈhɛtəst duː mɪç ˈanɡəʁuːfn̩ ˈvɛːʁə ɪç ɡəˈkɔmən/", meaning: "Nếu cậu gọi cho tôi thì tôi đã đến rồi." },
        { text: "Die Briefe müssen bis morgen verschickt werden.", phonetic: "/diː ˈbʁiːfə ˈmʏsn̩ bɪs ˈmɔʁɡn̩ fɛɐ̯ˈʃɪkt ˈveːɐ̯dn̩/", meaning: "Các lá thư phải được gửi đi trước ngày mai." },
        { text: "Je länger ich darüber nachdenke, desto unsicherer werde ich.", phonetic: "/jeː ˈlɛŋɐ ɪç daˈʁyːbɐ ˈnaːxdɛŋkə ˈdɛsto ˈʊnzɪçəʁɐ ˈveːɐ̯də ɪç/", meaning: "Càng nghĩ về chuyện đó tôi càng thấy không chắc." },
        { text: "Die Tür war schon geschlossen, als wir kamen.", phonetic: "/diː tyːɐ̯ vaːɐ̯ ʃoːn ɡəˈʃlɔsn̩ als viːɐ̯ ˈkaːmən/", meaning: "Cửa đã đóng khi chúng tôi đến." },
        { text: "An deiner Stelle würde ich das nicht unterschreiben.", phonetic: "/an ˈdaɪ̯nɐ ˈʃtɛlə ˈvʏʁdə ɪç das nɪçt ʊntɐˈʃʁaɪ̯bn̩/", meaning: "Ở vị trí của cậu thì tôi sẽ không ký cái đó." },
      ],
    },
    {
      id: "de.c1.formal",
      title: "Văn nói trang trọng",
      level: "C1",
      note: "Câu dài, danh từ ghép nhiều tầng, nhịp của bản tin và diễn văn.",
      lines: [
        { text: "Die Ergebnisse der Untersuchung werden in den nächsten Tagen veröffentlicht.", phonetic: "/diː ɛɐ̯ˈɡeːpnɪsə deːɐ̯ ʊntɐˈzuːxʊŋ ˈveːɐ̯dn̩ ɪn deːn ˈnɛːçstn̩ ˈtaːɡn̩ fɛɐ̯ˈʔœfn̩tlɪçt/", meaning: "Kết quả cuộc điều tra sẽ được công bố trong vài ngày tới." },
        { text: "Die Bundesregierung plant, das gesamte Verfahren zu überprüfen.", phonetic: "/diː ˈbʊndəsʁeˌɡiːʁʊŋ plaːnt das ɡəˈzamtə fɛɐ̯ˈfaːʁən tsuː yːbɐˈpʁyːfn̩/", meaning: "Chính phủ liên bang dự định rà soát lại toàn bộ quy trình." },
        { text: "Diese Entscheidung hat heftige Reaktionen ausgelöst.", phonetic: "/ˈdiːzə ɛntˈʃaɪ̯dʊŋ hat ˈhɛftɪɡə ʁeakˈtsi̯oːnən ˈaʊ̯sɡəløːst/", meaning: "Quyết định này đã gây ra những phản ứng gay gắt." },
        { text: "Es sei darauf hingewiesen, dass die Zahlen vorläufig sind.", phonetic: "/ɛs zaɪ̯ daˈʁaʊ̯f ˈhɪnɡəviːzn̩ das diː ˈtsaːlən ˈfoːɐ̯lɔɪ̯fɪç zɪnt/", meaning: "Cần lưu ý rằng các con số vẫn là tạm thời." },
        { text: "Die Lage hat sich seit Jahresbeginn deutlich verbessert.", phonetic: "/diː ˈlaːɡə hat zɪç zaɪ̯t ˈjaːʁəsbəˌɡɪn ˈdɔɪ̯tlɪç fɛɐ̯ˈbɛsɐt/", meaning: "Tình hình đã cải thiện rõ rệt từ đầu năm." },
        { text: "Der Minister erklärte, er habe von dem Vorfall nichts gewusst.", phonetic: "/deːɐ̯ miˈnɪstɐ ɛɐ̯ˈklɛːɐ̯tə eːɐ̯ ˈhaːbə fɔn deːm ˈfoːɐ̯fal nɪçts ɡəˈvʊst/", meaning: "Bộ trưởng tuyên bố ông không hề biết gì về vụ việc." },
        { text: "Die Maßnahmen sollen vor allem die Schwächsten schützen.", phonetic: "/diː ˈmaːsnaːmən ˈzɔlən foːɐ̯ ˈaləm diː ˈʃvɛçstn̩ ˈʃʏtsn̩/", meaning: "Các biện pháp này trước hết nhằm bảo vệ những người yếu thế nhất." },
        { text: "Die Debatte ist noch längst nicht abgeschlossen.", phonetic: "/diː deˈbatə ɪst nɔx lɛŋst nɪçt ˈapɡəʃlɔsn̩/", meaning: "Cuộc tranh luận còn lâu mới khép lại." },
      ],
    },
  ],
};
