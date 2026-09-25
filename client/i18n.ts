export const languageOptions = [
  { code: "en", label: "ENG", name: "English" },
  { code: "ar", label: "العربية", name: "العربية" },
  { code: "de", label: "DEU", name: "Deutsch" },
  { code: "es", label: "ESP", name: "Español" },
  { code: "fr", label: "FRA", name: "Français" },
  { code: "hi", label: "HIN", name: "हिन्दी" },
  { code: "nl", label: "NLD", name: "Nederlands" },
  { code: "pt", label: "POR", name: "Português" },
  { code: "ja", label: "日本語", name: "日本語" },
  { code: "zh", label: "简体中文", name: "简体中文" },
] as const;

export type LanguageCode = (typeof languageOptions)[number]["code"];
export type FeatureKey =
  | "ownThePlays"
  | "voting"
  | "utility"
  | "social";

type FeatureCopy = {
  title: string;
  description: string[];
  imageAlt: string;
  caption?: string;
};

type NeedsCardCopy = {
  title: string;
  description: string;
};

type NeedsCardKey = "aggregates" | "converts" | "sustainable" | "valuable";

export type TranslationSet = {
  language: {
    select: string;
  };
  header: {
    contactUs: string;
  };
  hero: {
    title: string;
    description: string;
    callToAction: string;
  };
  needs: {
    title: string;
    subtitle: string;
    cardItems: Record<NeedsCardKey, string[]>;
    cards: Record<NeedsCardKey, NeedsCardCopy>;
  };
  features: Record<FeatureKey, FeatureCopy>;
  carousel: {
    previousFeature: string;
    nextFeature: string;
    featureLabels: Record<FeatureKey, string>;
    pauseCarousel: string;
    resumeCarousel: string;
  };
  whitepaper: {
    description: string;
    downloadTitle: string;
    driveAlt: string;
  };
  footer: {
    logoAlt: string;
    tagline: string;
    copyright: string;
  };
  contact: {
    close: string;
    investors: string;
    investorDescription: string;
    leaguePartners: string;
    leagueDescription: string;
    email: string;
    collectors: string;
    collectorDescription: string;
    inviteDescription: string;
  };
  notFound: {
    message: string;
    returnHome: string;
  };
};

const english: TranslationSet = {
  language: { select: "Select language" },
  header: { contactUs: "Contact Us" },
  hero: {
    title: "Media Fragmentation",
    description:
      "Live sports are among the most valuable IP in the world. But after the match, other platforms attract more of the attention and extract more of the value.",
    callToAction: "We help you bring it back.",
  },
  needs: {
    title: "OPPORTUNITY",
    subtitle: "The missing piece that we help deliver",
    cardItems: {
      aggregates: ["Streaming / OTT", "Social Platforms", "Physical Cards", "Digital Collectibles", "Fan Reward Tokens"],
      converts: ["Social Platforms", "Physical Cards", "Digital Collectibles", "Non-monetized"],
      sustainable: ["Social Media", "Gameified Fan Apps", "Fan Reward Tokens"],
      valuable: ["Sports Betting", "Prediction Markets", "Gameified Fan Apps", "Physical Cards", "Digital Collectibles"],
    },
    cards: {
      aggregates: {
        title: "Aggregates",
        description:
          "Drives fans from streaming and social media platforms and back to your core product",
      },
      converts: {
        title: "Converts",
        description: "Turns attention and reach into paying customers",
      },
      sustainable: {
        title: "Sustainable",
        description:
          "Creates ongoing demand without constant effort, investment, or incentivizing",
      },
      valuable: {
        title: "Valuable",
        description:
          "The fan can reasonably expect a positive long-term financial benefit to participate",
      },
    },
  },
  features: {
    ownThePlays: {
      title: "OWN THE PLAYS",
      description: [
        "Limited edition, interactive, 3d digital cards capturing sports history with owner name and market data on-card",
      ],
      imageAlt: "Relic Card",
      caption: "*Sample product with sample league",
    },
    voting: {
      title: "VOTING",
      description: [
        "Users vote on supply released.",
        "Most popular becomes the most scarce.",
        "The least popular not released at all.",
      ],
      imageAlt: "Vote Card",
    },
    utility: {
      title: "UTILITY",
      description: [
        "Redeem team relics for new.",
        "Utility you can trust - no rug pulls",
        "or randomness.",
      ],
      imageAlt: "Team Grid",
    },
    social: {
      title: "SOCIAL",
      description: [
        "No more lonely marketplace.",
        "Friends can follow your trophy case, collecting events, badges, and ranks",
      ],
      imageAlt: "Trophy Case",
    },
  },
  carousel: {
    previousFeature: "Previous feature",
    nextFeature: "Next feature",
    featureLabels: {
      ownThePlays: "Show own the plays feature",
      voting: "Show voting feature",
      utility: "Show utility feature",
      social: "Show social feature",
    },
    pauseCarousel: "Pause carousel",
    resumeCarousel: "Resume carousel",
  },
  whitepaper: {
    description:
      "Read the whitepaper to understand how we will succeed to hold users, value, and demand where others have failed:",
    downloadTitle: "Download from Google Drive",
    driveAlt: "Google Drive",
  },
  footer: {
    logoAlt: "Cornerstone Digital Sports logo",
    tagline: "Where fandom has value",
    copyright: "© {year} Cornerstone Digital Sports",
  },
  contact: {
    close: "Close contact form",
    investors: "Investors",
    investorDescription: "Equity offering announcing soon. Join the waitlist to be notified:",
    leaguePartners: "League Partners",
    leagueDescription: "Interested in discussing how we could bring this to your league?",
    email: "Email:",
    collectors: "Collectors",
    collectorDescription: "Working demo released to closed beta.",
    inviteDescription: "Email for invite code to try:",
  },
  notFound: {
    message: "Oops! Page not found",
    returnHome: "Return Home",
  },
};

