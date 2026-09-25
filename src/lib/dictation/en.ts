import type { DictationPack } from "./types";

/**
 * Tiếng Anh — bộ câu chép chính tả, xếp theo CEFR.
 *
 * Câu chọn quanh những chỗ người Việt nghe hụt nhiều nhất: âm cuối bị nuốt,
 * đuôi -s và -ed, cụm phụ âm, và nối âm giữa các từ. Nghe hiểu ý thì vẫn qua,
 * nhưng chép lại từng chữ là lộ ngay.
 */
export const EN_DICTATION: DictationPack = {
  code: "en",
  scale: "CEFR",
  levels: ["A1", "A2", "B1", "B2", "C1"],
  accepts: ["script"],
  sets: [
    {
      id: "en.a1.everyday",
      title: "Câu đời thường",
      level: "A1",
      note: "Câu ngắn, để quen nhịp nghe và cách gõ đáp án.",
      lines: [
        { text: "I have two brothers and one sister.", phonetic: "/aɪ hæv tuː ˈbrʌðərz ənd wʌn ˈsɪstər/", meaning: "Tôi có hai anh em trai và một chị em gái." },
        { text: "She works at a bank near my house.", phonetic: "/ʃi wɜːrks ət ə bæŋk nɪr maɪ haʊs/", meaning: "Cô ấy làm ở một ngân hàng gần nhà tôi." },
        { text: "What time does the train leave?", phonetic: "/wʌt taɪm dʌz ðə treɪn liːv/", meaning: "Mấy giờ tàu chạy?" },
        { text: "I usually get up at half past six.", phonetic: "/aɪ ˈjuːʒuəli ɡet ʌp ət hɑːf pɑːst sɪks/", meaning: "Tôi thường dậy lúc sáu giờ rưỡi." },
        { text: "There is a small shop on the corner.", phonetic: "/ðer ɪz ə smɔːl ʃɒp ɒn ðə ˈkɔːrnər/", meaning: "Có một cửa hàng nhỏ ở góc phố." },
        { text: "He does not like cold weather.", phonetic: "/hi dʌz nɒt laɪk koʊld ˈweðər/", meaning: "Anh ấy không thích thời tiết lạnh." },
        { text: "We are going to the beach tomorrow.", phonetic: "/wi ɑːr ˈɡoʊɪŋ tə ðə biːtʃ təˈmɒroʊ/", meaning: "Mai chúng tôi đi biển." },
        { text: "Can you help me with this box?", phonetic: "/kən ju help mi wɪð ðɪs bɒks/", meaning: "Bạn giúp tôi cái thùng này được không?" },
      ],
    },
    {
      id: "en.a2.endings",
      title: "Nghe kỹ đuôi -s và -ed",
      level: "A2",
      note: "Một cách viết nhưng ba âm, và đó là chỗ chép chính tả lộ ra ngay.",
      lines: [
        { text: "He watched three films last weekend.", phonetic: "/hi wɒtʃt θriː fɪlmz lɑːst ˈwiːkend/", meaning: "Cuối tuần trước anh ấy xem ba phim." },
        { text: "She finished her homework and went to bed.", phonetic: "/ʃi ˈfɪnɪʃt hər ˈhoʊmwɜːrk ənd went tə bed/", meaning: "Cô ấy làm xong bài rồi đi ngủ." },
        { text: "The boxes are heavier than they look.", phonetic: "/ðə ˈbɒksɪz ɑːr ˈheviər ðən ðeɪ lʊk/", meaning: "Mấy cái thùng nặng hơn trông thấy." },
        { text: "My parents wanted me to study medicine.", phonetic: "/maɪ ˈperənts ˈwɒntɪd mi tə ˈstʌdi ˈmedsn/", meaning: "Bố mẹ tôi muốn tôi học y." },
        { text: "He asked me where I lived.", phonetic: "/hi ɑːskt mi wer aɪ lɪvd/", meaning: "Anh ấy hỏi tôi sống ở đâu." },
        { text: "She needs two more days to decide.", phonetic: "/ʃi niːdz tuː mɔːr deɪz tə dɪˈsaɪd/", meaning: "Cô ấy cần thêm hai ngày để quyết định." },
        { text: "They stopped talking when I walked in.", phonetic: "/ðeɪ stɒpt ˈtɔːkɪŋ wen aɪ wɔːkt ɪn/", meaning: "Họ ngừng nói khi tôi bước vào." },
        { text: "The prices have changed since last year.", phonetic: "/ðə ˈpraɪsɪz həv tʃeɪndʒd sɪns lɑːst jɪr/", meaning: "Giá đã đổi so với năm ngoái." },
      ],
    },
    {
      id: "en.b1.linking",
      title: "Nghe kỹ chỗ nối âm",
      level: "B1",
      note: "Phụ âm cuối chạy sang nguyên âm đầu của từ sau, hai từ dính làm một.",
      lines: [
        { text: "Can you pick it up on your way home?", phonetic: "/kən ju pɪk ɪt ʌp ɒn jər weɪ hoʊm/", meaning: "Bạn tiện đường về lấy hộ được không?" },
        { text: "I waited for an hour and a half.", phonetic: "/aɪ ˈweɪtɪd fər ən ˈaʊər ənd ə hɑːf/", meaning: "Tôi đợi một tiếng rưỡi." },
        { text: "There is a lot of it left over.", phonetic: "/ðer ɪz ə lɒt əv ɪt left ˈoʊvər/", meaning: "Còn thừa lại khá nhiều." },
        { text: "Turn it off before you leave the room.", phonetic: "/tɜːrn ɪt ɒf bɪˈfɔːr ju liːv ðə ruːm/", meaning: "Tắt nó đi trước khi rời phòng." },
        { text: "I ran into an old friend at the station.", phonetic: "/aɪ ræn ˈɪntu ən oʊld frend ət ðə ˈsteɪʃn/", meaning: "Tôi tình cờ gặp một người bạn cũ ở nhà ga." },
        { text: "Let me think about it for a moment.", phonetic: "/let mi θɪŋk əˈbaʊt ɪt fər ə ˈmoʊmənt/", meaning: "Để tôi nghĩ một lát." },
        { text: "It is not as easy as it looks.", phonetic: "/ɪt ɪz nɒt əz ˈiːzi əz ɪt lʊks/", meaning: "Nó không dễ như trông thấy." },
        { text: "We should get in touch with her again.", phonetic: "/wi ʃəd ɡet ɪn tʌtʃ wɪð hər əˈɡen/", meaning: "Chúng ta nên liên lạc lại với cô ấy." },
      ],
    },
    {
      id: "en.b1.work",
      title: "Công việc và cuộc hẹn",
      level: "B1",
      note: "Câu dài hơn, có mệnh đề phụ.",
      lines: [
        { text: "The meeting has been moved to Thursday morning.", phonetic: "/ðə ˈmiːtɪŋ həz bɪn muːvd tə ˈθɜːrzdeɪ ˈmɔːrnɪŋ/", meaning: "Cuộc họp đã dời sang sáng thứ Năm." },
        { text: "I am afraid I will not be able to make it.", phonetic: "/aɪ əm əˈfreɪd aɪ wɪl nɒt bi ˈeɪbl tə meɪk ɪt/", meaning: "Tôi e là tôi không đến được." },
        { text: "Could you send me the report by Friday?", phonetic: "/kʊd ju send mi ðə rɪˈpɔːrt baɪ ˈfraɪdeɪ/", meaning: "Bạn gửi tôi báo cáo trước thứ Sáu nhé?" },
        { text: "He has been working here for almost ten years.", phonetic: "/hi həz bɪn ˈwɜːrkɪŋ hɪr fər ˈɔːlmoʊst ten jɪrz/", meaning: "Anh ấy làm ở đây gần mười năm rồi." },
        { text: "We need to discuss this before we decide.", phonetic: "/wi niːd tə dɪˈskʌs ðɪs bɪˈfɔːr wi dɪˈsaɪd/", meaning: "Chúng ta cần bàn chuyện này trước khi quyết." },
        { text: "The deadline was extended by two weeks.", phonetic: "/ðə ˈdedlaɪn wəz ɪkˈstendɪd baɪ tuː wiːks/", meaning: "Hạn chót đã lùi thêm hai tuần." },
        { text: "She suggested that we try a different approach.", phonetic: "/ʃi səˈdʒestɪd ðət wi traɪ ə ˈdɪfrənt əˈproʊtʃ/", meaning: "Cô ấy đề nghị chúng ta thử cách khác." },
        { text: "I will get back to you as soon as I can.", phonetic: "/aɪ wɪl ɡet bæk tə ju əz suːn əz aɪ kæn/", meaning: "Tôi sẽ trả lời bạn sớm nhất có thể." },
      ],
    },
    {
      id: "en.b2.opinion",
      title: "Nêu quan điểm",
      level: "B2",
      note: "Cách nói giảm, nói vòng — nghe được chữ mà dễ hụt ý.",
      lines: [
        { text: "I would not go so far as to say it was a failure.", phonetic: "/aɪ wʊd nɒt ɡoʊ soʊ fɑːr əz tə seɪ ɪt wəz ə ˈfeɪljər/", meaning: "Tôi không đến mức nói rằng đó là một thất bại." },
        { text: "There is a good deal of evidence to the contrary.", phonetic: "/ðer ɪz ə ɡʊd diːl əv ˈevɪdəns tə ðə ˈkɒntrəri/", meaning: "Có khá nhiều bằng chứng cho điều ngược lại." },
        { text: "That rather depends on how you look at it.", phonetic: "/ðæt ˈrɑːðər dɪˈpendz ɒn haʊ ju lʊk ət ɪt/", meaning: "Cái đó còn tuỳ bạn nhìn theo hướng nào." },
        { text: "On the whole, the results were encouraging.", phonetic: "/ɒn ðə hoʊl, ðə rɪˈzʌlts wər ɪnˈkʌrɪdʒɪŋ/", meaning: "Nhìn chung, kết quả là đáng khích lệ." },
        { text: "I am inclined to agree with the second argument.", phonetic: "/aɪ əm ɪnˈklaɪnd tə əˈɡriː wɪð ðə ˈsekənd ˈɑːrɡjumənt/", meaning: "Tôi nghiêng về phía đồng ý với lập luận thứ hai." },
        { text: "It is worth bearing in mind that costs have risen.", phonetic: "/ɪt ɪz wɜːrθ ˈberɪŋ ɪn maɪnd ðət kɒsts həv ˈrɪzn/", meaning: "Cũng nên nhớ rằng chi phí đã tăng." },
        { text: "The two accounts differ in one important respect.", phonetic: "/ðə tuː əˈkaʊnts ˈdɪfər ɪn wʌn ɪmˈpɔːrtnt rɪˈspekt/", meaning: "Hai lời kể khác nhau ở một điểm quan trọng." },
        { text: "Few would deny that the situation has improved.", phonetic: "/fjuː wʊd dɪˈnaɪ ðət ðə ˌsɪtʃuˈeɪʃn həz ɪmˈpruːvd/", meaning: "Ít ai phủ nhận rằng tình hình đã khá lên." },
      ],
    },
    {
      id: "en.c1.academic",
      title: "Bài giảng học thuật",
      level: "C1",
      note: "Câu dài, nhiều mệnh đề lồng, tốc độ bài giảng.",
      lines: [
        { text: "The findings suggest a correlation rather than a causal link.", phonetic: "/ðə ˈfaɪndɪŋz səˈdʒest ə ˌkɒrəˈleɪʃn ˈrɑːðər ðən ə ˈkɔːzl lɪŋk/", meaning: "Kết quả gợi ý một tương quan chứ không phải quan hệ nhân quả." },
        { text: "Subsequent studies have largely confirmed the initial hypothesis.", phonetic: "/ˈsʌbsɪkwənt ˈstʌdiz həv ˈlɑːrdʒli kənˈfɜːrmd ðə ɪˈnɪʃl haɪˈpɒθəsɪs/", meaning: "Các nghiên cứu sau phần lớn đã xác nhận giả thuyết ban đầu." },
        { text: "This raises the question of whether the sample was representative.", phonetic: "/ðɪs ˈreɪzɪz ðə ˈkwestʃən əv ˈweðər ðə ˈsɑːmpl wəz ˌreprɪˈzentətɪv/", meaning: "Điều này đặt ra câu hỏi liệu mẫu có mang tính đại diện không." },
        { text: "The distinction is subtle but by no means trivial.", phonetic: "/ðə dɪˈstɪŋkʃn ɪz ˈsʌtl bət baɪ noʊ miːnz ˈtrɪviəl/", meaning: "Sự phân biệt này tinh tế nhưng hoàn toàn không tầm thường." },
        { text: "Critics have argued that the methodology was fundamentally flawed.", phonetic: "/ˈkrɪtɪks həv ˈɑːrɡjuːd ðət ðə ˌmeθəˈdɒlədʒi wəz ˌfʌndəˈmentəli flɔːd/", meaning: "Giới phê bình cho rằng phương pháp có sai sót căn bản." },
        { text: "We must be careful not to overstate the significance of these results.", phonetic: "/wi məst bi ˈkerfl nɒt tə ˌoʊvərˈsteɪt ðə sɪɡˈnɪfɪkəns əv ðiːz rɪˈzʌlts/", meaning: "Chúng ta phải cẩn thận đừng thổi phồng ý nghĩa của các kết quả này." },
        { text: "The evidence, though limited, points consistently in one direction.", phonetic: "/ðə ˈevɪdəns, ðoʊ ˈlɪmɪtɪd, pɔɪnts kənˈsɪstəntli ɪn wʌn dəˈrekʃn/", meaning: "Bằng chứng tuy hạn chế nhưng nhất quán chỉ về một hướng." },
        { text: "It remains to be seen whether these effects persist over time.", phonetic: "/ɪt rɪˈmeɪnz tə bi siːn ˈweðər ðiːz ɪˈfekts pərˈsɪst ˈoʊvər taɪm/", meaning: "Còn phải xem các hiệu ứng này có kéo dài theo thời gian hay không." },
      ],
    },
  ],
};
