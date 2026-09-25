import type { DictationPack } from "./types";

/**
 * Tiếng Quảng Đông — bộ câu chép chính tả.
 *
 * Thang bốn bậc do dự án tự đặt, giống bên khung ngữ pháp: tiếng Quảng Đông
 * không có kỳ thi chuẩn nào dùng rộng rãi.
 *
 * Chữ viết theo lối viết tiếng Quảng (có 係, 唔, 喺, 嘅, 咗), không phải chữ
 * Quan Thoại. Phiên âm theo Jyutping kèm số thanh — sáu thanh là chỗ khó nhất,
 * và số thanh chính là thứ phải nghe cho ra.
 *
 * Nhận cả chữ Hán lẫn Jyutping khi chấm.
 */
export const YUE_DICTATION: DictationPack = {
  code: "yue",
  scale: "Tự đặt",
  levels: ["1", "2", "3", "4"],
  accepts: ["script", "phonetic"],
  sets: [
    {
      id: "yue.1.greetings",
      title: "Chào hỏi",
      level: "1",
      note: "Câu ngắn nhất, quen với sáu thanh và với lối viết tiếng Quảng.",
      lines: [
        { text: "你好，我叫阿明。", phonetic: "nei5 hou2, ngo5 giu3 aa3 ming4.", meaning: "Chào bạn, tôi tên A Minh." },
        { text: "你食咗飯未呀？", phonetic: "nei5 sik6 zo2 faan6 mei6 aa3?", meaning: "Bạn ăn cơm chưa?" },
        { text: "我係越南人。", phonetic: "ngo5 hai6 jyut6 naam4 jan4.", meaning: "Tôi là người Việt Nam." },
        { text: "唔該晒你。", phonetic: "m4 goi1 saai3 nei5.", meaning: "Cảm ơn bạn nhiều." },
        { text: "佢喺屋企睇電視。", phonetic: "keoi5 hai2 uk1 kei2 tai2 din6 si6.", meaning: "Anh ấy ở nhà xem tivi." },
        { text: "而家幾點呀？", phonetic: "ji4 gaa1 gei2 dim2 aa3?", meaning: "Bây giờ mấy giờ?" },
        { text: "聽日見啦。", phonetic: "ting1 jat6 gin3 laa1.", meaning: "Mai gặp nhé." },
        { text: "我唔識講廣東話。", phonetic: "ngo5 m4 sik1 gong2 gwong2 dung1 waa2.", meaning: "Tôi không biết nói tiếng Quảng Đông." },
      ],
    },
    {
      id: "yue.1.tones",
      title: "Nghe kỹ sáu thanh",
      level: "1",
      note: "Ba thanh bằng nằm ở ba độ cao khác nhau — sai độ cao là sai từ.",
      lines: [
        { text: "呢個字好難讀。", phonetic: "ni1 go3 zi6 hou2 naan4 duk6.", meaning: "Chữ này rất khó đọc." },
        { text: "佢個仔今年三歲。", phonetic: "keoi5 go3 zai2 gam1 nin4 saam1 seoi3.", meaning: "Con trai anh ấy năm nay ba tuổi." },
        { text: "你買咗幾多本書？", phonetic: "nei5 maai5 zo2 gei2 do1 bun2 syu1?", meaning: "Bạn mua mấy quyển sách?" },
        { text: "今日天氣好好。", phonetic: "gam1 jat6 tin1 hei3 hou2 hou2.", meaning: "Hôm nay thời tiết rất đẹp." },
        { text: "我哋一齊去飲茶。", phonetic: "ngo5 dei6 jat1 cai4 heoi3 jam2 caa4.", meaning: "Chúng ta cùng đi uống trà." },
        { text: "個袋喺張枱下面。", phonetic: "go3 doi2 hai2 zoeng1 toi2 haa6 min6.", meaning: "Cái túi ở dưới cái bàn." },
        { text: "佢講嘢好快。", phonetic: "keoi5 gong2 je5 hou2 faai3.", meaning: "Anh ấy nói chuyện rất nhanh." },
        { text: "呢啲嘢幾多錢？", phonetic: "ni1 di1 je5 gei2 do1 cin2?", meaning: "Mấy thứ này bao nhiêu tiền?" },
      ],
    },
    {
      id: "yue.2.daily",
      title: "Việc thường ngày",
      level: "2",
      note: "Câu dài hơn, có trợ từ sau động từ.",
      lines: [
        { text: "我返咗工先返屋企。", phonetic: "ngo5 faan1 zo2 gung1 sin1 faan1 uk1 kei2.", meaning: "Tôi đi làm xong mới về nhà." },
        { text: "你幫我攞埋個杯好唔好？", phonetic: "nei5 bong1 ngo5 lo2 maai4 go3 bui1 hou2 m4 hou2?", meaning: "Bạn lấy giúp tôi luôn cái ly được không?" },
        { text: "佢食晒啲嘢喇。", phonetic: "keoi5 sik6 saai3 di1 je5 laa3.", meaning: "Anh ấy ăn hết đồ rồi." },
        { text: "我聽日要早啲起身。", phonetic: "ngo5 ting1 jat6 jiu3 zou2 di1 hei2 san1.", meaning: "Mai tôi phải dậy sớm hơn." },
        { text: "呢間舖頭幾點開門？", phonetic: "ni1 gaan1 pou3 tau2 gei2 dim2 hoi1 mun4?", meaning: "Tiệm này mấy giờ mở cửa?" },
        { text: "我而家喺緊地鐵站等你。", phonetic: "ngo5 ji4 gaa1 hai2 gan2 dei6 tit3 zaam6 dang2 nei5.", meaning: "Tôi đang đợi bạn ở ga tàu điện ngầm." },
        { text: "落雨喇，記得帶遮。", phonetic: "lok6 jyu5 laa3, gei3 dak1 daai3 ze1.", meaning: "Mưa rồi, nhớ mang ô." },
        { text: "我未食過呢樣嘢。", phonetic: "ngo5 mei6 sik6 gwo3 ni1 joeng6 je5.", meaning: "Tôi chưa ăn thứ này bao giờ." },
      ],
    },
    {
      id: "yue.2.finals",
      title: "Nghe kỹ âm cuối",
      level: "2",
      note: "Âm cuối -p -t -k đóng miệng không nhả hơi, và -m -n -ng rất dễ gộp.",
      lines: [
        { text: "十點食晏得唔得？", phonetic: "sap6 dim2 sik6 aan3 dak1 m4 dak1?", meaning: "Mười giờ ăn trưa được không?" },
        { text: "佢喺北角落車。", phonetic: "keoi5 hai2 bak1 gok3 lok6 ce1.", meaning: "Anh ấy xuống xe ở Bắc Giác." },
        { text: "我心諗佢應該唔嚟。", phonetic: "ngo5 sam1 nam2 keoi5 jing1 goi1 m4 lai4.", meaning: "Tôi nghĩ bụng chắc anh ấy không đến." },
        { text: "一年三百六十五日。", phonetic: "jat1 nin4 saam1 baak3 luk6 sap6 ng5 jat6.", meaning: "Một năm ba trăm sáu mươi lăm ngày." },
        { text: "食飯之前要洗手。", phonetic: "sik6 faan6 zi1 cin4 jiu3 sai2 sau2.", meaning: "Trước khi ăn cơm phải rửa tay." },
        { text: "佢住喺深水埗。", phonetic: "keoi5 zyu6 hai2 sam1 seoi2 bou2.", meaning: "Anh ấy ở Thâm Thuỷ Bộ." },
        { text: "今晚八點開始。", phonetic: "gam1 maan5 baat3 dim2 hoi1 ci2.", meaning: "Tối nay tám giờ bắt đầu." },
        { text: "呢本書好厚。", phonetic: "ni1 bun2 syu1 hou2 hau5.", meaning: "Quyển sách này rất dày." },
      ],
    },
    {
      id: "yue.3.particles",
      title: "Trợ từ cuối câu",
      level: "3",
      note: "Nghe hết chữ mà không bắt được thái độ thì chính là thiếu chỗ này.",
      lines: [
        { text: "佢都唔知喎。", phonetic: "keoi5 dou1 m4 zi1 wo3.", meaning: "Hoá ra anh ấy cũng không biết đấy." },
        { text: "你真係唔記得咩？", phonetic: "nei5 zan1 hai6 m4 gei3 dak1 me1?", meaning: "Bạn thật sự không nhớ à?" },
        { text: "咁樣做咪得囉。", phonetic: "gam2 joeng2 zou6 mai6 dak1 lo1.", meaning: "Làm vậy là được rồi chứ gì." },
        { text: "我淨係想問吓啫。", phonetic: "ngo5 zing6 hai6 soeng2 man6 haa5 ze1.", meaning: "Tôi chỉ muốn hỏi một chút thôi mà." },
        { text: "佢應該返咗屋企啩。", phonetic: "keoi5 jing1 goi1 faan1 zo2 uk1 kei2 gwaa3.", meaning: "Chắc anh ấy về nhà rồi ấy nhỉ." },
        { text: "我哋仲要等添。", phonetic: "ngo5 dei6 zung6 jiu3 dang2 tim1.", meaning: "Chúng ta còn phải đợi nữa cơ." },
        { text: "你之前講過㗎嘛。", phonetic: "nei5 zi1 cin4 gong2 gwo3 gaa3 maa3.", meaning: "Bạn nói rồi mà, đúng không." },
        { text: "唔係咁㗎喎。", phonetic: "m4 hai6 gam2 gaa3 wo3.", meaning: "Không phải vậy đâu đấy." },
      ],
    },
    {
      id: "yue.4.conversation",
      title: "Hội thoại tự nhiên",
      level: "4",
      note: "Tốc độ nói thật, có nói tắt và nuốt âm.",
      lines: [
        { text: "你話畀我聽究竟發生咗咩事。", phonetic: "nei5 waa6 bei2 ngo5 teng1 gau3 ging2 faat3 sang1 zo2 me1 si6.", meaning: "Bạn kể cho tôi nghe rốt cuộc đã xảy ra chuyện gì." },
        { text: "如果你唔想去就唔好勉強自己。", phonetic: "jyu4 gwo2 nei5 m4 soeng2 heoi3 zau6 m4 hou2 min5 koeng5 zi6 gei2.", meaning: "Nếu bạn không muốn đi thì đừng ép mình." },
        { text: "我覺得呢件事冇咁簡單。", phonetic: "ngo5 gok3 dak1 ni1 gin6 si6 mou5 gam3 gaan2 daan1.", meaning: "Tôi thấy chuyện này không đơn giản như vậy." },
        { text: "佢做嘢好認真，從來唔會求其。", phonetic: "keoi5 zou6 je5 hou2 jing6 zan1, cung4 loi4 m4 wui5 kau4 kei4.", meaning: "Anh ấy làm việc rất nghiêm túc, chưa bao giờ qua loa." },
        { text: "講真，我都唔知點算好。", phonetic: "gong2 zan1, ngo5 dou1 m4 zi1 dim2 syun3 hou2.", meaning: "Nói thật, tôi cũng không biết phải làm sao." },
        { text: "呢個機會好難得，千祈唔好錯過。", phonetic: "ni1 go3 gei1 wui6 hou2 naan4 dak1, cin1 kei4 m4 hou2 co3 gwo3.", meaning: "Cơ hội này hiếm lắm, đừng có bỏ lỡ." },
        { text: "佢啱啱先走咗冇耐。", phonetic: "keoi5 ngaam1 ngaam1 sin1 zau2 zo2 mou5 noi6.", meaning: "Anh ấy vừa mới đi chưa lâu." },
        { text: "無論點樣我都會支持你。", phonetic: "mou4 leon6 dim2 joeng2 ngo5 dou1 wui5 zi1 ci4 nei5.", meaning: "Dù thế nào tôi cũng ủng hộ bạn." },
      ],
    },
  ],
};
