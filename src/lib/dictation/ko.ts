import type { DictationPack } from "./types";

/**
 * Tiếng Hàn — bộ câu chép chính tả, xếp theo TOPIK.
 *
 * Chép chính tả tiếng Hàn khó vì cách VIẾT và cách ĐỌC lệch nhau có hệ thống:
 * phụ âm cuối chạy sang âm tiết sau (한국어 đọc thành han-gu-geo), rồi biến âm
 * mũi (학년 đọc thành hang-nyeon). Nghe ra tiếng là một chuyện, viết đúng chính
 * tả lại là chuyện khác — và đó chính là chỗ bài này luyện.
 *
 * Nhận cả Hangul lẫn phiên âm La-tinh khi chấm, cho người chưa cài bộ gõ.
 */
export const KO_DICTATION: DictationPack = {
  code: "ko",
  scale: "TOPIK",
  levels: ["1", "2", "3", "4", "5", "6"],
  accepts: ["script", "phonetic"],
  sets: [
    {
      id: "ko.1.greetings",
      title: "Chào hỏi và giới thiệu",
      level: "1",
      note: "Câu ngắn nhất, quen với bậc 해요 và với cách gõ Hangul.",
      lines: [
        { text: "안녕하세요, 저는 민수입니다.", phonetic: "annyeonghaseyo, jeoneun minsu-imnida.", meaning: "Xin chào, tôi là Min-su." },
        { text: "만나서 반갑습니다.", phonetic: "mannaseo bangapseumnida.", meaning: "Rất vui được gặp bạn." },
        { text: "저는 베트남 사람이에요.", phonetic: "jeoneun beteunam saram-ieyo.", meaning: "Tôi là người Việt Nam." },
        { text: "이름이 뭐예요?", phonetic: "ireumi mwoyeyo?", meaning: "Tên bạn là gì?" },
        { text: "한국어를 조금 할 수 있어요.", phonetic: "hangugeoreul jogeum hal su isseoyo.", meaning: "Tôi nói được một chút tiếng Hàn." },
        { text: "감사합니다, 안녕히 가세요.", phonetic: "gamsahamnida, annyeonghi gaseyo.", meaning: "Cảm ơn, tạm biệt anh chị." },
        { text: "지금 몇 시예요?", phonetic: "jigeum myeot siyeyo?", meaning: "Bây giờ mấy giờ?" },
        { text: "저는 회사원이에요.", phonetic: "jeoneun hoesawon-ieyo.", meaning: "Tôi là nhân viên công ty." },
      ],
    },
    {
      id: "ko.1.liaison",
      title: "Phụ âm cuối chạy sang",
      level: "1",
      note: "Viết một đằng đọc một nẻo — chỗ chép sai nhiều nhất khi mới học.",
      lines: [
        { text: "한국어 공부가 재미있어요.", phonetic: "hangugeo gongbuga jaemiisseoyo.", meaning: "Học tiếng Hàn thì thú vị." },
        { text: "음악을 들으면서 일해요.", phonetic: "eumageul deureumyeonseo ilhaeyo.", meaning: "Tôi vừa nghe nhạc vừa làm việc." },
        { text: "이 옷을 입어 보세요.", phonetic: "i oseul ibeo boseyo.", meaning: "Anh chị mặc thử cái áo này đi." },
        { text: "밥을 먹은 후에 산책해요.", phonetic: "babeul meogeun hue sanchaekhaeyo.", meaning: "Ăn cơm xong thì đi dạo." },
        { text: "책상 위에 책이 있어요.", phonetic: "chaeksang wie chaegi isseoyo.", meaning: "Trên bàn có quyển sách." },
        { text: "꽃이 아주 예뻐요.", phonetic: "kkochi aju yeppeoyo.", meaning: "Hoa rất đẹp." },
        { text: "학교 앞에서 만나요.", phonetic: "hakgyo apeseo mannayo.", meaning: "Gặp nhau trước cổng trường nhé." },
        { text: "값이 생각보다 비싸요.", phonetic: "gapsi saenggakboda bissayo.", meaning: "Giá đắt hơn tôi nghĩ." },
      ],
    },
    {
      id: "ko.2.daily",
      title: "Việc thường ngày",
      level: "2",
      note: "Câu dài hơn, có đuôi nối.",
      lines: [
        { text: "저는 매일 아침 일곱 시에 일어나요.", phonetic: "jeoneun maeil achim ilgop sie ireonayo.", meaning: "Mỗi sáng tôi dậy lúc bảy giờ." },
        { text: "시간이 없어서 아침을 못 먹었어요.", phonetic: "sigani eopseoseo achimeul mot meogeosseoyo.", meaning: "Vì không có thời gian nên tôi không ăn sáng được." },
        { text: "비가 와서 우산을 가지고 왔어요.", phonetic: "biga waseo usaneul gajigo wasseoyo.", meaning: "Trời mưa nên tôi mang ô theo." },
        { text: "주말에 친구를 만나려고 해요.", phonetic: "jumare chingureul mannaryeogo haeyo.", meaning: "Cuối tuần tôi định gặp bạn." },
        { text: "이번 주는 좀 바쁜데요.", phonetic: "ibeon juneun jom bappeundeyo.", meaning: "Tuần này thì hơi bận." },
        { text: "지하철을 타는 게 더 빨라요.", phonetic: "jihacheoreul taneun ge deo ppallayo.", meaning: "Đi tàu điện ngầm thì nhanh hơn." },
        { text: "여기에서 사진을 찍어도 돼요?", phonetic: "yeogieseo sajineul jjigeodo dwaeyo?", meaning: "Ở đây chụp ảnh được không ạ?" },
        { text: "어제는 늦게까지 일했어요.", phonetic: "eojeneun neutgekkaji ilhaesseoyo.", meaning: "Hôm qua tôi làm đến muộn." },
      ],
    },
    {
      id: "ko.3.honorifics",
      title: "Kính ngữ và bậc nói",
      level: "3",
      note: "Cùng một ý, ba bậc nói khác nhau — nghe ra bậc là nghe ra quan hệ.",
      lines: [
        { text: "선생님께서 지금 자리에 안 계십니다.", phonetic: "seonsaengnimkkeseo jigeum jarie an gyesimnida.", meaning: "Thầy hiện không có ở chỗ ngồi ạ." },
        { text: "할머니께 선물을 드렸어요.", phonetic: "halmeonikke seonmureul deuryeosseoyo.", meaning: "Tôi đã tặng quà cho bà." },
        { text: "사장님은 회의 중이십니다.", phonetic: "sajangnimeun hoeui jung-isimnida.", meaning: "Giám đốc đang họp ạ." },
        { text: "부모님께서 식사하고 계세요.", phonetic: "bumonimkkeseo siksahago gyeseyo.", meaning: "Bố mẹ đang dùng bữa ạ." },
        { text: "잠시만 기다려 주시겠어요?", phonetic: "jamsiman gidaryeo jusigesseoyo?", meaning: "Anh chị đợi một lát được không ạ?" },
        { text: "제가 도와 드릴까요?", phonetic: "jega dowa deurilkkayo?", meaning: "Để tôi giúp anh chị nhé?" },
        { text: "말씀 좀 여쭤 봐도 될까요?", phonetic: "malsseum jom yeojjwo bwado doelkkayo?", meaning: "Tôi hỏi thăm một chút được không ạ?" },
        { text: "연세가 어떻게 되세요?", phonetic: "yeonsega eotteoke doeseyo?", meaning: "Bác bao nhiêu tuổi ạ?" },
      ],
    },
    {
      id: "ko.4.sound-change",
      title: "Biến âm giữa hai âm tiết",
      level: "4",
      note: "Viết và đọc lệch hẳn nhau — đọc từng chữ một là chép sai.",
      lines: [
        { text: "올해 학년이 바뀌었어요.", phonetic: "olhae hangnyeoni bakkwieosseoyo.", meaning: "Năm nay khối lớp đã đổi." },
        { text: "국물이 정말 시원합니다.", phonetic: "gungmuri jeongmal siwonhamnida.", meaning: "Nước dùng thật là thanh mát." },
        { text: "십만 원쯤 들었어요.", phonetic: "simman wonjjeum deureosseoyo.", meaning: "Tốn khoảng mười vạn won." },
        { text: "꽃놀이를 가기로 했어요.", phonetic: "kkonnorireul gagiro haesseoyo.", meaning: "Chúng tôi quyết định đi ngắm hoa." },
        { text: "신라 시대의 유물입니다.", phonetic: "silla sidae-ui yumurimnida.", meaning: "Đây là di vật thời Tân La." },
        { text: "좋은 결과가 나왔습니다.", phonetic: "joeun gyeolgwaga nawatseumnida.", meaning: "Kết quả tốt đã ra rồi." },
        { text: "앞문으로 들어오세요.", phonetic: "ammuneuro deureooseyo.", meaning: "Mời vào bằng cửa trước." },
        { text: "몇 년 동안 준비했어요.", phonetic: "myeon nyeon dongan junbihaesseoyo.", meaning: "Tôi đã chuẩn bị trong mấy năm." },
      ],
    },
    {
      id: "ko.5.formal",
      title: "Tin tức và văn viết",
      level: "5",
      note: "Thể 한다, từ Hán Hàn, câu dài — nhịp của bản tin.",
      lines: [
        { text: "정부는 내년부터 새로운 제도를 시행할 예정이다.", phonetic: "jeongbuneun naenyeonbuteo saeroun jedoreul sihaenghal yejeong-ida.", meaning: "Chính phủ dự định thi hành chế độ mới từ năm sau." },
        { text: "최근 조사에 따르면 청년 실업률이 감소했다.", phonetic: "choegeun josae ttareumyeon cheongnyeon sireomnyuri gamsohaetda.", meaning: "Theo điều tra gần đây, tỷ lệ thất nghiệp của thanh niên đã giảm." },
        { text: "전문가들은 이러한 현상이 계속될 것으로 보고 있다.", phonetic: "jeonmun-gadeureun ireohan hyeonsang-i gyesokdoel geoseuro bogo itda.", meaning: "Các chuyên gia cho rằng hiện tượng này sẽ còn tiếp diễn." },
        { text: "이번 결정은 많은 논란을 불러일으켰다.", phonetic: "ibeon gyeoljeong-eun maneun nollaneul bulleoireukyeotda.", meaning: "Quyết định lần này đã gây ra nhiều tranh cãi." },
        { text: "해당 기업은 구체적인 계획을 다음 달에 발표한다.", phonetic: "haedang gieobeun guchejeogin gyehoegeul da-eum dare balpyohanda.", meaning: "Doanh nghiệp này sẽ công bố kế hoạch cụ thể vào tháng sau." },
        { text: "기술의 발전과 함께 생활 방식도 크게 달라졌다.", phonetic: "gisurui baljeongwa hamkke saenghwal bangsikdo keuge dallajyeotda.", meaning: "Cùng với tiến bộ kỹ thuật, lối sống cũng thay đổi nhiều." },
        { text: "회의는 세 시간 가까이 계속되었다.", phonetic: "hoeuineun se sigan gakkai gyesokdoeeotda.", meaning: "Cuộc họp kéo dài gần ba tiếng." },
        { text: "이에 대한 대책 마련이 시급한 상황이다.", phonetic: "ie daehan daechaek maryeoni sigeuphan sanghwang-ida.", meaning: "Tình hình cấp bách cần có đối sách cho việc này." },
      ],
    },
  ],
};
