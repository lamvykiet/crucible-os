import type { DictationPack } from "./types";

/**
 * Tiếng Pháp — bộ câu chép chính tả, xếp theo CEFR.
 *
 * Chép chính tả tiếng Pháp khó hơn hẳn nghe hiểu, vì phần lớn phụ âm cuối không
 * đọc và hợp giống hợp số cũng không nghe ra: "il parle", "ils parlent" nghe y
 * hệt nhau. Nên bộ câu ở đây nhắm thẳng vào chỗ đó — nghe xong còn phải suy ra
 * viết thế nào.
 */
export const FR_DICTATION: DictationPack = {
  code: "fr",
  scale: "CEFR",
  levels: ["A1", "A2", "B1", "B2", "C1"],
  accepts: ["script"],
  sets: [
    {
      id: "fr.a1.basics",
      title: "Câu đời thường",
      level: "A1",
      note: "Câu ngắn, để quen nhịp nghe và cách gõ dấu.",
      lines: [
        { text: "Je m'appelle Marie et j'habite à Lyon.", phonetic: "/ʒə mapɛl maʁi e ʒabit a ljɔ̃/", meaning: "Tôi tên Marie và tôi sống ở Lyon." },
        { text: "Il y a une boulangerie en face.", phonetic: "/il i a yn bulɑ̃ʒʁi ɑ̃ fas/", meaning: "Đối diện có một tiệm bánh mì." },
        { text: "Quelle heure est-il, s'il vous plaît ?", phonetic: "/kɛl œʁ ɛ til sil vu plɛ/", meaning: "Mấy giờ rồi ạ?" },
        { text: "Nous avons deux enfants.", phonetic: "/nu zavɔ̃ dø zɑ̃fɑ̃/", meaning: "Chúng tôi có hai đứa con." },
        { text: "Je voudrais un café, s'il vous plaît.", phonetic: "/ʒə vudʁɛ œ̃ kafe sil vu plɛ/", meaning: "Cho tôi một ly cà phê ạ." },
        { text: "Elle travaille dans une école.", phonetic: "/ɛl tʁavaj dɑ̃ zyn ekɔl/", meaning: "Cô ấy làm việc trong một trường học." },
        { text: "Le train part à huit heures.", phonetic: "/lə tʁɛ̃ paʁ a ɥi tœʁ/", meaning: "Tàu chạy lúc tám giờ." },
        { text: "Je ne comprends pas très bien.", phonetic: "/ʒə nə kɔ̃pʁɑ̃ pa tʁɛ bjɛ̃/", meaning: "Tôi không hiểu lắm." },
      ],
    },
    {
      id: "fr.a2.silent",
      title: "Chữ cuối không đọc",
      level: "A2",
      note: "Nghe ra câu là một chuyện, viết đúng phụ âm câm là chuyện khác.",
      lines: [
        { text: "Les petits enfants jouent dans le jardin.", phonetic: "/le pəti zɑ̃fɑ̃ ʒu dɑ̃ lə ʒaʁdɛ̃/", meaning: "Bọn trẻ con chơi trong vườn." },
        { text: "Ils parlent français tous les jours.", phonetic: "/il paʁl fʁɑ̃sɛ tu le ʒuʁ/", meaning: "Họ nói tiếng Pháp hằng ngày." },
        { text: "Elles sont arrivées très tard hier soir.", phonetic: "/ɛl sɔ̃t aʁive tʁɛ taʁ jɛʁ swaʁ/", meaning: "Họ đến rất muộn tối qua." },
        { text: "Mes amis habitent dans ce quartier.", phonetic: "/me zami abit dɑ̃ sə kaʁtje/", meaning: "Bạn tôi sống ở khu này." },
        { text: "Il fait beaucoup trop chaud aujourd'hui.", phonetic: "/il fɛ boku tʁo ʃo oʒuʁdɥi/", meaning: "Hôm nay nóng quá mức." },
        { text: "Nous prenons le bus pour aller au travail.", phonetic: "/nu pʁənɔ̃ lə bys puʁ ale o tʁavaj/", meaning: "Chúng tôi đi xe buýt tới chỗ làm." },
        { text: "Ces livres sont très intéressants.", phonetic: "/se livʁ sɔ̃ tʁɛ zɛ̃teʁesɑ̃/", meaning: "Mấy quyển sách này rất thú vị." },
        { text: "Vous avez oublié vos clés.", phonetic: "/vu zave ublije vo kle/", meaning: "Anh chị bỏ quên chìa khoá rồi." },
      ],
    },
    {
      id: "fr.b1.past",
      title: "Kể chuyện quá khứ",
      level: "B1",
      note: "Passé composé và imparfait đan nhau, kèm hợp phân từ.",
      lines: [
        { text: "Quand je suis arrivé, il pleuvait déjà.", phonetic: "/kɑ̃ ʒə sɥi zaʁive il pløvɛ deʒa/", meaning: "Khi tôi tới thì trời đã mưa rồi." },
        { text: "Elle m'a dit qu'elle ne viendrait pas.", phonetic: "/ɛl ma di kɛl nə vjɛ̃dʁɛ pa/", meaning: "Cô ấy bảo tôi là cô ấy sẽ không đến." },
        { text: "Nous avons visité plusieurs musées cet été.", phonetic: "/nu zavɔ̃ vizite plyzjœʁ myze sɛt ete/", meaning: "Hè này chúng tôi thăm nhiều bảo tàng." },
        { text: "Les lettres que j'ai écrites sont restées sans réponse.", phonetic: "/le lɛtʁ kə ʒe ekʁit sɔ̃ ʁɛste sɑ̃ ʁepɔ̃s/", meaning: "Những lá thư tôi viết vẫn không có hồi âm." },
        { text: "Il avait déjà mangé quand nous sommes rentrés.", phonetic: "/il avɛ deʒa mɑ̃ʒe kɑ̃ nu sɔm ʁɑ̃tʁe/", meaning: "Anh ấy đã ăn rồi khi chúng tôi về." },
        { text: "Je me suis levée très tôt ce matin-là.", phonetic: "/ʒə mə sɥi ləve tʁɛ to sə matɛ̃ la/", meaning: "Sáng hôm ấy tôi dậy rất sớm." },
        { text: "Ils se sont rencontrés il y a trois ans.", phonetic: "/il sə sɔ̃ ʁɑ̃kɔ̃tʁe il i a tʁwa zɑ̃/", meaning: "Họ gặp nhau cách đây ba năm." },
        { text: "Pendant qu'elle lisait, le téléphone a sonné.", phonetic: "/pɑ̃dɑ̃ kɛl lizɛ lə telefɔn a sɔne/", meaning: "Trong lúc cô ấy đọc thì điện thoại reo." },
      ],
    },
    {
      id: "fr.b1.liaison",
      title: "Nghe kỹ chỗ nối âm",
      level: "B1",
      note: "Phụ âm cuối vốn câm lại thức dậy trước nguyên âm — nghe liền một khối.",
      lines: [
        { text: "Nous allons en Italie au mois d'août.", phonetic: "/nu zalɔ̃ ɑ̃n itali o mwa dut/", meaning: "Tháng Tám chúng tôi đi Ý." },
        { text: "Ce sont des amis de mon frère.", phonetic: "/sə sɔ̃ de zami də mɔ̃ fʁɛʁ/", meaning: "Đó là bạn của anh tôi." },
        { text: "On y va dans un instant.", phonetic: "/ɔ̃n i va dɑ̃ zœ̃n ɛ̃stɑ̃/", meaning: "Chúng ta đi ngay bây giờ." },
        { text: "Il est arrivé en avance encore une fois.", phonetic: "/il ɛt aʁive ɑ̃n avɑ̃s ɑ̃kɔʁ yn fwa/", meaning: "Anh ấy lại đến sớm lần nữa." },
        { text: "Les autres ont déjà commencé sans nous.", phonetic: "/le zotʁ ɔ̃ deʒa kɔmɑ̃se sɑ̃ nu/", meaning: "Những người khác đã bắt đầu mà không có chúng ta." },
        { text: "Vous en avez besoin tout de suite ?", phonetic: "/vu zɑ̃n ave bəzwɛ̃ tu də sɥit/", meaning: "Anh chị cần nó ngay bây giờ à?" },
        { text: "Quand est-ce qu'on en parle ?", phonetic: "/kɑ̃t ɛs kɔ̃n ɑ̃ paʁl/", meaning: "Khi nào chúng ta bàn chuyện đó?" },
        { text: "Deux heures plus tard, tout était fini.", phonetic: "/dø zœʁ ply taʁ tut etɛ fini/", meaning: "Hai tiếng sau thì mọi việc đã xong." },
      ],
    },
    {
      id: "fr.b2.subjunctive",
      title: "Câu có thức giả định",
      level: "B2",
      note: "Giả định thường không nghe khác trần thuật, phải suy từ mệnh đề chính.",
      lines: [
        { text: "Il faut que tu partes avant qu'il ne soit trop tard.", phonetic: "/il fo kə ty paʁt avɑ̃ kil nə swa tʁo taʁ/", meaning: "Cậu phải đi trước khi quá muộn." },
        { text: "Bien qu'elle soit fatiguée, elle continue à travailler.", phonetic: "/bjɛ̃ kɛl swa fatiɡe ɛl kɔ̃tiny a tʁavaje/", meaning: "Dù mệt, cô ấy vẫn làm tiếp." },
        { text: "Je ne pense pas qu'il ait compris la question.", phonetic: "/ʒə nə pɑ̃s pa kil ɛ kɔ̃pʁi la kɛstjɔ̃/", meaning: "Tôi không nghĩ anh ấy hiểu câu hỏi." },
        { text: "Nous aimerions que vous veniez plus souvent.", phonetic: "/nu zɛməʁjɔ̃ kə vu vənje ply suvɑ̃/", meaning: "Chúng tôi mong anh chị đến thường xuyên hơn." },
        { text: "Il est important que chacun fasse sa part.", phonetic: "/il ɛt ɛ̃pɔʁtɑ̃ kə ʃakœ̃ fas sa paʁ/", meaning: "Quan trọng là mỗi người làm phần việc của mình." },
        { text: "Pour que cela marche, il faudrait plus de temps.", phonetic: "/puʁ kə səla maʁʃ il fodʁɛ ply də tɑ̃/", meaning: "Để việc đó chạy được thì cần thêm thời gian." },
        { text: "À moins qu'il ne pleuve, nous sortirons.", phonetic: "/a mwɛ̃ kil nə pløv nu sɔʁtiʁɔ̃/", meaning: "Trừ khi trời mưa, chúng tôi sẽ đi ra ngoài." },
        { text: "C'est le seul qui sache vraiment le faire.", phonetic: "/sɛ lə sœl ki saʃ vʁɛmɑ̃ lə fɛʁ/", meaning: "Đó là người duy nhất thật sự biết làm việc đó." },
      ],
    },
    {
      id: "fr.c1.formal",
      title: "Văn nói trang trọng",
      level: "C1",
      note: "Câu dài, từ vựng văn viết, nhịp của bản tin và diễn văn.",
      lines: [
        { text: "Les résultats de l'enquête seront publiés dans les prochains jours.", phonetic: "/le ʁezylta də lɑ̃kɛt səʁɔ̃ pyblije dɑ̃ le pʁɔʃɛ̃ ʒuʁ/", meaning: "Kết quả điều tra sẽ được công bố trong vài ngày tới." },
        { text: "Le gouvernement envisage de revoir l'ensemble du dispositif.", phonetic: "/lə ɡuvɛʁnəmɑ̃ ɑ̃viʒaʒ də ʁəvwaʁ lɑ̃sɑ̃bl dy dispozitif/", meaning: "Chính phủ tính xem lại toàn bộ cơ chế." },
        { text: "Cette décision a suscité de vives réactions.", phonetic: "/sɛt desizjɔ̃ a sysite də viv ʁeaksjɔ̃/", meaning: "Quyết định này đã gây ra nhiều phản ứng gay gắt." },
        { text: "Il convient de souligner que les chiffres restent provisoires.", phonetic: "/il kɔ̃vjɛ̃ də suliɲe kə le ʃifʁ ʁɛst pʁɔvizwaʁ/", meaning: "Cần nhấn mạnh rằng các con số vẫn là tạm thời." },
        { text: "La situation s'est nettement améliorée depuis le début de l'année.", phonetic: "/la sitɥasjɔ̃ sɛ nɛtmɑ̃ ameljɔʁe dəpɥi lə deby də lane/", meaning: "Tình hình đã cải thiện rõ rệt từ đầu năm." },
        { text: "Rien ne permet d'affirmer qu'il en sera de même l'an prochain.", phonetic: "/ʁjɛ̃ nə pɛʁmɛ dafiʁme kil ɑ̃ səʁa də mɛm lɑ̃ pʁɔʃɛ̃/", meaning: "Không gì cho phép khẳng định sang năm cũng như vậy." },
        { text: "Ces mesures visent avant tout à protéger les plus fragiles.", phonetic: "/se məzyʁ viz avɑ̃ tu a pʁɔteʒe le ply fʁaʒil/", meaning: "Các biện pháp này trước hết nhằm bảo vệ những người yếu thế nhất." },
        { text: "Le débat est loin d'être clos.", phonetic: "/lə deba ɛ lwɛ̃ dɛtʁ klo/", meaning: "Cuộc tranh luận còn lâu mới khép lại." },
      ],
    },
  ],
};
