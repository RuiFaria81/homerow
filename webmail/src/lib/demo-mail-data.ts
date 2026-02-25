import type {
  AutoReplySettings,
  BlockedSender,
  ContactEntry,
  EmailAttachment,
  EmailMessage,
  FullEmail,
  SendEmailOptions,
  SendEmailResult,
} from "./mail-client";
import { DEMO_USER_PROFILE } from "./demo-user";

const DEMO_USER_EMAIL = DEMO_USER_PROFILE.email;

interface DemoMessage extends FullEmail {
  threadId?: string;
}

interface DemoState {
  messages: DemoMessage[];
  blockedSenders: BlockedSender[];
  contacts: ContactEntry[];
  autoReplySettings: AutoReplySettings;
  nextSeq: number;
  nextBlockedSenderId: number;
}

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

function cloneMessage(message: DemoMessage): DemoMessage {
  return {
    ...message,
    flags: [...(message.flags || [])],
    to: message.to ? [...message.to] : undefined,
    cc: message.cc ? [...message.cc] : undefined,
    bcc: message.bcc ? [...message.bcc] : undefined,
    replyTo: message.replyTo ? [...message.replyTo] : undefined,
    attachments: message.attachments
      ? message.attachments.map((attachment) => ({ ...attachment }))
      : undefined,
    references: message.references ? [...message.references] : undefined,
  };
}

