import type { DictationPack } from "./types";

/**
 * Tiếng Trung Quan Thoại — bộ câu chép chính tả, xếp theo HSK.
 *
 * Chữ Hán soạn theo giản thể, phiên âm pinyin có dấu thanh.
 *
 * Nhận CẢ chữ Hán lẫn pinyin khi chấm. Bắt gõ chữ Hán là loại luôn người chưa
 * cài bộ gõ tiếng Trung, mà mục tiêu bài này là NGHE RA được câu chứ không phải
 * thi gõ bàn phím. Người gõ được chữ Hán thì cứ gõ, khó hơn và học được nhiều
 * hơn.
 *
 * Câu chọn theo hướng nghe: ưu tiên những chỗ người Việt hay nghe nhầm — thanh
 * 2 với thanh 3, âm uốn lưỡi zh/ch/sh với z/c/s, và ü.
 */
export const CMN_DICTATION: DictationPack = {
  code: "cmn",
  scale: "HSK",
  levels: ["1", "2", "3", "4", "5", "6"],
  accepts: ["script", "phonetic"],
  sets: [
    {
      id: "cmn.hsk1.greetings",
      title: "Chào hỏi và làm quen",
      level: "1",
      note: "Câu ngắn nhất, để quen với nhịp nghe và cách gõ đáp án.",
      lines: [
        { text: "你好，我叫李明。", phonetic: "nǐ hǎo, wǒ jiào Lǐ Míng.", meaning: "Chào bạn, tôi tên là Lý Minh." },
        { text: "很高兴认识你。", phonetic: "hěn gāoxìng rènshi nǐ.", meaning: "Rất vui được quen biết bạn." },
        { text: "你叫什么名字？", phonetic: "nǐ jiào shénme míngzi?", meaning: "Bạn tên là gì?" },
        { text: "我是中国人。", phonetic: "wǒ shì Zhōngguó rén.", meaning: "Tôi là người Trung Quốc." },
        { text: "他是我的老师。", phonetic: "tā shì wǒ de lǎoshī.", meaning: "Anh ấy là thầy giáo của tôi." },
        { text: "你好吗？我很好。", phonetic: "nǐ hǎo ma? wǒ hěn hǎo.", meaning: "Bạn khoẻ không? Tôi khoẻ." },
        { text: "谢谢你，不客气。", phonetic: "xièxie nǐ, bú kèqi.", meaning: "Cảm ơn bạn, không có gì." },
        { text: "再见，明天见。", phonetic: "zàijiàn, míngtiān jiàn.", meaning: "Tạm biệt, mai gặp lại." },
      ],
    },
    {
      id: "cmn.hsk1.numbers-time",
      title: "Số đếm và thời gian",
      level: "1",
      note: "Số và giờ giấc là chỗ nghe hụt nhiều nhất khi mới học.",
      lines: [
        { text: "现在几点了？", phonetic: "xiànzài jǐ diǎn le?", meaning: "Bây giờ mấy giờ rồi?" },
        { text: "现在是三点半。", phonetic: "xiànzài shì sān diǎn bàn.", meaning: "Bây giờ là ba giờ rưỡi." },
        { text: "我有两个孩子。", phonetic: "wǒ yǒu liǎng ge háizi.", meaning: "Tôi có hai đứa con." },
        { text: "今天是星期三。", phonetic: "jīntiān shì xīngqīsān.", meaning: "Hôm nay là thứ Tư." },
        { text: "这本书十五块钱。", phonetic: "zhè běn shū shíwǔ kuài qián.", meaning: "Quyển sách này mười lăm tệ." },
        { text: "我八点去学校。", phonetic: "wǒ bā diǎn qù xuéxiào.", meaning: "Tám giờ tôi đi đến trường." },
        { text: "他今年二十岁。", phonetic: "tā jīnnián èrshí suì.", meaning: "Năm nay anh ấy hai mươi tuổi." },
        { text: "一共多少钱？", phonetic: "yígòng duōshao qián?", meaning: "Tổng cộng bao nhiêu tiền?" },
      ],
    },
    {
      id: "cmn.hsk2.daily",
      title: "Việc thường ngày",
      level: "2",
      note: "Câu dài hơn, có trạng ngữ thời gian đứng trước động từ.",
      lines: [
        { text: "我每天早上六点起床。", phonetic: "wǒ měitiān zǎoshang liù diǎn qǐchuáng.", meaning: "Mỗi sáng tôi dậy lúc sáu giờ." },
        { text: "他在房间里看电视。", phonetic: "tā zài fángjiān lǐ kàn diànshì.", meaning: "Anh ấy đang xem tivi trong phòng." },
        { text: "我们一起去吃饭吧。", phonetic: "wǒmen yìqǐ qù chīfàn ba.", meaning: "Chúng ta cùng đi ăn cơm nhé." },
        { text: "今天的天气很不错。", phonetic: "jīntiān de tiānqì hěn búcuò.", meaning: "Thời tiết hôm nay khá đẹp." },
        { text: "请问，洗手间在哪儿？", phonetic: "qǐngwèn, xǐshǒujiān zài nǎr?", meaning: "Xin hỏi, nhà vệ sinh ở đâu?" },
        { text: "我想买一件衣服。", phonetic: "wǒ xiǎng mǎi yí jiàn yīfu.", meaning: "Tôi muốn mua một cái áo." },
        { text: "她的孩子在学校学习。", phonetic: "tā de háizi zài xuéxiào xuéxí.", meaning: "Con của chị ấy đang học ở trường." },
        { text: "我昨天没有去公司。", phonetic: "wǒ zuótiān méiyǒu qù gōngsī.", meaning: "Hôm qua tôi không đi công ty." },
      ],
    },
    {
      id: "cmn.hsk2.tones-23",
      title: "Nghe kỹ thanh 2 và thanh 3",
      level: "2",
      note: "Bộ này cố ý dồn nhiều chữ thanh 2 và thanh 3 đứng cạnh nhau — chỗ người Việt hay nghe lẫn nhất.",
      lines: [
        { text: "你买的苹果很好吃。", phonetic: "nǐ mǎi de píngguǒ hěn hǎochī.", meaning: "Táo bạn mua rất ngon." },
        { text: "我以为你没来。", phonetic: "wǒ yǐwéi nǐ méi lái.", meaning: "Tôi tưởng bạn không đến." },
        { text: "老师让我们早点回家。", phonetic: "lǎoshī ràng wǒmen zǎodiǎn huí jiā.", meaning: "Thầy bảo chúng tôi về nhà sớm." },
        { text: "他很喜欢喝啤酒。", phonetic: "tā hěn xǐhuan hē píjiǔ.", meaning: "Anh ấy rất thích uống bia." },
        { text: "请你等我五分钟。", phonetic: "qǐng nǐ děng wǒ wǔ fēnzhōng.", meaning: "Xin đợi tôi năm phút." },
        { text: "我找了你很久。", phonetic: "wǒ zhǎo le nǐ hěn jiǔ.", meaning: "Tôi tìm bạn rất lâu." },
        { text: "这里有很多水果。", phonetic: "zhèlǐ yǒu hěn duō shuǐguǒ.", meaning: "Ở đây có rất nhiều hoa quả." },
        { text: "你可以走了。", phonetic: "nǐ kěyǐ zǒu le.", meaning: "Bạn có thể đi rồi." },
      ],
    },
    {
      id: "cmn.hsk3.retroflex",
      title: "Nghe kỹ zh ch sh r và z c s",
      level: "3",
      note: "Cặp âm uốn lưỡi và không uốn lưỡi. Nghe sai cặp này là chép sai cả câu.",
      lines: [
        { text: "这个字怎么写？", phonetic: "zhège zì zěnme xiě?", meaning: "Chữ này viết thế nào?" },
        { text: "他在食堂吃四个包子。", phonetic: "tā zài shítáng chī sì ge bāozi.", meaning: "Anh ấy ăn bốn cái bánh bao ở nhà ăn." },
        { text: "老师说这次考试很重要。", phonetic: "lǎoshī shuō zhè cì kǎoshì hěn zhòngyào.", meaning: "Thầy nói kỳ thi lần này rất quan trọng." },
        { text: "请坐在这张桌子旁边。", phonetic: "qǐng zuò zài zhè zhāng zhuōzi pángbiān.", meaning: "Mời ngồi cạnh cái bàn này." },
        { text: "他的中文水平提高得很快。", phonetic: "tā de Zhōngwén shuǐpíng tígāo de hěn kuài.", meaning: "Trình độ tiếng Trung của anh ấy tiến bộ rất nhanh." },
        { text: "四十四只石狮子。", phonetic: "sìshísì zhī shí shīzi.", meaning: "Bốn mươi tư con sư tử đá." },
        { text: "我最近很少出去。", phonetic: "wǒ zuìjìn hěn shǎo chūqù.", meaning: "Gần đây tôi ít ra ngoài." },
        { text: "他真的知道这件事。", phonetic: "tā zhēn de zhīdào zhè jiàn shì.", meaning: "Anh ấy thật sự biết chuyện này." },
      ],
    },
    {
      id: "cmn.hsk3.complements",
      title: "Câu có bổ ngữ",
      level: "3",
      note: "Bổ ngữ nằm sau động từ và thường bị nuốt khi nói nhanh.",
      lines: [
        { text: "我听懂了老师的话。", phonetic: "wǒ tīngdǒng le lǎoshī de huà.", meaning: "Tôi nghe hiểu lời thầy nói." },
        { text: "这个箱子我搬不动。", phonetic: "zhège xiāngzi wǒ bān bu dòng.", meaning: "Cái thùng này tôi khiêng không nổi." },
        { text: "他跑得比我快多了。", phonetic: "tā pǎo de bǐ wǒ kuài duō le.", meaning: "Anh ấy chạy nhanh hơn tôi nhiều." },
        { text: "请把窗户关上。", phonetic: "qǐng bǎ chuānghu guān shàng.", meaning: "Làm ơn đóng cửa sổ lại." },
        { text: "我们已经吃完饭了。", phonetic: "wǒmen yǐjīng chī wán fàn le.", meaning: "Chúng tôi đã ăn cơm xong rồi." },
        { text: "他想起来了那个名字。", phonetic: "tā xiǎng qǐlái le nàge míngzi.", meaning: "Anh ấy nhớ ra cái tên đó rồi." },
        { text: "这些菜你吃得完吗？", phonetic: "zhèxiē cài nǐ chī de wán ma?", meaning: "Mấy món này bạn ăn hết nổi không?" },
        { text: "他把书放在桌子上了。", phonetic: "tā bǎ shū fàng zài zhuōzi shàng le.", meaning: "Anh ấy để sách trên bàn rồi." },
      ],
    },
    {
      id: "cmn.hsk4.work",
      title: "Công việc và học hành",
      level: "4",
      note: "Câu dài, nhiều mệnh đề, tốc độ nói gần với người bản ngữ.",
      lines: [
        { text: "这份工作的压力比我想象的大。", phonetic: "zhè fèn gōngzuò de yālì bǐ wǒ xiǎngxiàng de dà.", meaning: "Áp lực của công việc này lớn hơn tôi tưởng." },
        { text: "他因为堵车所以迟到了半个小时。", phonetic: "tā yīnwèi dǔchē suǒyǐ chídào le bàn ge xiǎoshí.", meaning: "Vì tắc đường nên anh ấy đến muộn nửa tiếng." },
        { text: "虽然很累，但是我觉得很值得。", phonetic: "suīrán hěn lèi, dànshì wǒ juéde hěn zhíde.", meaning: "Tuy rất mệt nhưng tôi thấy rất đáng." },
        { text: "如果明天下雨，我们就改天再去。", phonetic: "rúguǒ míngtiān xiàyǔ, wǒmen jiù gǎitiān zài qù.", meaning: "Nếu mai mưa thì hôm khác chúng ta đi." },
        { text: "请你把这份材料发给经理。", phonetic: "qǐng nǐ bǎ zhè fèn cáiliào fā gěi jīnglǐ.", meaning: "Nhờ bạn gửi tài liệu này cho giám đốc." },
        { text: "我打算明年换一个工作。", phonetic: "wǒ dǎsuàn míngnián huàn yí ge gōngzuò.", meaning: "Tôi định sang năm đổi việc." },
        { text: "他不但会说汉语，而且说得很流利。", phonetic: "tā búdàn huì shuō Hànyǔ, érqiě shuō de hěn liúlì.", meaning: "Anh ấy không những biết nói tiếng Hán mà còn nói rất trôi chảy." },
        { text: "这个问题需要我们再讨论一下。", phonetic: "zhège wèntí xūyào wǒmen zài tǎolùn yíxià.", meaning: "Vấn đề này cần chúng ta bàn thêm một chút." },
      ],
    },
    {
      id: "cmn.hsk4.opinions",
      title: "Nêu ý kiến và cảm nghĩ",
      level: "4",
      note: "Cách nói vòng, nói giảm — chỗ nghe được chữ mà không bắt được ý.",
      lines: [
        { text: "在我看来，这件事没那么简单。", phonetic: "zài wǒ kànlái, zhè jiàn shì méi nàme jiǎndān.", meaning: "Theo tôi thấy, chuyện này không đơn giản như vậy." },
        { text: "我恐怕不能同意你的看法。", phonetic: "wǒ kǒngpà bù néng tóngyì nǐ de kànfǎ.", meaning: "E rằng tôi không thể đồng ý với cách nhìn của bạn." },
        { text: "说实话，我有点儿担心。", phonetic: "shuō shíhuà, wǒ yǒudiǎnr dānxīn.", meaning: "Nói thật thì tôi hơi lo." },
        { text: "这样做恐怕不太合适。", phonetic: "zhèyàng zuò kǒngpà bú tài héshì.", meaning: "Làm như vậy e là không hợp lắm." },
        { text: "我完全理解你的心情。", phonetic: "wǒ wánquán lǐjiě nǐ de xīnqíng.", meaning: "Tôi hoàn toàn hiểu tâm trạng của bạn." },
        { text: "其实我早就知道了。", phonetic: "qíshí wǒ zǎo jiù zhīdào le.", meaning: "Thật ra tôi biết từ lâu rồi." },
        { text: "无论如何，我都会支持你。", phonetic: "wúlùn rúhé, wǒ dōu huì zhīchí nǐ.", meaning: "Dù thế nào tôi cũng ủng hộ bạn." },
        { text: "这件事对我来说很重要。", phonetic: "zhè jiàn shì duì wǒ lái shuō hěn zhòngyào.", meaning: "Chuyện này đối với tôi rất quan trọng." },
      ],
    },
    {
      id: "cmn.hsk5.news",
      title: "Tin tức và xã hội",
      level: "5",
      note: "Từ vựng văn viết, câu dài — tập nghe bản tin.",
      lines: [
        { text: "根据最新的统计数据，今年的经济增长有所放缓。", phonetic: "gēnjù zuìxīn de tǒngjì shùjù, jīnnián de jīngjì zēngzhǎng yǒusuǒ fànghuǎn.", meaning: "Theo số liệu thống kê mới nhất, tăng trưởng kinh tế năm nay có phần chậm lại." },
        { text: "政府决定采取一系列措施来改善环境。", phonetic: "zhèngfǔ juédìng cǎiqǔ yíxìliè cuòshī lái gǎishàn huánjìng.", meaning: "Chính phủ quyết định áp dụng một loạt biện pháp để cải thiện môi trường." },
        { text: "越来越多的年轻人选择在大城市工作。", phonetic: "yuèláiyuè duō de niánqīngrén xuǎnzé zài dà chéngshì gōngzuò.", meaning: "Ngày càng nhiều người trẻ chọn làm việc ở thành phố lớn." },
        { text: "这项研究的结果引起了广泛的关注。", phonetic: "zhè xiàng yánjiū de jiéguǒ yǐnqǐ le guǎngfàn de guānzhù.", meaning: "Kết quả nghiên cứu này đã gây được sự chú ý rộng rãi." },
        { text: "专家认为这种现象与人口老龄化有关。", phonetic: "zhuānjiā rènwéi zhè zhǒng xiànxiàng yǔ rénkǒu lǎolínghuà yǒuguān.", meaning: "Chuyên gia cho rằng hiện tượng này liên quan tới già hoá dân số." },
        { text: "随着科技的发展，人们的生活方式发生了很大变化。", phonetic: "suízhe kējì de fāzhǎn, rénmen de shēnghuó fāngshì fāshēng le hěn dà biànhuà.", meaning: "Cùng với sự phát triển của khoa học kỹ thuật, lối sống của con người đã thay đổi rất nhiều." },
        { text: "该公司表示将在下个季度公布详细计划。", phonetic: "gāi gōngsī biǎoshì jiāng zài xià ge jìdù gōngbù xiángxì jìhuà.", meaning: "Công ty này cho biết sẽ công bố kế hoạch chi tiết vào quý sau." },
        { text: "这场会议持续了将近三个小时。", phonetic: "zhè chǎng huìyì chíxù le jiāngjìn sān ge xiǎoshí.", meaning: "Cuộc họp này kéo dài gần ba tiếng." },
      ],
    },
    {
      id: "cmn.hsk5.idioms",
      title: "Thành ngữ bốn chữ trong câu",
      level: "5",
      note: "Thành ngữ đọc liền một hơi, rất dễ nghe sót.",
      lines: [
        { text: "他做事一丝不苟，从来不马虎。", phonetic: "tā zuòshì yìsī-bùgǒu, cónglái bù mǎhu.", meaning: "Anh ấy làm việc tỉ mỉ từng li, chưa bao giờ qua loa." },
        { text: "这件事说起来容易，做起来难。", phonetic: "zhè jiàn shì shuō qǐlái róngyì, zuò qǐlái nán.", meaning: "Chuyện này nói thì dễ, làm mới khó." },
        { text: "我们应该实事求是地看待这个问题。", phonetic: "wǒmen yīnggāi shíshì-qiúshì de kàndài zhège wèntí.", meaning: "Chúng ta nên nhìn nhận vấn đề này một cách thực sự cầu thị." },
        { text: "他的建议让我茅塞顿开。", phonetic: "tā de jiànyì ràng wǒ máosè-dùnkāi.", meaning: "Lời khuyên của anh ấy làm tôi bừng tỉnh." },
        { text: "这两个方案各有千秋，很难取舍。", phonetic: "zhè liǎng ge fāng'àn gèyǒu-qiānqiū, hěn nán qǔshě.", meaning: "Hai phương án này đều có điểm hay riêng, rất khó chọn." },
        { text: "他总是三心二意，什么都做不好。", phonetic: "tā zǒngshì sānxīn-èryì, shénme dōu zuò bu hǎo.", meaning: "Anh ta lúc nào cũng ba phải, việc gì cũng không làm nên." },
        { text: "机会难得，千万不要错过。", phonetic: "jīhuì nándé, qiānwàn búyào cuòguò.", meaning: "Cơ hội khó có, ngàn vạn lần đừng bỏ lỡ." },
        { text: "他年纪轻轻就已经小有名气了。", phonetic: "tā niánjì qīngqīng jiù yǐjīng xiǎoyǒu-míngqì le.", meaning: "Anh ấy tuổi còn trẻ mà đã có chút tiếng tăm." },
      ],
    },
  ],
};