export const translations: Record<LanguageCode, TranslationSet> = {
  en: english,
  es: {
    language: { select: "Seleccionar idioma" },
    header: { contactUs: "Contáctanos" },
    hero: {
      title: "Fragmentación de los medios",
      description:
        "Los deportes en vivo son una de las propiedades intelectuales más valiosas del mundo. Pero después del partido, otras plataformas atraen más atención y extraen más valor.",
      callToAction: "Te ayudamos a recuperarlo.",
    },
    needs: {
      title: "OPORTUNIDAD",
      subtitle: "La pieza que falta y que ayudamos a ofrecer",
      cardItems: {
        aggregates: ["Streaming / OTT", "Plataformas sociales", "Tarjetas físicas", "Coleccionables digitales", "Tokens de recompensa para fans"],
        converts: ["Plataformas sociales", "Tarjetas físicas", "Coleccionables digitales", "Sin monetizar"],
        sustainable: ["Redes sociales", "Aplicaciones gamificadas para fans", "Tokens de recompensa para fans"],
        valuable: ["Apuestas deportivas", "Mercados de predicción", "Aplicaciones gamificadas para fans", "Tarjetas físicas", "Coleccionables digitales"],
      },
      cards: {
        aggregates: {
          title: "Agregados",
          description:
            "Lleva a los fans desde las plataformas de streaming y redes sociales de vuelta a tu producto principal",
        },
        converts: {
          title: "Convierte",
          description: "Convierte la atención y el alcance en clientes de pago",
        },
        sustainable: {
          title: "Sostenible",
          description:
            "Crea una demanda continua sin esfuerzo, inversión ni incentivos constantes",
        },
        valuable: {
          title: "Valioso",
          description:
            "El fan puede esperar razonablemente un beneficio financiero positivo a largo plazo por participar",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "DOMINA LAS JUGADAS",
        description: [
          "Tarjetas digitales 3D interactivas de edición limitada que capturan la historia del deporte, con el nombre del propietario y datos del mercado en la tarjeta",
        ],
        imageAlt: "Tarjeta reliquia",
        caption: "*Producto de muestra con liga de ejemplo",
      },
      voting: {
        title: "VOTACIÓN",
        description: [
          "Los usuarios votan sobre la cantidad que se lanza.",
          "La opción más popular se vuelve la más escasa.",
          "La menos popular no se lanza.",
        ],
        imageAlt: "Tarjeta de votación",
      },
      utility: {
        title: "UTILIDAD",
        description: [
          "Canjea reliquias de equipos por nueva utilidad.",
          "Utilidad en la que puedes confiar: sin abandonos",
          "ni aleatoriedad.",
        ],
        imageAlt: "Cuadrícula de equipos",
      },
      social: {
        title: "SOCIAL",
        description: [
          "Se acabó el mercado solitario.",
          "Tus amigos pueden seguir tu vitrina, tus eventos de colección, insignias y rangos",
        ],
        imageAlt: "Vitrina de trofeos",
      },
    },
    carousel: {
      previousFeature: "Característica anterior",
      nextFeature: "Siguiente característica",
      featureLabels: {
        ownThePlays: "Mostrar la característica domina las jugadas",
        voting: "Mostrar la característica de votación",
        utility: "Mostrar la característica de utilidad",
        social: "Mostrar la característica social",
      },
      pauseCarousel: "Pausar carrusel",
      resumeCarousel: "Reanudar carrusel",
    },
    whitepaper: {
      description:
        "Lee el documento técnico para entender cómo lograremos conservar usuarios, valor y demanda donde otros han fracasado:",
      downloadTitle: "Descargar desde Google Drive",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Logotipo de Cornerstone Digital Sports",
      tagline: "Donde la pasión tiene valor",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "Cerrar formulario de contacto",
      investors: "Inversores",
      investorDescription: "La oferta de capital se anunciará pronto. Únete a la lista de espera para recibir avisos:",
      leaguePartners: "Socios de ligas",
      leagueDescription: "¿Te interesa hablar sobre cómo podríamos llevar esto a tu liga?",
      email: "Correo electrónico:",
      collectors: "Coleccionistas",
      collectorDescription: "Demostración funcional lanzada en beta cerrada.",
      inviteDescription: "Correo para obtener un código de invitación:",
    },
    notFound: { message: "¡Vaya! Página no encontrada", returnHome: "Volver al inicio" },
  },
  pt: {
    language: { select: "Selecionar idioma" },
    header: { contactUs: "Fale conosco" },
    hero: {
      title: "Fragmentação da mídia",
      description:
        "Os esportes ao vivo estão entre as propriedades intelectuais mais valiosas do mundo. Mas, depois da partida, outras plataformas atraem mais atenção e extraem mais valor.",
      callToAction: "Nós ajudamos você a trazer isso de volta.",
    },
    needs: {
      title: "OPORTUNIDADE",
      subtitle: "A peça que falta e que ajudamos a entregar",
      cardItems: {
        aggregates: ["Streaming / OTT", "Plataformas sociais", "Cartões físicos", "Colecionáveis digitais", "Tokens de recompensa para fãs"],
        converts: ["Plataformas sociais", "Cartões físicos", "Colecionáveis digitais", "Não monetizado"],
        sustainable: ["Redes sociais", "Aplicativos gamificados para fãs", "Tokens de recompensa para fãs"],
        valuable: ["Apostas esportivas", "Mercados de previsão", "Aplicativos gamificados para fãs", "Cartões físicos", "Colecionáveis digitais"],
      },
      cards: {
        aggregates: {
          title: "Agregados",
          description:
            "Leva os fãs das plataformas de streaming e redes sociais de volta ao seu produto principal",
        },
        converts: {
          title: "Converte",
          description: "Transforma atenção e alcance em clientes pagantes",
        },
        sustainable: {
          title: "Sustentável",
          description:
            "Cria demanda contínua sem esforço, investimento ou incentivos constantes",
        },
        valuable: {
          title: "Valioso",
          description:
            "O fã pode esperar razoavelmente um benefício financeiro positivo a longo prazo ao participar",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "DOMINE AS JOGADAS",
        description: [
          "Cartões digitais 3D interativos de edição limitada que capturam a história do esporte, com o nome do proprietário e dados de mercado no cartão",
        ],
        imageAlt: "Cartão relíquia",
        caption: "*Produto de demonstração com liga de exemplo",
      },
      voting: {
        title: "VOTAÇÃO",
        description: [
          "Os usuários votam sobre a oferta lançada.",
          "A opção mais popular se torna a mais escassa.",
          "A menos popular não é lançada.",
        ],
        imageAlt: "Cartão de votação",
      },
      utility: {
        title: "UTILIDADE",
        description: [
          "Troque relíquias de times por nova utilidade.",
          "Utilidade em que você pode confiar: sem golpes",
          "nem aleatoriedade.",
        ],
        imageAlt: "Grade de times",
      },
      social: {
        title: "SOCIAL",
        description: [
          "Chega de marketplace solitário.",
          "Amigos podem seguir sua vitrine, eventos de coleção, distintivos e classificações",
        ],
        imageAlt: "Vitrine de troféus",
      },
    },
    carousel: {
      previousFeature: "Recurso anterior",
      nextFeature: "Próximo recurso",
      featureLabels: {
        ownThePlays: "Mostrar recurso domine as jogadas",
        voting: "Mostrar recurso de votação",
        utility: "Mostrar recurso de utilidade",
        social: "Mostrar recurso social",
      },
      pauseCarousel: "Pausar carrossel",
      resumeCarousel: "Retomar carrossel",
    },
    whitepaper: {
      description:
        "Leia o whitepaper para entender como manteremos usuários, valor e demanda onde outros falharam:",
      downloadTitle: "Baixar pelo Google Drive",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Logotipo da Cornerstone Digital Sports",
      tagline: "Onde a paixão tem valor",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "Fechar formulário de contato",
      investors: "Investidores",
      investorDescription: "A oferta de participação será anunciada em breve. Entre na lista de espera para receber novidades:",
      leaguePartners: "Parceiros de ligas",
      leagueDescription: "Tem interesse em conversar sobre como levar isso para sua liga?",
      email: "E-mail:",
      collectors: "Colecionadores",
      collectorDescription: "Demonstração funcional lançada em beta fechado.",
      inviteDescription: "E-mail para receber um código de convite:",
    },
    notFound: { message: "Ops! Página não encontrada", returnHome: "Voltar ao início" },
  },
  ar: {
    language: { select: "اختر اللغة" },
    header: { contactUs: "اتصل بنا" },
    hero: {
      title: "تجزئة الإعلام",
      description:
        "تُعد الرياضات المباشرة من أغلى حقوق الملكية الفكرية في العالم. لكن بعد المباراة، تجذب منصات أخرى مزيدًا من الاهتمام وتستحوذ على مزيد من القيمة.",
      callToAction: "نساعدك على استعادتها.",
    },
    needs: {
      title: "الفرصة",
      subtitle: "القطعة المفقودة التي نساعد على تقديمها",
      cardItems: {
        aggregates: ["البث / OTT", "منصات التواصل الاجتماعي", "بطاقات فعلية", "مقتنيات رقمية", "رموز مكافآت المشجعين"],
        converts: ["منصات التواصل الاجتماعي", "بطاقات فعلية", "مقتنيات رقمية", "غير مُدرّج لتحقيق الدخل"],
        sustainable: ["وسائل التواصل الاجتماعي", "تطبيقات مشجعين مُلعبة", "رموز مكافآت المشجعين"],
        valuable: ["المراهنات الرياضية", "أسواق التنبؤ", "تطبيقات مشجعين مُلعبة", "بطاقات فعلية", "مقتنيات رقمية"],
      },
      cards: {
        aggregates: {
          title: "التجميع",
          description:
            "يقود المشجعين من منصات البث ووسائل التواصل الاجتماعي ويعيدهم إلى منتجك الأساسي",
        },
        converts: {
          title: "التحويل",
          description: "يحوّل الاهتمام والوصول إلى عملاء يدفعون",
        },
        sustainable: {
          title: "مستدام",
          description:
            "يخلق طلبًا مستمرًا دون جهد أو استثمار أو تحفيز مستمر",
        },
        valuable: {
          title: "قيّم",
          description:
            "يمكن للمشجع أن يتوقع بشكل معقول منفعة مالية إيجابية على المدى الطويل من المشاركة",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "امتلك اللحظات",
        description: [
          "بطاقات رقمية تفاعلية ثلاثية الأبعاد بإصدارات محدودة توثق تاريخ الرياضة، مع اسم المالك وبيانات السوق على البطاقة",
        ],
        imageAlt: "بطاقة تذكارية",
        caption: "*منتج تجريبي مع دوري نموذجي",
      },
      voting: {
        title: "التصويت",
        description: [
          "يصوت المستخدمون على الكمية المطروحة.",
          "يصبح الخيار الأكثر شعبية هو الأندر.",
          "لا يُطرح الخيار الأقل شعبية على الإطلاق.",
        ],
        imageAlt: "بطاقة التصويت",
      },
      utility: {
        title: "المنفعة",
        description: [
          "استبدل تذكارات الفرق بمنفعة جديدة.",
          "منفعة يمكنك الوثوق بها، بلا احتيال",
          "ولا عشوائية.",
        ],
        imageAlt: "شبكة الفرق",
      },
      social: {
        title: "اجتماعي",
        description: [
          "لا مزيد من الأسواق المنعزلة.",
          "يمكن للأصدقاء متابعة خزانة جوائزك وفعاليات الجمع والشارات والرتب",
        ],
        imageAlt: "خزانة الجوائز",
      },
    },
    carousel: {
      previousFeature: "الميزة السابقة",
      nextFeature: "الميزة التالية",
      featureLabels: {
        ownThePlays: "عرض ميزة امتلك اللحظات",
        voting: "عرض ميزة التصويت",
        utility: "عرض ميزة المنفعة",
        social: "عرض الميزة الاجتماعية",
      },
      pauseCarousel: "إيقاف العرض مؤقتًا",
      resumeCarousel: "استئناف العرض",
    },
    whitepaper: {
      description:
        "اقرأ الورقة البيضاء لفهم كيف سنحافظ على المستخدمين والقيمة والطلب حيث فشل الآخرون:",
      downloadTitle: "التنزيل من Google Drive",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "شعار Cornerstone Digital Sports",
      tagline: "حيث يحمل شغف المشجعين قيمة",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "إغلاق نموذج التواصل",
      investors: "المستثمرون",
      investorDescription: "سيتم الإعلان عن عرض الأسهم قريبًا. انضم إلى قائمة الانتظار ليصلك إشعار:",
      leaguePartners: "شركاء الدوريات",
      leagueDescription: "هل ترغب في مناقشة كيفية تقديم هذا إلى دوريك؟",
      email: "البريد الإلكتروني:",
      collectors: "الجامعون",
      collectorDescription: "تم إطلاق عرض تجريبي عملي ضمن نسخة تجريبية مغلقة.",
      inviteDescription: "البريد الإلكتروني للحصول على رمز الدعوة:",
    },
    notFound: { message: "عذرًا! الصفحة غير موجودة", returnHome: "العودة إلى الرئيسية" },
  },
  de: {
    language: { select: "Sprache auswählen" },
    header: { contactUs: "Kontakt" },
    hero: {
      title: "Medienfragmentierung",
      description:
        "Live-Sport gehört zu den wertvollsten geistigen Eigentumsrechten der Welt. Doch nach dem Spiel ziehen andere Plattformen mehr Aufmerksamkeit an und schöpfen mehr Wert ab.",
      callToAction: "Wir helfen dir, ihn zurückzuholen.",
    },
    needs: {
      title: "CHANCE",
      subtitle: "Das fehlende Puzzlestück, zu dessen Umsetzung wir beitragen",
      cardItems: {
        aggregates: ["Streaming / OTT", "Social-Media-Plattformen", "Physische Karten", "Digitale Sammelobjekte", "Fan-Belohnungstoken"],
        converts: ["Social-Media-Plattformen", "Physische Karten", "Digitale Sammelobjekte", "Nicht monetarisiert"],
        sustainable: ["Soziale Medien", "Gamifizierte Fan-Apps", "Fan-Belohnungstoken"],
        valuable: ["Sportwetten", "Prognosemärkte", "Gamifizierte Fan-Apps", "Physische Karten", "Digitale Sammelobjekte"],
      },
      cards: {
        aggregates: {
          title: "Aggregationen",
          description:
            "Bringt Fans von Streaming- und Social-Media-Plattformen zurück zu deinem Kernprodukt",
        },
        converts: {
          title: "Konvertiert",
          description: "Verwandelt Aufmerksamkeit und Reichweite in zahlende Kunden",
        },
        sustainable: {
          title: "Nachhaltig",
          description:
            "Schafft anhaltende Nachfrage ohne ständigen Aufwand, Investitionen oder Anreize",
        },
        valuable: {
          title: "Wertvoll",
          description:
            "Der Fan kann vernünftigerweise erwarten, durch seine Teilnahme langfristig einen positiven finanziellen Vorteil zu erzielen",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "DIE SPIELE BESITZEN",
        description: [
          "Interaktive digitale 3D-Karten in limitierter Auflage, die Sportgeschichte festhalten – mit Besitzername und Marktdaten auf der Karte",
        ],
        imageAlt: "Reliktkarte",
        caption: "*Beispielprodukt mit Beispiel-Liga",
      },
      voting: {
        title: "ABSTIMMUNG",
        description: [
          "Nutzer stimmen über die veröffentlichte Menge ab.",
          "Die beliebteste Option wird zur seltensten.",
          "Die unbeliebteste wird gar nicht veröffentlicht.",
        ],
        imageAlt: "Abstimmungskarte",
      },
      utility: {
        title: "NUTZEN",
        description: [
          "Tausche Teamrelikte gegen neuen Nutzen.",
          "Ein Nutzen, dem du vertrauen kannst – keine Betrügereien",
          "und kein Zufall.",
        ],
        imageAlt: "Teamübersicht",
      },
      social: {
        title: "SOZIAL",
        description: [
          "Kein einsamer Marktplatz mehr.",
          "Freunde können deiner Trophäensammlung, Sammel-Events, Abzeichen und Rängen folgen",
        ],
        imageAlt: "Trophäensammlung",
      },
    },
    carousel: {
      previousFeature: "Vorherige Funktion",
      nextFeature: "Nächste Funktion",
      featureLabels: {
        ownThePlays: "Funktion die Spiele besitzen anzeigen",
        voting: "Abstimmungsfunktion anzeigen",
        utility: "Nutzenfunktion anzeigen",
        social: "Soziale Funktion anzeigen",
      },
      pauseCarousel: "Karussell pausieren",
      resumeCarousel: "Karussell fortsetzen",
    },
    whitepaper: {
      description:
        "Lies das Whitepaper, um zu verstehen, wie wir Nutzer, Wert und Nachfrage dort halten, wo andere gescheitert sind:",
      downloadTitle: "Von Google Drive herunterladen",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Logo von Cornerstone Digital Sports",
      tagline: "Wo Fanliebe Wert hat",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "Kontaktformular schließen",
      investors: "Investoren",
      investorDescription: "Das Beteiligungsangebot wird bald angekündigt. Melde dich für die Warteliste an, um benachrichtigt zu werden:",
      leaguePartners: "Liga-Partner",
      leagueDescription: "Möchtest du besprechen, wie wir dies in deine Liga bringen können?",
      email: "E-Mail:",
      collectors: "Sammler",
      collectorDescription: "Funktionierende Demo in geschlossener Beta veröffentlicht.",
      inviteDescription: "E-Mail für einen Einladungscode:",
    },
    notFound: { message: "Ups! Seite nicht gefunden", returnHome: "Zur Startseite" },
  },
  fr: {
    language: { select: "Choisir la langue" },
    header: { contactUs: "Contactez-nous" },
    hero: {
      title: "Fragmentation des médias",
      description:
        "Le sport en direct compte parmi les propriétés intellectuelles les plus précieuses au monde. Mais après le match, d'autres plateformes attirent davantage l'attention et captent davantage de valeur.",
      callToAction: "Nous vous aidons à la récupérer.",
    },
    needs: {
      title: "OPPORTUNITÉ",
      subtitle: "La pièce manquante que nous contribuons à apporter",
      cardItems: {
        aggregates: ["Streaming / OTT", "Plateformes sociales", "Cartes physiques", "Objets de collection numériques", "Jetons de récompense pour fans"],
        converts: ["Plateformes sociales", "Cartes physiques", "Objets de collection numériques", "Non monétisé"],
        sustainable: ["Réseaux sociaux", "Applications de fans gamifiées", "Jetons de récompense pour fans"],
        valuable: ["Paris sportifs", "Marchés prédictifs", "Applications de fans gamifiées", "Cartes physiques", "Objets de collection numériques"],
      },
      cards: {
        aggregates: {
          title: "Agrégats",
          description:
            "Ramène les fans des plateformes de streaming et de réseaux sociaux vers votre produit principal",
        },
        converts: {
          title: "Convertit",
          description: "Transforme l'attention et la portée en clients payants",
        },
        sustainable: {
          title: "Durable",
          description:
            "Crée une demande continue sans effort, investissement ou incitation constants",
        },
        valuable: {
          title: "Précieux",
          description:
            "Le fan peut raisonnablement s'attendre à bénéficier d'un avantage financier positif à long terme en participant",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "POSSÉDEZ LES ACTIONS",
        description: [
          "Cartes numériques 3D interactives en édition limitée qui racontent l'histoire du sport, avec le nom du propriétaire et les données du marché sur la carte",
        ],
        imageAlt: "Carte relique",
        caption: "*Produit exemple avec ligue exemple",
      },
      voting: {
        title: "VOTE",
        description: [
          "Les utilisateurs votent sur l'offre mise en circulation.",
          "L'option la plus populaire devient la plus rare.",
          "La moins populaire n'est pas mise en circulation.",
        ],
        imageAlt: "Carte de vote",
      },
      utility: {
        title: "UTILITÉ",
        description: [
          "Échangez des reliques d'équipe contre une nouvelle utilité.",
          "Une utilité fiable, sans arnaque",
          "ni hasard.",
        ],
        imageAlt: "Grille des équipes",
      },
      social: {
        title: "SOCIAL",
        description: [
          "Fini le marketplace solitaire.",
          "Vos amis peuvent suivre votre vitrine, vos événements de collection, vos badges et vos classements",
        ],
        imageAlt: "Vitrine des trophées",
      },
    },
    carousel: {
      previousFeature: "Fonctionnalité précédente",
      nextFeature: "Fonctionnalité suivante",
      featureLabels: {
        ownThePlays: "Afficher la fonctionnalité possédez les actions",
        voting: "Afficher la fonctionnalité de vote",
        utility: "Afficher la fonctionnalité d'utilité",
        social: "Afficher la fonctionnalité sociale",
      },
      pauseCarousel: "Mettre le carrousel en pause",
      resumeCarousel: "Reprendre le carrousel",
    },
    whitepaper: {
      description:
        "Lisez le livre blanc pour comprendre comment nous préserverons les utilisateurs, la valeur et la demande là où d'autres ont échoué :",
      downloadTitle: "Télécharger depuis Google Drive",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Logo de Cornerstone Digital Sports",
      tagline: "Là où la passion a de la valeur",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "Fermer le formulaire de contact",
      investors: "Investisseurs",
      investorDescription: "L'offre de participation sera annoncée prochainement. Inscrivez-vous sur la liste d'attente pour être informé :",
      leaguePartners: "Partenaires de ligues",
      leagueDescription: "Vous souhaitez discuter de la façon dont nous pourrions apporter cela à votre ligue ?",
      email: "E-mail :",
      collectors: "Collectionneurs",
      collectorDescription: "Démonstration fonctionnelle disponible en bêta fermée.",
      inviteDescription: "E-mail pour recevoir un code d'invitation :",
    },
    notFound: { message: "Oups ! Page introuvable", returnHome: "Retour à l'accueil" },
  },
  nl: {
    language: { select: "Taal selecteren" },
    header: { contactUs: "Neem contact op" },
    hero: {
      title: "Versnippering van media",
      description:
        "Live sport behoort tot het meest waardevolle intellectuele eigendom ter wereld. Maar na de wedstrijd trekken andere platforms meer aandacht en halen ze meer waarde weg.",
      callToAction: "Wij helpen je die terug te brengen.",
    },
    needs: {
      title: "KANS",
      subtitle: "Het ontbrekende onderdeel dat wij helpen leveren",
      cardItems: {
        aggregates: ["Streaming / OTT", "Sociale platforms", "Fysieke kaarten", "Digitale verzamelobjecten", "Fanbeloningstokens"],
        converts: ["Sociale platforms", "Fysieke kaarten", "Digitale verzamelobjecten", "Niet gemonetiseerd"],
        sustainable: ["Sociale media", "Gegamificeerde fan-apps", "Fanbeloningstokens"],
        valuable: ["Sportweddenschappen", "Voorspellingsmarkten", "Gegamificeerde fan-apps", "Fysieke kaarten", "Digitale verzamelobjecten"],
      },
      cards: {
        aggregates: {
          title: "Aggregaten",
          description:
            "Brengt fans van streaming- en socialmediaplatforms terug naar je kernproduct",
        },
        converts: {
          title: "Converteert",
          description: "Zet aandacht en bereik om in betalende klanten",
        },
        sustainable: {
          title: "Duurzaam",
          description:
            "Creëert aanhoudende vraag zonder constante inspanning, investering of stimulering",
        },
        valuable: {
          title: "Waardevol",
          description:
            "De fan kan redelijkerwijs verwachten door deelname op lange termijn een positief financieel voordeel te behalen",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "BEZIT DE SPELMOMENTEN",
        description: [
          "Interactieve digitale 3D-kaarten in beperkte oplage die sportgeschiedenis vastleggen, met de naam van de eigenaar en marktgegevens op de kaart",
        ],
        imageAlt: "Reliekkaart",
        caption: "*Voorbeeldproduct met voorbeeldcompetitie",
      },
      voting: {
        title: "STEMMEN",
        description: [
          "Gebruikers stemmen over de uitgebrachte voorraad.",
          "De populairste optie wordt het schaarsst.",
          "De minst populaire optie wordt helemaal niet uitgebracht.",
        ],
        imageAlt: "Stemkaart",
      },
      utility: {
        title: "NUT",
        description: [
          "Ruil teamrelikwieën in voor nieuw nut.",
          "Nut waarop je kunt vertrouwen – geen oplichting",
          "en geen willekeur.",
        ],
        imageAlt: "Teamoverzicht",
      },
      social: {
        title: "SOCIAAL",
        description: [
          "Geen eenzame marketplace meer.",
          "Vrienden kunnen je prijzenkast, verzamelevents, badges en rangen volgen",
        ],
        imageAlt: "Prijzenkast",
      },
    },
    carousel: {
      previousFeature: "Vorige functie",
      nextFeature: "Volgende functie",
      featureLabels: {
        ownThePlays: "Functie bezit de spelmomenten tonen",
        voting: "Stemfunctie tonen",
        utility: "Nutfunctie tonen",
        social: "Sociale functie tonen",
      },
      pauseCarousel: "Carrousel pauzeren",
      resumeCarousel: "Carrousel hervatten",
    },
    whitepaper: {
      description:
        "Lees de whitepaper om te begrijpen hoe we gebruikers, waarde en vraag behouden waar anderen hebben gefaald:",
      downloadTitle: "Downloaden via Google Drive",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Logo van Cornerstone Digital Sports",
      tagline: "Waar passie waarde heeft",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "Contactformulier sluiten",
      investors: "Investeerders",
      investorDescription: "Het aandelenaanbod wordt binnenkort aangekondigd. Meld je aan voor de wachtlijst om op de hoogte te blijven:",
      leaguePartners: "Competitiepartners",
      leagueDescription: "Wil je bespreken hoe we dit naar jouw competitie kunnen brengen?",
      email: "E-mail:",
      collectors: "Verzamelaars",
      collectorDescription: "Werkende demo uitgebracht in gesloten bèta.",
      inviteDescription: "E-mail voor een uitnodigingscode:",
    },
    notFound: { message: "Oeps! Pagina niet gevonden", returnHome: "Terug naar home" },
  },
  hi: {
    language: { select: "भाषा चुनें" },
    header: { contactUs: "संपर्क करें" },
    hero: {
      title: "मीडिया विखंडन",
      description:
        "लाइव खेल दुनिया की सबसे मूल्यवान बौद्धिक संपदाओं में से हैं। लेकिन मैच के बाद दूसरे प्लेटफ़ॉर्म अधिक ध्यान आकर्षित करते हैं और अधिक मूल्य हासिल करते हैं।",
      callToAction: "हम इसे वापस लाने में आपकी मदद करते हैं।",
    },
    needs: {
      title: "अवसर",
      subtitle: "वह कमी जिसे पूरा करने में हम मदद करते हैं",
      cardItems: {
        aggregates: ["स्ट्रीमिंग / OTT", "सोशल प्लेटफ़ॉर्म", "भौतिक कार्ड", "डिजिटल संग्रहणीय वस्तुएँ", "प्रशंसक पुरस्कार टोकन"],
        converts: ["सोशल प्लेटफ़ॉर्म", "भौतिक कार्ड", "डिजिटल संग्रहणीय वस्तुएँ", "गैर-मुद्रीकृत"],
        sustainable: ["सोशल मीडिया", "गेमिफाइड फ़ैन ऐप्स", "प्रशंसक पुरस्कार टोकन"],
        valuable: ["खेल सट्टेबाज़ी", "पूर्वानुमान बाज़ार", "गेमिफाइड फ़ैन ऐप्स", "भौतिक कार्ड", "डिजिटल संग्रहणीय वस्तुएँ"],
      },
      cards: {
        aggregates: {
          title: "समेकन",
          description:
            "प्रशंसकों को स्ट्रीमिंग और सोशल मीडिया प्लेटफ़ॉर्म से आपके मुख्य उत्पाद पर वापस लाता है",
        },
        converts: {
          title: "रूपांतरण",
          description: "ध्यान और पहुंच को भुगतान करने वाले ग्राहकों में बदलता है",
        },
        sustainable: {
          title: "टिकाऊ",
          description:
            "निरंतर प्रयास, निवेश या प्रोत्साहन के बिना लगातार मांग पैदा करता है",
        },
        valuable: {
          title: "मूल्यवान",
          description:
            "प्रशंसक भाग लेने से दीर्घकालिक सकारात्मक वित्तीय लाभ की उचित अपेक्षा कर सकता है",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "खेल पर अपना अधिकार",
        description: [
          "सीमित संस्करण के इंटरैक्टिव 3D डिजिटल कार्ड, जो खेल इतिहास को कार्ड पर मालिक के नाम और बाज़ार डेटा के साथ दर्ज करते हैं",
        ],
        imageAlt: "रिलिक कार्ड",
        caption: "*उदाहरण लीग के साथ नमूना उत्पाद",
      },
      voting: {
        title: "मतदान",
        description: [
          "उपयोगकर्ता जारी की गई आपूर्ति पर वोट करते हैं।",
          "सबसे लोकप्रिय विकल्प सबसे दुर्लभ बन जाता है।",
          "सबसे कम लोकप्रिय विकल्प जारी ही नहीं किया जाता।",
        ],
        imageAlt: "वोट कार्ड",
      },
      utility: {
        title: "उपयोगिता",
        description: [
          "टीम की रिलिक्स को नई उपयोगिता के लिए भुनाएं।",
          "विश्वसनीय उपयोगिता — कोई धोखा नहीं",
          "और कोई अनिश्चितता नहीं।",
        ],
        imageAlt: "टीम ग्रिड",
      },
      social: {
        title: "सामाजिक",
        description: [
          "अब अकेला मार्केटप्लेस नहीं।",
          "दोस्त आपकी ट्रॉफी केस, संग्रह कार्यक्रमों, बैज और रैंक का अनुसरण कर सकते हैं",
        ],
        imageAlt: "ट्रॉफी केस",
      },
    },
    carousel: {
      previousFeature: "पिछली सुविधा",
      nextFeature: "अगली सुविधा",
      featureLabels: {
        ownThePlays: "खेल पर अपना अधिकार सुविधा दिखाएं",
        voting: "मतदान सुविधा दिखाएं",
        utility: "उपयोगिता सुविधा दिखाएं",
        social: "सामाजिक सुविधा दिखाएं",
      },
      pauseCarousel: "कैरसेल रोकें",
      resumeCarousel: "कैरसेल फिर शुरू करें",
    },
    whitepaper: {
      description:
        "यह समझने के लिए व्हाइटपेपर पढ़ें कि जहां दूसरे असफल रहे, वहां हम उपयोगकर्ताओं, मूल्य और मांग को कैसे बनाए रखेंगे:",
      downloadTitle: "Google Drive से डाउनलोड करें",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Cornerstone Digital Sports का लोगो",
      tagline: "जहां प्रशंसक भावना का मूल्य है",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "संपर्क फ़ॉर्म बंद करें",
      investors: "निवेशक",
      investorDescription: "इक्विटी ऑफ़र की घोषणा जल्द होगी। सूचना पाने के लिए प्रतीक्षा सूची में शामिल हों:",
      leaguePartners: "लीग साझेदार",
      leagueDescription: "क्या आप चर्चा करना चाहते हैं कि हम इसे आपकी लीग तक कैसे ला सकते हैं?",
      email: "ईमेल:",
      collectors: "संग्रहकर्ता",
      collectorDescription: "क्लोज़्ड बीटा में कार्यशील डेमो जारी किया गया है।",
      inviteDescription: "आमंत्रण कोड आज़माने के लिए ईमेल:",
    },
    notFound: { message: "उफ़! पेज नहीं मिला", returnHome: "होम पर लौटें" },
  },
  zh: {
    language: { select: "选择语言" },
    header: { contactUs: "联系我们" },
    hero: {
      title: "媒体碎片化",
      description:
        "现场体育赛事是世界上最有价值的知识产权之一。但比赛结束后，其他平台吸引了更多关注，也获取了更多价值。",
      callToAction: "我们帮助你把这些带回来。",
    },
    needs: {
      title: "机会",
      subtitle: "我们助力交付的关键缺失环节",
      cardItems: {
        aggregates: ["流媒体 / OTT", "社交平台", "实体卡片", "数字收藏品", "球迷奖励代币"],
        converts: ["社交平台", "实体卡片", "数字收藏品", "未货币化"],
        sustainable: ["社交媒体", "游戏化球迷应用", "球迷奖励代币"],
        valuable: ["体育博彩", "预测市场", "游戏化球迷应用", "实体卡片", "数字收藏品"],
      },
      cards: {
        aggregates: {
          title: "聚合",
          description:
            "将粉丝从流媒体和社交媒体平台带回你的核心产品",
        },
        converts: {
          title: "转化",
          description: "将关注度和触达转化为付费客户",
        },
        sustainable: {
          title: "可持续",
          description: "无需持续投入精力、资金或激励，也能创造持续需求",
        },
        valuable: {
          title: "有价值",
          description: "粉丝可以合理期待通过参与获得长期的正向经济收益",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "拥有精彩时刻",
        description: [
          "限量版互动3D数字卡片，记录体育历史，并在卡片上展示持有者姓名和市场数据",
        ],
        imageAlt: "传奇卡片",
        caption: "*示例联赛的样品产品",
      },
      voting: {
        title: "投票",
        description: [
          "用户为发行数量投票。",
          "最受欢迎的选项会变得最稀有。",
          "最不受欢迎的选项不会发行。",
        ],
        imageAlt: "投票卡片",
      },
      utility: {
        title: "实用价值",
        description: [
          "兑换球队传奇藏品，获得新的实用价值。",
          "值得信赖的权益，没有跑路",
          "也没有随机性。",
        ],
        imageAlt: "球队网格",
      },
      social: {
        title: "社交",
        description: [
          "告别孤独的市场。",
          "朋友可以关注你的奖杯柜、收藏活动、徽章和排名",
        ],
        imageAlt: "奖杯柜",
      },
    },
    carousel: {
      previousFeature: "上一项功能",
      nextFeature: "下一项功能",
      featureLabels: {
        ownThePlays: "显示拥有精彩时刻功能",
        voting: "显示投票功能",
        utility: "显示实用价值功能",
        social: "显示社交功能",
      },
      pauseCarousel: "暂停轮播",
      resumeCarousel: "继续轮播",
    },
    whitepaper: {
      description: "阅读白皮书，了解我们将如何在其他人失败的地方留住用户、价值和需求：",
      downloadTitle: "从 Google Drive 下载",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Cornerstone Digital Sports 徽标",
      tagline: "让球迷热爱拥有价值",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "关闭联系表单",
      investors: "投资者",
      investorDescription: "股权发行即将公布。加入候补名单以接收通知：",
      leaguePartners: "联赛合作伙伴",
      leagueDescription: "想讨论如何将这项服务带到你的联赛吗？",
      email: "电子邮箱：",
      collectors: "收藏者",
      collectorDescription: "可运行的演示已发布到封闭测试版。",
      inviteDescription: "用于获取体验邀请码的邮箱：",
    },
    notFound: { message: "糟糕！页面未找到", returnHome: "返回首页" },
  },
  ja: {
    language: { select: "言語を選択" },
    header: { contactUs: "お問い合わせ" },
    hero: {
      title: "メディアの分断",
      description:
        "ライブスポーツは世界で最も価値のある知的財産の一つです。しかし試合後は、他のプラットフォームがより多くの注目を集め、より多くの価値を取り出しています。",
      callToAction: "私たちはその価値を取り戻すお手伝いをします。",
    },
    needs: {
      title: "機会",
      subtitle: "私たちが提供を支援する、欠けていたもの",
      cardItems: {
        aggregates: ["ストリーミング / OTT", "ソーシャルプラットフォーム", "物理カード", "デジタルコレクティブル", "ファン報酬トークン"],
        converts: ["ソーシャルプラットフォーム", "物理カード", "デジタルコレクティブル", "収益化なし"],
        sustainable: ["ソーシャルメディア", "ゲーミフィケーション対応ファンアプリ", "ファン報酬トークン"],
        valuable: ["スポーツベッティング", "予測市場", "ゲーミフィケーション対応ファンアプリ", "物理カード", "デジタルコレクティブル"],
      },
      cards: {
        aggregates: {
          title: "アグリゲーション",
          description:
            "ファンをストリーミングやソーシャルメディアのプラットフォームから、あなたの中核製品へ呼び戻します",
        },
        converts: {
          title: "コンバージョン",
          description: "注目とリーチを有料顧客へと変換します",
        },
        sustainable: {
          title: "持続可能",
          description:
            "継続的な努力、投資、インセンティブなしに、継続的な需要を生み出します",
        },
        valuable: {
          title: "価値がある",
          description:
            "ファンは参加することで、長期的にプラスの経済的利益を得られると合理的に期待できます",
        },
      },
    },
    features: {
      ownThePlays: {
        title: "プレーを所有する",
        description: [
          "スポーツの歴史を記録する限定版のインタラクティブ3Dデジタルカード。カードには所有者名と市場データを表示します",
        ],
        imageAlt: "レリックカード",
        caption: "*サンプルリーグの商品例",
      },
      voting: {
        title: "投票",
        description: [
          "ユーザーが発売数に投票します。",
          "最も人気のあるものが最も希少になります。",
          "最も人気のないものは発売されません。",
        ],
        imageAlt: "投票カード",
      },
      utility: {
        title: "ユーティリティ",
        description: [
          "チームのレリックを新しい価値と交換できます。",
          "信頼できるユーティリティ。運営が突然消えることも",
          "ランダム性もありません。",
        ],
        imageAlt: "チームグリッド",
      },
      social: {
        title: "ソーシャル",
        description: [
          "孤独なマーケットプレイスとはもうお別れです。",
          "友達はあなたのトロフィーケース、コレクションイベント、バッジ、ランクをフォローできます",
        ],
        imageAlt: "トロフィーケース",
      },
    },
    carousel: {
      previousFeature: "前の機能",
      nextFeature: "次の機能",
      featureLabels: {
        ownThePlays: "プレーを所有する機能を表示",
        voting: "投票機能を表示",
        utility: "ユーティリティ機能を表示",
        social: "ソーシャル機能を表示",
      },
      pauseCarousel: "カルーセルを一時停止",
      resumeCarousel: "カルーセルを再開",
    },
    whitepaper: {
      description:
        "他社が失敗した分野で、私たちがユーザー、価値、需要を維持できる理由をホワイトペーパーでご確認ください：",
      downloadTitle: "Google Driveからダウンロード",
      driveAlt: "Google Drive",
    },
    footer: {
      logoAlt: "Cornerstone Digital Sportsのロゴ",
      tagline: "ファンの情熱に価値を",
      copyright: "© {year} Cornerstone Digital Sports",
    },
    contact: {
      close: "お問い合わせフォームを閉じる",
      investors: "投資家",
      investorDescription: "株式募集の詳細は近日発表します。通知を受け取るにはウェイトリストに登録してください：",
      leaguePartners: "リーグパートナー",
      leagueDescription: "あなたのリーグにこれを届ける方法について話しませんか？",
      email: "メール：",
      collectors: "コレクター",
      collectorDescription: "動作するデモをクローズドベータで公開しています。",
      inviteDescription: "招待コードを試すためのメール：",
    },
    notFound: { message: "おっと！ページが見つかりません", returnHome: "ホームに戻る" },
  },
};