const importedMockMessages: DemoMessage[] = [
  {
    "id": 1301,
    "seq": 1301,
    "threadId": "thread-mock-1301",
    "subject": "‼️ 仅剩 5 天：立省 OpenSearchCon China 门票优惠",
    "from": "The Linux Foundation",
    "fromAddress": "no-reply@linuxfoundation.org",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-25T01:03:26.000Z",
    "flags": [
      "\\Seen",
      "Category Promotions"
    ],
    "snippet": "3月17-18日，上海：50+ 场技术分享 · 专业交流机会 View in browser ([link] ) OSC China 2026 - Chinese - Email Banner - EB Registration Ending ([link] ) 最后 5 天，把握机会购买 OpenSearchCon ",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>3月17-18日，上海：50+ 场技术分享 · 专业交流机会 View in browser ([link] ) OSC China 2026 - Chinese - Email Banner - EB Registration Ending ([link] ) 最后 5 天，把握机会购买 OpenSearchCon 优惠门票！ 早鸟注册优惠将于 3 月 1 日截止 您参加 OpenSearchCon China 2026 ([link] ) 的门票正在等您! 大会将于 3 月 17–18 日 在上海虹桥希尔顿酒店 ([link] ) 举办，早鸟优惠即将结束！请于 3 月 1 日（周日）前完成注册，锁定早鸟价格。 查看日程 &gt;&gt; ([link] ) 立即注册并享优惠 &gt;&gt; ([link] ) 直接向 OpenSearch 社区专家学习 OpenSearchCon 不仅仅是一系列演讲，更是一个让您提问、解决挑战、与每天大规模部署 OpenSearch 的工程师和架构师面对面交流。一次与对的人深入对话，可能就能解决您团队数月未解的难题！ 大会设有 50+ 场技术专题分享 ([link] ) ，涵盖四大核心方向：分析 + 安全 + 可观测性、搜索 + Apache Lucene、OpenSearch 运维实践，以及安全教育 + 社区发展。 查看完整日程 &gt;&gt; ([link] ) 与引领 OpenSearch 未来的组织建立联系 现场将汇聚来自阿里云、字节跳动、Eliatra、微软、SAP、瞻博网络（Juniper Networks）、红帽、Zalando 等企业的团队代表，以及包括 温州商学院、上海大学在内的创新机构。 此外，还可参加两场专属交流活动：Better Together 午餐会 ([link] ) 和 Search Party 欢迎招待会 ([link] ) 。 查看参会名单 &gt;&gt; ([link] ) 3月1日前注册即可享受优惠 在3月1日前 注册参加 OpenSearchCon China ([link] ) ，仅需 ¥149，立省 ¥50。 您的门票包含：主题</p>",
    "text": "3月17-18日，上海：50+ 场技术分享 · 专业交流机会 View in browser ([link] ) OSC China 2026 - Chinese - Email Banner - EB Registration Ending ([link] ) 最后 5 天，把握机会购买 OpenSearchCon 优惠门票！ 早鸟注册优惠将于 3 月 1 日截止 您参加 OpenSearchCon China 2026 ([link] ) 的门票正在等您! 大会将于 3 月 17–18 日 在上海虹桥希尔顿酒店 ([link] ) 举办，早鸟优惠即将结束！请于 3 月 1 日（周日）前完成注册，锁定早鸟价格。 查看日程 >> ([link] ) 立即注册并享优惠 >> ([link] ) 直接向 OpenSearch 社区专家学习 OpenSearchCon 不仅仅是一系列演讲，更是一个让您提问、解决挑战、与每天大规模部署 OpenSearch 的工程师和架构师面对面交流。一次与对的人深入对话，可能就能解决您团队数月未解的难题！ 大会设有 50+ 场技术专题分享 ([link] ) ，涵盖四大核心方向：分析 + 安全 + 可观测性、搜索 + Apache Lucene、OpenSearch 运维实践，以及安全教育 + 社区发展。 查看完整日程 >> ([link] ) 与引领 OpenSearch 未来的组织建立联系 现场将汇聚来自阿里云、字节跳动、Eliatra、微软、SAP、瞻博网络（Juniper Networks）、红帽、Zalando 等企业的团队代表，以及包括 温州商学院、上海大学在内的创新机构。 此外，还可参加两场专属交流活动：Better Together 午餐会 ([link] ) 和 Search Party 欢迎招待会 ([link] ) 。 查看参会名单 >> ([link] ) 3月1日前注册即可享受优惠 在3月1日前 注册参加 OpenSearchCon China ([link] ) ，仅需 ¥149，立省 ¥50。 您的门票包含：主题",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1301@homerow.dev>"
  },
  {
    "id": 1302,
    "seq": 1302,
    "threadId": "thread-mock-1302",
    "subject": "★★★★★ 'Scintillating' | Samurai now open",
    "from": "British Museum",
    "fromAddress": "emails@britishmuseum.org",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-03T16:32:45.000Z",
    "flags": [
      "\\Seen",
      "Category Updates"
    ],
    "snippet": "★★★★★ 'Scintillating' | Samurai now open 'Extraordinary' – The Guardian View this email online [link] [link] Visit the British Museum website. [link] Exhibition",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>★★★★★ 'Scintillating' | Samurai now open 'Extraordinary' – The Guardian View this email online [link] [link] Visit the British Museum website. [link] Exhibitions [link] Membership [link] Shop [link] Inside the Samurai exhibition. [link] Samurai Now open ★★★★★ 'A ravishing, riveting exhibition' – The Times ★★★★★ 'An extraordinary encounter' – The Guardian Unravel 1,000 years of myth and reality in our new blockbuster exhibition, that 'challenges everything you thought you knew about the Japanese warriors' (The Telegraph). Special late openings now on sale: 7, 12 and 14 February. Book now [link] black_arrow Supported by The Huo Family Foundation Curator Joe Nickols with a selection of samurai swords. [link] Curator's Corner Samurai swords Join Project Curator Joe Nickols as they get to grips with some fearsome weaponry, spanning 1,000 years of Japanese history. Watch the video [link] black</p>",
    "text": "★★★★★ 'Scintillating' | Samurai now open 'Extraordinary' – The Guardian View this email online [link] [link] Visit the British Museum website. [link] Exhibitions [link] Membership [link] Shop [link] Inside the Samurai exhibition. [link] Samurai Now open ★★★★★ 'A ravishing, riveting exhibition' – The Times ★★★★★ 'An extraordinary encounter' – The Guardian Unravel 1,000 years of myth and reality in our new blockbuster exhibition, that 'challenges everything you thought you knew about the Japanese warriors' (The Telegraph). Special late openings now on sale: 7, 12 and 14 February. Book now [link] black_arrow Supported by The Huo Family Foundation Curator Joe Nickols with a selection of samurai swords. [link] Curator's Corner Samurai swords Join Project Curator Joe Nickols as they get to grips with some fearsome weaponry, spanning 1,000 years of Japanese history. Watch the video [link] black",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1302@homerow.dev>"
  },
  {
    "id": 1303,
    "seq": 1303,
    "threadId": "thread-mock-1303",
    "subject": "Battlefield 6 | Jetzt live: Saison 2 von REDSEC",
    "from": "PlayStation",
    "fromAddress": "email@email.playstation.com",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-24T20:04:09.000Z",
    "flags": [
      "\\Seen",
      "Category Promotions"
    ],
    "snippet": "96 PlayStation Stelle dich dem Nebel des Krieges PlayStation Zeit für drastische Maßnahmen In Saison 2 von Battlefield 6 und REDSEC nimmt der Krieg gegen Pax Ar",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>96 PlayStation Stelle dich dem Nebel des Krieges PlayStation Zeit für drastische Maßnahmen In Saison 2 von Battlefield 6 und REDSEC nimmt der Krieg gegen Pax Armata globale Dimensionen an und erreicht im Zuge eines zermürbenden Angriffs zur Rückeroberung eines NATO-Luftwaffenstützpunkts deutsches Gebirge. Saison 2 bringt das kompromisslose Kriegsgeschehen in puncto Nervenkitzel auf die nächste Stufe. Mit ihr werden neben dem psychoaktiven VL-7-Rauch, der den Orientierungssinn auf dem Schlachtfeld verzerrt, die neue Karte „Contaminated“ sowie neue Waffen eingeführt, zudem erlebt der legendäre AH-6 Little Bird sein Comeback. Jetzt spielen Schalte mit Battlefield Pro noch mehr Inhalte frei Mit dem Battle Pass von Saison 2 schaltest du sofort sechs Belohnungen frei und erhältst Zugriff auf vier brandneue Themenpfade mit neuer Ausrüstung, Waffenpaketen, Soldaten-Skins, EP-Boosts und mehr. Upg</p>",
    "text": "96 PlayStation Stelle dich dem Nebel des Krieges PlayStation Zeit für drastische Maßnahmen In Saison 2 von Battlefield 6 und REDSEC nimmt der Krieg gegen Pax Armata globale Dimensionen an und erreicht im Zuge eines zermürbenden Angriffs zur Rückeroberung eines NATO-Luftwaffenstützpunkts deutsches Gebirge. Saison 2 bringt das kompromisslose Kriegsgeschehen in puncto Nervenkitzel auf die nächste Stufe. Mit ihr werden neben dem psychoaktiven VL-7-Rauch, der den Orientierungssinn auf dem Schlachtfeld verzerrt, die neue Karte „Contaminated“ sowie neue Waffen eingeführt, zudem erlebt der legendäre AH-6 Little Bird sein Comeback. Jetzt spielen Schalte mit Battlefield Pro noch mehr Inhalte frei Mit dem Battle Pass von Saison 2 schaltest du sofort sechs Belohnungen frei und erhältst Zugriff auf vier brandneue Themenpfade mit neuer Ausrüstung, Waffenpaketen, Soldaten-Skins, EP-Boosts und mehr. Upg",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1303@homerow.dev>"
  },
  {
    "id": 1304,
    "seq": 1304,
    "threadId": "thread-mock-1304",
    "subject": "Celebrate Black History month",
    "from": "Amazon Business",
    "fromAddress": "no-reply@business.amazon.com",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-24T15:06:43.000Z",
    "flags": [
      "\\Seen",
      "Category Promotions"
    ],
    "snippet": "96 Support Black entrepreneurs Support Black entrepreneurs Explore Black-owned Diversify your business procurement Amazon Business makes it simple to diversify ",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>96 Support Black entrepreneurs Support Black entrepreneurs Explore Black-owned Diversify your business procurement Amazon Business makes it simple to diversify your supply chain with business supplies from credentialed small and diverse sellers. Celebrate this Black History month by shopping Black-owned businesses as you procure IT essentials, Office supplies, and more. Learn how to set up your business procurement to support small and diverse sellers. Features Certification Are you a Black-owned business? Upload your certification Business procurement Purchase from certified diverse sellers. Set up your business procurement Supplier diversity Shop thousands of products from small and diverse sellers. Learn more Learn more Contact us | Manage account If you'd rather not receive future emails of this sort from Amazon Business, please let us know your email preferences . © 2026 Amazon.com,</p>",
    "text": "96 Support Black entrepreneurs Support Black entrepreneurs Explore Black-owned Diversify your business procurement Amazon Business makes it simple to diversify your supply chain with business supplies from credentialed small and diverse sellers. Celebrate this Black History month by shopping Black-owned businesses as you procure IT essentials, Office supplies, and more. Learn how to set up your business procurement to support small and diverse sellers. Features Certification Are you a Black-owned business? Upload your certification Business procurement Purchase from certified diverse sellers. Set up your business procurement Supplier diversity Shop thousands of products from small and diverse sellers. Learn more Learn more Contact us | Manage account If you'd rather not receive future emails of this sort from Amazon Business, please let us know your email preferences . © 2026 Amazon.com,",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1304@homerow.dev>"
  },
  {
    "id": 1305,
    "seq": 1305,
    "threadId": "thread-mock-1305",
    "subject": "New exhibition | Samurai",
    "from": "British Museum",
    "fromAddress": "emails@britishmuseum.org",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2025-11-10T13:41:40.000Z",
    "flags": [
      "\\Seen",
      "Category Updates"
    ],
    "snippet": "New exhibition | Samurai Unmask the reality behind the myth View this email online [link] [link] Visit the British Museum website. [link] Exhibitions [link] Mem",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>New exhibition | Samurai Unmask the reality behind the myth View this email online [link] [link] Visit the British Museum website. [link] Exhibitions [link] Membership [link] Shop [link] An imposing samurai helmet and facemask with a bristling moustache. [link] Samurai Opens 3 February From medieval battlefields to modern blockbusters, discover the real story of the samurai. Book discounted early bird tickets and save at least 20%, or become a Member [link] today to enjoy entry to all our exhibitions. Book now and save [link] black_arrow Supported by Huo Family Foundation logo Woodblock print of a female samurai galloping away from a battle, arrows piercing their armour. [link] Who were the samurai? Curator's introduction Explore how samurai have played many – often surprising – roles over their 1,000-year history. Read the blog [link] black_arrow Red and gold firefighter's cloak with wa</p>",
    "text": "New exhibition | Samurai Unmask the reality behind the myth View this email online [link] [link] Visit the British Museum website. [link] Exhibitions [link] Membership [link] Shop [link] An imposing samurai helmet and facemask with a bristling moustache. [link] Samurai Opens 3 February From medieval battlefields to modern blockbusters, discover the real story of the samurai. Book discounted early bird tickets and save at least 20%, or become a Member [link] today to enjoy entry to all our exhibitions. Book now and save [link] black_arrow Supported by Huo Family Foundation logo Woodblock print of a female samurai galloping away from a battle, arrows piercing their armour. [link] Who were the samurai? Curator's introduction Explore how samurai have played many – often surprising – roles over their 1,000-year history. Read the blog [link] black_arrow Red and gold firefighter's cloak with wa",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1305@homerow.dev>"
  },
  {
    "id": 1306,
    "seq": 1306,
    "threadId": "thread-mock-1306",
    "subject": "Noitão (hoje), pré estreia de Sirât e Ghibli Fest agitam o Cine Belas Artes!",
    "from": "Cine Belas Artes",
    "fromAddress": "news@cinebelasartes.veloxtickets.com.br",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-13T15:10:01.000Z",
    "flags": [
      "\\Seen",
      "Category Updates"
    ],
    "snippet": "Noitão (hoje), pré estreia de Sirât e Ghibli Fest agitam o Cine Belas Artes! Confira as novidades! 13.02 Noitão Morro dos Pecadores Horário: a partir das 23h30 ",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>Noitão (hoje), pré estreia de Sirât e Ghibli Fest agitam o Cine Belas Artes! Confira as novidades! 13.02 Noitão Morro dos Pecadores Horário: a partir das 23h30 Unimos um filmes mais pedidos pelo público com um dos lançamentos mais aguardados para um Noitão Especial. A Sala 1, Amores Euphoricos, traz a estreia de O Morro dos Ventos Uivantes seguido de Romeu + Julieta. Na Sala 2, Morro do Pecadores, traz o filme com mais indicações ao Oscar, Pecadores, seguido de Um Drink no Inferno Ingresso: R$80 (inteira) e R$40 (meia) Compre seu ingresso 19.02 a 04.03 Ghibli Fest 2026 Horário: 18h20 Nesta etapa serão exibidos 14 longas-metragens, sendo sete títulos inéditos na programação da mostra em relação à primeira parte realizada em 2025. Entre os filmes confirmados estão O Conto da Princesa Kaguya, Da Colina Kokuriko, As Memórias de Marnie, O Castelo no Céu, Contos de Terramar, O Reino dos Gatos </p>",
    "text": "Noitão (hoje), pré estreia de Sirât e Ghibli Fest agitam o Cine Belas Artes! Confira as novidades! 13.02 Noitão Morro dos Pecadores Horário: a partir das 23h30 Unimos um filmes mais pedidos pelo público com um dos lançamentos mais aguardados para um Noitão Especial. A Sala 1, Amores Euphoricos, traz a estreia de O Morro dos Ventos Uivantes seguido de Romeu + Julieta. Na Sala 2, Morro do Pecadores, traz o filme com mais indicações ao Oscar, Pecadores, seguido de Um Drink no Inferno Ingresso: R$80 (inteira) e R$40 (meia) Compre seu ingresso 19.02 a 04.03 Ghibli Fest 2026 Horário: 18h20 Nesta etapa serão exibidos 14 longas-metragens, sendo sete títulos inéditos na programação da mostra em relação à primeira parte realizada em 2025. Entre os filmes confirmados estão O Conto da Princesa Kaguya, Da Colina Kokuriko, As Memórias de Marnie, O Castelo no Céu, Contos de Terramar, O Reino dos Gatos ",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1306@homerow.dev>"
  },
  {
    "id": 1307,
    "seq": 1307,
    "threadId": "thread-mock-1307",
    "subject": "Redditors are asking questions that your brand could be answering",
    "from": "Reddit for Business",
    "fromAddress": "no-reply@redditads.com",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-25T18:00:48.000Z",
    "flags": [
      "\\Seen",
      "Category Social"
    ],
    "snippet": "Your industry is being discussed in real time on Reddit. Jump back in and be part of the conversations shaping your space. Reddit_Business_Short ([link] ) Your ",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>Your industry is being discussed in real time on Reddit. Jump back in and be part of the conversations shaping your space. Reddit_Business_Short ([link] ) Your industry is talking ([link] ) Hi [redacted], Reddit is still discussing News, but you haven't been there to take part. New conversations are happening in real time, and the brands that stay active are the ones sharping perception, building trust, and earning visibility. Find new conversations ([link] ) Image depicts how to find conversations ([link] ) Find new conversations ([link] ) Reddit Pro shows you exactly which threads are worth joining, where your audience is active, and which topics need your voice. You don't need to start a conversation; you just need to show up in the right ones. Ads Manager ([link] ) Reddit Help ([link] ) Reddit Ads Formula ([link] ) Policies ([link] ) Reddit Inc. 548 Market St #16093, San Francisco, C</p>",
    "text": "Your industry is being discussed in real time on Reddit. Jump back in and be part of the conversations shaping your space. Reddit_Business_Short ([link] ) Your industry is talking ([link] ) Hi [redacted], Reddit is still discussing News, but you haven't been there to take part. New conversations are happening in real time, and the brands that stay active are the ones sharping perception, building trust, and earning visibility. Find new conversations ([link] ) Image depicts how to find conversations ([link] ) Find new conversations ([link] ) Reddit Pro shows you exactly which threads are worth joining, where your audience is active, and which topics need your voice. You don't need to start a conversation; you just need to show up in the right ones. Ads Manager ([link] ) Reddit Help ([link] ) Reddit Ads Formula ([link] ) Policies ([link] ) Reddit Inc. 548 Market St #16093, San Francisco, C",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1307@homerow.dev>"
  },
  {
    "id": 1308,
    "seq": 1308,
    "threadId": "thread-mock-1308",
    "subject": "Share Wise and start earning rewards",
    "from": "Wise (formerly TransferWise)",
    "fromAddress": "noreply@info.wise.com",
    "to": [
      "demo@homerow.dev"
    ],
    "date": "2026-02-23T18:45:08.000Z",
    "flags": [
      "\\Seen",
      "Category Promotions"
    ],
    "snippet": "email 2- card_or_transfer_never_invited 96 What could you do with an extra 115 USD? 115 USD could be all yours Tell your friends and family why you love Wise an",
    "hasAttachments": false,
    "folderPath": "INBOX",
    "html": "<p>email 2- card_or_transfer_never_invited 96 What could you do with an extra 115 USD? 115 USD could be all yours Tell your friends and family why you love Wise and you could both earn rewards. When your friends join Wise using your referral link, they can send their first transfer of up to 600 USD without paying any fees . When 3 of your friends either make a cross-currency transfer over 300 USD , or spend over 300 USD with a Wise card, you'll unlock a 115 USD reward. What’s not to love? Share Wise with friends Share Wise with friends Rewards that work for everyone Want to know how our referral program works? It’s simple — just follow these 3 easy steps. Spread the word Share your unique Wise referral link with friends and family. The more the merrier. Treat them like VIPs When your friends sign up using your referral link, they’ll get an exclusive Wise perk — they can send their first tra</p>",
    "text": "email 2- card_or_transfer_never_invited 96 What could you do with an extra 115 USD? 115 USD could be all yours Tell your friends and family why you love Wise and you could both earn rewards. When your friends join Wise using your referral link, they can send their first transfer of up to 600 USD without paying any fees . When 3 of your friends either make a cross-currency transfer over 300 USD , or spend over 300 USD with a Wise card, you'll unlock a 115 USD reward. What’s not to love? Share Wise with friends Share Wise with friends Rewards that work for everyone Want to know how our referral program works? It’s simple — just follow these 3 easy steps. Spread the word Share your unique Wise referral link with friends and family. The more the merrier. Treat them like VIPs When your friends sign up using your referral link, they’ll get an exclusive Wise perk — they can send their first tra",
    "accountEmail": "demo@homerow.dev",
    "messageId": "<demo-mock-1308@homerow.dev>"
  }
];

function createInitialState(): DemoState {
  const baseMessages: DemoMessage[] = [
    {
      id: 1201,
      seq: 1201,
      threadId: "thread-demo-welcome",
      subject: "Welcome to Homerow demo mode",
      from: "Homerow Team",
      fromAddress: "team@homerow.dev",
      to: [DEMO_USER_EMAIL],
      cc: [],
      date: minutesAgo(12),
      flags: [],
      snippet: "This inbox is running entirely on mocked data, with no backend required.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>This inbox is running entirely on <strong>mocked data</strong>, with no backend required.</p>",
      text: "This inbox is running entirely on mocked data, with no backend required.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-welcome@homerow.dev>",
    },
    {
      id: 1202,
      seq: 1202,
      threadId: "thread-demo-welcome",
      subject: "Re: Welcome to Homerow demo mode",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: minutesAgo(6),
      flags: ["\\Seen"],
      snippet: "Looks great. We can show this in docs as a live demo.",
      hasAttachments: false,
      folderPath: "Sent",
      html: "<p>Looks great. We can show this in docs as a live demo.</p>",
      text: "Looks great. We can show this in docs as a live demo.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-reply@homerow.dev>",
      inReplyTo: "<demo-welcome@homerow.dev>",
      references: ["<demo-welcome@homerow.dev>"],
    },
    {
      id: 1203,
      seq: 1203,
      threadId: "thread-billing",
      subject: "Invoice for February",
      from: "Billing",
      fromAddress: "billing@example.com",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(40),
      flags: ["\\Seen", "Category Finance", "Important"],
      snippet: "Your February invoice is available. Payment due in 7 days.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Your February invoice is available. Payment due in 7 days.</p>",
      text: "Your February invoice is available. Payment due in 7 days.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-billing@homerow.dev>",
    },
    {
      id: 1204,
      seq: 1204,
      threadId: "thread-promotions",
      subject: "20% off your next order",
      from: "Acme Store",
      fromAddress: "promo@acme-store.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(95),
      flags: ["Category Promotions"],
      snippet: "Limited time offer for demo users.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Limited time offer for demo users.</p>",
      text: "Limited time offer for demo users.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-promo@homerow.dev>",
    },
    {
      id: 1205,
      seq: 1205,
      threadId: "thread-social",
      subject: "Someone mentioned you",
      from: "Social Network",
      fromAddress: "notify@social.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(180),
      flags: ["\\Seen", "Category Social"],
      snippet: "You have new activity waiting.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>You have new activity waiting.</p>",
      text: "You have new activity waiting.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-social@homerow.dev>",
    },
    {
      id: 1206,
      seq: 1206,
      threadId: "thread-draft",
      subject: "Draft: Product launch notes",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: minutesAgo(260),
      flags: ["\\Draft", "\\Seen"],
      snippet: "Draft content for launch notes.",
      hasAttachments: false,
      folderPath: "Drafts",
      html: "<p>Draft content for launch notes.</p>",
      text: "Draft content for launch notes.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-draft@homerow.dev>",
    },
    {
      id: 1207,
      seq: 1207,
      threadId: "thread-archive",
      subject: "Architecture review notes",
      from: "Engineering",
      fromAddress: "eng@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(520),
      flags: ["\\Seen"],
      snippet: "Notes from last architecture review.",
      hasAttachments: false,
      folderPath: "Archive",
      html: "<p>Notes from last architecture review.</p>",
      text: "Notes from last architecture review.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-archive@homerow.dev>",
    },
    {
      id: 1208,
      seq: 1208,
      threadId: "thread-snoozed",
      subject: "Reminder: Follow up next week",
      from: "Project Tracker",
      fromAddress: "tracker@example.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(700),
      flags: ["\\Seen"],
      snippet: "This item is snoozed for later.",
      hasAttachments: false,
      folderPath: "Snoozed",
      snoozedUntil: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
      html: "<p>This item is snoozed for later.</p>",
      text: "This item is snoozed for later.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-snoozed@homerow.dev>",
    },
    {
      id: 1209,
      seq: 1209,
      threadId: "thread-scheduled",
      subject: "Scheduled: Launch announcement",
      from: "To: team@homerow.dev",
      fromAddress: DEMO_USER_EMAIL,
      to: ["team@homerow.dev"],
      date: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      flags: ["\\Seen", "__scheduled"],
      snippet: "Scheduled on demo mailbox",
      hasAttachments: false,
      folderPath: "Scheduled",
      scheduledFor: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      html: "<p>Scheduled launch announcement</p>",
      text: "Scheduled launch announcement",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-scheduled@homerow.dev>",
    },
    {
      id: 1210,
      seq: 1210,
      threadId: "thread-product-update",
      subject: "Platform update: keyboard shortcuts",
      from: "Homerow Product",
      fromAddress: "product@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(28),
      flags: ["Category Updates", "Important"],
      snippet: "New command palette and keyboard flow improvements.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>New command palette and keyboard flow improvements.</p>",
      text: "New command palette and keyboard flow improvements.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-product-update@homerow.dev>",
    },
    {
      id: 1211,
      seq: 1211,
      threadId: "thread-support",
      subject: "Ticket #4312 has been resolved",
      from: "Support",
      fromAddress: "support@service.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(65),
      flags: ["\\Seen", "Category Updates"],
      snippet: "Your support ticket has been marked resolved.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Your support ticket has been marked resolved.</p>",
      text: "Your support ticket has been marked resolved.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-support@service.dev>",
    },
    {
      id: 1212,
      seq: 1212,
      threadId: "thread-standup",
      subject: "Daily standup notes",
      from: "You",
      fromAddress: DEMO_USER_EMAIL,
      to: ["eng@homerow.dev"],
      date: minutesAgo(85),
      flags: ["\\Seen"],
      snippet: "Sent from demo mailbox.",
      hasAttachments: false,
      folderPath: "Sent",
      html: "<p>Sent from demo mailbox.</p>",
      text: "Sent from demo mailbox.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-standup@homerow.dev>",
    },
    {
      id: 1213,
      seq: 1213,
      threadId: "thread-weekly",
      subject: "Weekly report (starred)",
      from: "Analytics",
      fromAddress: "analytics@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(110),
      flags: ["\\Seen", "\\Flagged", "Category Updates"],
      snippet: "KPI summary for this week.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>KPI summary for this week.</p>",
      text: "KPI summary for this week.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-weekly@homerow.dev>",
    },
    {
      id: 1214,
      seq: 1214,
      threadId: "thread-promo-2",
      subject: "Weekend sale starts now",
      from: "Acme Store",
      fromAddress: "promo@acme-store.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(145),
      flags: ["\\Seen", "Category Promotions"],
      snippet: "Top offers for this weekend.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>Top offers for this weekend.</p>",
      text: "Top offers for this weekend.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-promo-2@acme-store.dev>",
    },
    {
      id: 1215,
      seq: 1215,
      threadId: "thread-social-2",
      subject: "New followers this week",
      from: "Social Network",
      fromAddress: "notify@social.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(210),
      flags: ["Category Social"],
      snippet: "You gained 12 followers.",
      hasAttachments: false,
      folderPath: "INBOX",
      html: "<p>You gained 12 followers.</p>",
      text: "You gained 12 followers.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-social-2@social.example>",
    },
    {
      id: 1216,
      seq: 1216,
      threadId: "thread-spam",
      subject: "You won a mystery prize",
      from: "Unknown Sender",
      fromAddress: "prize@spam.example",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(400),
      flags: [],
      snippet: "This message is in spam for demo purposes.",
      hasAttachments: false,
      folderPath: "Spam",
      html: "<p>This message is in spam for demo purposes.</p>",
      text: "This message is in spam for demo purposes.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-spam@spam.example>",
    },
    {
      id: 1217,
      seq: 1217,
      threadId: "thread-trash",
      subject: "Old notification",
      from: "System",
      fromAddress: "system@homerow.dev",
      to: [DEMO_USER_EMAIL],
      date: minutesAgo(900),
      flags: ["\\Seen"],
      snippet: "Moved to trash in demo dataset.",
      hasAttachments: false,
      folderPath: "Trash",
      html: "<p>Moved to trash in demo dataset.</p>",
      text: "Moved to trash in demo dataset.",
      accountEmail: DEMO_USER_EMAIL,
      messageId: "<demo-trash@homerow.dev>",
    },
    ...importedMockMessages,
  ];

  return {
    messages: baseMessages.map(cloneMessage),
    blockedSenders: [],
    contacts: [
      {
        id: "demo-contact-1",
        email: "team@homerow.dev",
        displayName: "Homerow Team",
        frequency: 7,
        lastContactedAt: minutesAgo(20),
        source: "manual",
      },
      {
        id: "demo-contact-2",
        email: "billing@example.com",
        displayName: "Billing",
        frequency: 3,
        lastContactedAt: minutesAgo(40),
        source: "import",
      },
    ],
    autoReplySettings: {
      enabled: false,
      subject: "",
      bodyHtml: "",
      bodyText: "",
      startDate: null,
      endDate: null,
    },
    nextSeq: 2000,
    nextBlockedSenderId: 1,
  };
}

let demoState: DemoState = createInitialState();

export function resetDemoState(): void {
  demoState = createInitialState();
}

function folderKey(folder: string): string {
  const normalized = folder.trim().toLowerCase();
  if (normalized === "inbox") return "inbox";
  if (normalized === "sent" || normalized === "sent items" || normalized === "sent mail") return "sent";
  if (normalized === "draft" || normalized === "drafts") return "drafts";
  if (normalized === "archive" || normalized === "all mail") return "archive";
  if (normalized === "spam" || normalized === "junk") return "spam";
  if (normalized === "trash" || normalized === "bin") return "trash";
  if (normalized === "snoozed") return "snoozed";
  if (normalized === "scheduled" || normalized === "scheduled send" || normalized === "scheduled sends") return "scheduled";
  return normalized;
}

function hasFlag(message: DemoMessage, flag: string): boolean {
  return message.flags.some((value) => value.toLowerCase() === flag.toLowerCase());
}

function isInFolder(message: DemoMessage, folder: string): boolean {
  const target = folderKey(folder);
  return folderKey(message.folderPath || "INBOX") === target;
}

function isInPrimaryInbox(message: DemoMessage, excludedFlags: string[]): boolean {
  if (!isInFolder(message, "INBOX")) return false;
  if (excludedFlags.length === 0) return true;
  const excluded = excludedFlags.map((flag) => flag.toLowerCase());
  return !message.flags.some((flag) => excluded.includes(flag.toLowerCase()));
}

function listByFolder(folder = "INBOX"): DemoMessage[] {
  const normalized = folder.trim();
  const lower = normalized.toLowerCase();

  let filtered: DemoMessage[];
  if (lower === "starred") {
    filtered = demoState.messages.filter((message) => hasFlag(message, "\\Flagged"));
  } else if (lower === "important") {
    filtered = demoState.messages.filter((message) => hasFlag(message, "Important"));
  } else if (lower === "inbox:primary") {
    filtered = demoState.messages.filter((message) => isInPrimaryInbox(message, []));
  } else if (lower.startsWith("inbox:primary:")) {
    const excluded = normalized
      .slice("inbox:primary:".length)
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    filtered = demoState.messages.filter((message) => isInPrimaryInbox(message, excluded));
  } else if (lower.startsWith("label:")) {
    const label = normalized.slice(6).trim();
    filtered = demoState.messages.filter((message) => hasFlag(message, label));
  } else {
    filtered = demoState.messages.filter((message) => isInFolder(message, normalized));
  }

  return [...filtered].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function toEmailMessage(message: DemoMessage): EmailMessage {
  return {
    id: message.id,
    seq: message.seq,
    subject: message.subject,
    from: message.from,
    fromAddress: message.fromAddress,
    to: message.to ? [...message.to] : undefined,
    cc: message.cc ? [...message.cc] : undefined,
    deliveredTo: message.deliveredTo ? [...message.deliveredTo] : undefined,
    date: message.date,
    flags: [...message.flags],
    snippet: message.snippet,
    hasAttachments: message.hasAttachments,
    threadId: message.threadId,
    messageCount: message.messageCount,
    unreadCount: message.unreadCount,
    participants: message.participants ? [...message.participants] : undefined,
    isNew: message.isNew,
    syncStatus: message.syncStatus,
    folderPath: message.folderPath,
    snoozedUntil: message.snoozedUntil,
    scheduledFor: message.scheduledFor,
    spamScore: message.spamScore,
  };
}

function toFullEmail(message: DemoMessage): FullEmail {
  return cloneMessage(message);
}

function parseSeq(input: string): number {
  return Number.parseInt(input, 10);
}

function getMessageBySeq(seq: string, folder?: string): DemoMessage | undefined {
  const value = parseSeq(seq);
  if (!Number.isFinite(value)) return undefined;
  const lowerFolder = folder ? folderKey(folder) : null;
  return demoState.messages.find((message) => {
    if (message.seq !== value) return false;
    if (!lowerFolder) return true;
    return folderKey(message.folderPath || "INBOX") === lowerFolder;
  });
}

function ensureSeenFlag(message: DemoMessage): void {
  if (!hasFlag(message, "\\Seen")) message.flags = [...message.flags, "\\Seen"];
}

function removeFlag(message: DemoMessage, flag: string): void {
  message.flags = message.flags.filter((value) => value.toLowerCase() !== flag.toLowerCase());
}

export async function demoRunSnoozeSweep(): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const message of demoState.messages) {
    if (!message.snoozedUntil) continue;
    if (message.snoozedUntil <= nowIso) {
      message.snoozedUntil = undefined;
      message.folderPath = "INBOX";
    }
  }
}

export async function demoGetFolderCounts(
  folders: string[],
): Promise<Record<string, { unread: number; total: number }>> {
  const counts: Record<string, { unread: number; total: number }> = {};
  for (const folder of folders) {
    const items = listByFolder(folder);
    counts[folder] = {
      total: items.length,
      unread: items.filter((message) => !hasFlag(message, "\\Seen")).length,
    };
  }
  return counts;
}

export async function demoGetUnreadCountForSection(section: string): Promise<number> {
  return listByFolder(section).filter((message) => !hasFlag(message, "\\Seen")).length;
}

export async function demoFetchEmails(folder = "INBOX"): Promise<EmailMessage[]> {
  return listByFolder(folder).map(toEmailMessage);
}

export async function demoFetchEmailsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  const all = listByFolder(folder);
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const start = (safePage - 1) * safePerPage;
  const pageItems = all.slice(start, start + safePerPage);

  return {
    emails: pageItems.map(toEmailMessage),
    total: all.length,
    nextCursor: null,
    hasMore: start + pageItems.length < all.length,
  };
}

export async function demoFetchThreadsPaginated(
  folder = "INBOX",
  page = 1,
  perPage = 50,
): Promise<{ emails: EmailMessage[]; total: number; nextCursor: string | null; hasMore: boolean }> {
  const source = listByFolder(folder);
  const grouped = new Map<string, DemoMessage[]>();

  for (const message of source) {
    const key = message.threadId || `solo-${message.seq}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(message);
    else grouped.set(key, [message]);
  }

  const threads = Array.from(grouped.entries())
    .map(([threadId, messages]) => {
      const latest = [...messages].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
      const unreadCount = messages.filter((message) => !hasFlag(message, "\\Seen")).length;
      const participants = Array.from(
        new Set(messages.map((message) => message.from).filter(Boolean)),
      );
      return {
        ...latest,
        threadId: threadId.startsWith("solo-") ? undefined : threadId,
        messageCount: messages.length,
        unreadCount,
        participants,
      };
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const start = (safePage - 1) * safePerPage;
  const pageItems = threads.slice(start, start + safePerPage);

  return {
    emails: pageItems.map(toEmailMessage),
    total: threads.length,
    nextCursor: null,
    hasMore: start + pageItems.length < threads.length,
  };
}

export async function demoGetEmail(seq: string, folder = "INBOX"): Promise<FullEmail | null> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  return message ? toFullEmail(message) : null;
}

export async function demoSearchEmails(query: string, folder = "INBOX"): Promise<EmailMessage[]> {
  const term = query.trim().toLowerCase();
  if (!term) return demoFetchEmails(folder);

  const source = listByFolder(folder);
  return source
    .filter((message) => {
      const haystack = [
        message.subject,
        message.from,
        message.fromAddress,
        message.snippet,
        message.text,
        message.html,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return haystack.includes(term);
    })
    .map(toEmailMessage);
}

export async function demoFetchSentContacts(): Promise<string[]> {
  return demoState.contacts.map((contact) => contact.email);
}

export async function demoFetchAllContacts(): Promise<ContactEntry[]> {
  return demoState.contacts.map((contact) => ({ ...contact }));
}

export async function demoAddContactToDb(email: string, displayName?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const existing = demoState.contacts.find((contact) => contact.email.toLowerCase() === normalized);
  if (existing) {
    existing.displayName = displayName?.trim() || existing.displayName;
    existing.lastContactedAt = new Date().toISOString();
    existing.frequency = Math.max(1, existing.frequency);
    return;
  }

  demoState.contacts.unshift({
    id: `demo-contact-${demoState.nextSeq}`,
    email: normalized,
    displayName: displayName?.trim() || null,
    frequency: 1,
    lastContactedAt: new Date().toISOString(),
    source: "manual",
  });
}

export async function demoDeleteContact(contactId: string): Promise<void> {
  const idx = demoState.contacts.findIndex((contact) => contact.id === contactId);
  if (idx >= 0) demoState.contacts.splice(idx, 1);
}

export async function demoMarkAsRead(seq: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  ensureSeenFlag(message);
}

export async function demoMarkAsUnread(seq: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  removeFlag(message, "\\Seen");
}

export async function demoToggleStar(seq: string, starred: boolean, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  if (starred) {
    if (!hasFlag(message, "\\Flagged")) message.flags = [...message.flags, "\\Flagged"];
    return;
  }
  removeFlag(message, "\\Flagged");
}

export async function demoDeleteEmail(seq: string, currentFolder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
  if (!message) return;
  const current = folderKey(message.folderPath || "INBOX");
  if (current === "trash") {
    demoState.messages = demoState.messages.filter((entry) => entry.seq !== message.seq);
    return;
  }
  message.folderPath = "Trash";
}

export async function demoDeleteEmailsBatch(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  await Promise.all(seqs.map((seq) => demoDeleteEmail(seq, currentFolder)));
}

export async function demoArchiveEmails(seqs: string[], currentFolder = "INBOX"): Promise<void> {
  for (const seq of seqs) {
    const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
    if (message) message.folderPath = "Archive";
  }
}

export async function demoAddEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  if (!hasFlag(message, label)) message.flags = [...message.flags, label];
}

export async function demoRemoveEmailLabel(seq: string, label: string, folder = "INBOX"): Promise<void> {
  const message = getMessageBySeq(seq, folder) || getMessageBySeq(seq);
  if (!message) return;
  removeFlag(message, label);
}

export async function demoCancelScheduledEmail(seq: string): Promise<void> {
  const message = getMessageBySeq(seq, "Scheduled") || getMessageBySeq(seq);
  if (!message) return;
  demoState.messages = demoState.messages.filter((entry) => entry.seq !== message.seq);
}

export async function demoCancelScheduledEmails(seqs: string[]): Promise<void> {
  await Promise.all(seqs.map((seq) => demoCancelScheduledEmail(seq)));
}

export async function demoSendEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  attachments?: EmailAttachment[],
  threading?: { inReplyTo?: string; references?: string[] },
  fromName?: string,
  options?: SendEmailOptions,
): Promise<SendEmailResult> {
  const scheduledAt = options?.scheduledAt ? new Date(options.scheduledAt) : null;
  const seq = demoState.nextSeq;
  demoState.nextSeq += 1;

  const parsedTo = to
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedCc = (cc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedBcc = (bcc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const message: DemoMessage = {
    id: seq,
    seq,
    subject: subject || "(No Subject)",
    from: fromName?.trim() || "You",
    fromAddress: DEMO_USER_EMAIL,
    to: parsedTo,
    cc: parsedCc,
    bcc: parsedBcc,
    date: (scheduledAt && Number.isFinite(scheduledAt.getTime()) ? scheduledAt : new Date()).toISOString(),
    flags: ["\\Seen"],
    snippet: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
    hasAttachments: Boolean(attachments && attachments.length > 0),
    folderPath: "Sent",
    html: body,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    accountEmail: DEMO_USER_EMAIL,
    messageId: `<demo-${seq}@homerow.dev>`,
    inReplyTo: threading?.inReplyTo,
    references: threading?.references,
  };

  if (scheduledAt && Number.isFinite(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now()) {
    message.folderPath = "Scheduled";
    message.scheduledFor = scheduledAt.toISOString();
    message.flags.push("__scheduled");
    demoState.messages.push(message);
    return { status: "scheduled", scheduledFor: scheduledAt.toISOString() };
  }

  demoState.messages.push(message);
  return { status: "sent" };
}

export async function demoSaveDraft(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
): Promise<void> {
  const parsedTo = to
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedCc = (cc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsedBcc = (bcc || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const draft = demoState.messages.find(
    (message) =>
      folderKey(message.folderPath || "INBOX") === "drafts" &&
      hasFlag(message, "\\Draft") &&
      (message.fromAddress || "").toLowerCase() === DEMO_USER_EMAIL.toLowerCase(),
  );

  if (draft) {
    draft.to = parsedTo;
    draft.cc = parsedCc;
    draft.bcc = parsedBcc;
    draft.subject = subject || "(No Subject)";
    draft.html = body;
    draft.text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    draft.snippet = draft.text.slice(0, 180);
    draft.date = new Date().toISOString();
    return;
  }

  const seq = demoState.nextSeq;
  demoState.nextSeq += 1;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  demoState.messages.push({
    id: seq,
    seq,
    subject: subject || "(No Subject)",
    from: "You",
    fromAddress: DEMO_USER_EMAIL,
    to: parsedTo,
    cc: parsedCc,
    bcc: parsedBcc,
    date: new Date().toISOString(),
    flags: ["\\Seen", "\\Draft"],
    snippet: text.slice(0, 180),
    hasAttachments: false,
    folderPath: "Drafts",
    html: body,
    text,
    accountEmail: DEMO_USER_EMAIL,
    messageId: `<demo-draft-${seq}@homerow.dev>`,
  });
}

export async function demoGetThreadMessages(threadId: string): Promise<FullEmail[]> {
  return demoState.messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map(toFullEmail);
}

export async function demoGetThreadIdForMessage(uid: number, folder: string): Promise<string | null> {
  const message = getMessageBySeq(String(uid), folder) || getMessageBySeq(String(uid));
  return message?.threadId || null;
}

export async function demoSnoozeEmails(
  seqs: string[],
  currentFolder = "INBOX",
  untilISO: string,
): Promise<void> {
  for (const seq of seqs) {
    const message = getMessageBySeq(seq, currentFolder) || getMessageBySeq(seq);
    if (!message) continue;
    message.folderPath = "Snoozed";
    message.snoozedUntil = untilISO;
    ensureSeenFlag(message);
  }
}

export async function demoMoveToFolder(seq: string, fromFolder: string, toFolder: string): Promise<void> {
  const message = getMessageBySeq(seq, fromFolder) || getMessageBySeq(seq);
  if (!message) return;
  message.folderPath = toFolder;
  if (folderKey(toFolder) !== "snoozed") {
    message.snoozedUntil = undefined;
  }
}

export async function demoRestoreFromTrash(seq: string): Promise<string> {
  const message = getMessageBySeq(seq, "Trash") || getMessageBySeq(seq);
  if (!message) return "Inbox";
  message.folderPath = "INBOX";
  return "Inbox";
}

export async function demoGetBlockedSenders(): Promise<BlockedSender[]> {
  return demoState.blockedSenders.map((entry) => ({ ...entry }));
}

export async function demoBlockSender(senderEmail: string, displayName: string): Promise<void> {
  const normalized = senderEmail.trim().toLowerCase();
  if (!normalized) return;
  const existing = demoState.blockedSenders.find((sender) => sender.senderEmail === normalized);
  if (existing) {
    existing.displayName = displayName?.trim() || null;
    existing.blockedAt = new Date().toISOString();
    return;
  }

  demoState.blockedSenders.unshift({
    id: demoState.nextBlockedSenderId,
    senderEmail: normalized,
    displayName: displayName?.trim() || null,
    blockedAt: new Date().toISOString(),
  });
  demoState.nextBlockedSenderId += 1;
}

export async function demoUnblockSender(senderEmail: string): Promise<void> {
  const normalized = senderEmail.trim().toLowerCase();
  demoState.blockedSenders = demoState.blockedSenders.filter(
    (sender) => sender.senderEmail !== normalized,
  );
}

export async function demoGetAutoReplySettings(): Promise<AutoReplySettings> {
  return { ...demoState.autoReplySettings };
}

export async function demoSaveAutoReplySettings(settings: AutoReplySettings): Promise<void> {
  demoState.autoReplySettings = { ...settings };
}
