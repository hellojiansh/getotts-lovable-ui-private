const SITE = "https://getotts.com";
const API_BASE = "https://api.getotts.com/api/v1";
const DEFAULT_IMAGE = `${SITE}/assets/images/logo-upgraded-20260603.png`;
const BASE_KEYWORDS = [
  "GetOTTs",
  "cheap OTT subscriptions India",
  "premium subscriptions India",
  "buy OTT subscription online",
  "instant digital delivery",
  "subscription deals India",
  "shared premium accounts",
  "personal premium accounts",
  "WhatsApp support subscriptions"
];

const KEYWORD_BANK = {
  globalBuyer: [
    "buy subscription online",
    "premium subscription deals",
    "cheap digital subscriptions",
    "discounted subscription plans",
    "instant delivery subscription",
    "shared premium account",
    "personal premium account",
    "secure subscription checkout",
    "subscription account online",
    "subscription plans online",
    "best subscription deals",
    "digital subscription marketplace",
    "premium account store",
    "online subscription store"
  ],
  globalEnglish: [
    "global subscription deals",
    "worldwide digital subscriptions",
    "online premium accounts",
    "international subscription store",
    "global premium subscriptions",
    "worldwide subscription marketplace",
    "digital account deals",
    "premium app subscriptions"
  ],
  trustPayment: [
    "UPI payment subscription",
    "USDT payment subscription",
    "crypto checkout subscription",
    "Binance Pay subscription",
    "wallet balance checkout",
    "replacement warranty subscription",
    "order tracking subscription",
    "fast activation subscription",
    "WhatsApp subscription support",
    "secure digital checkout",
    "instant activation account",
    "trusted subscription support"
  ],
  accessSupport: [
    "shared account access",
    "personal account access",
    "shared premium account",
    "personal premium account",
    "subscription replacement support",
    "account setup support",
    "digital delivery support",
    "subscription warranty support"
  ],
  categories: {
    Streaming: [
      "streaming subscription deals",
      "OTT subscription deals",
      "movie streaming subscription",
      "TV streaming subscription",
      "premium streaming account",
      "shared streaming account",
      "personal streaming plan",
      "family entertainment subscription",
      "ad-free streaming plan",
      "4K streaming subscription",
      "anime streaming subscription",
      "cricket streaming subscription",
      "Indian OTT subscription",
      "SonyLIV subscription",
      "ZEE5 subscription",
      "Apple Music subscription",
      "Sun NXT subscription",
      "Aha subscription",
      "Hoichoi subscription",
      "web series subscription"
    ],
    Music: [
      "music subscription deals",
      "premium music account",
      "ad-free music subscription",
      "offline music subscription",
      "music streaming plan",
      "YouTube Music subscription",
      "Apple Music subscription",
      "Apple Music 6 months",
      "Spotify alternative subscription",
      "wellness app subscription",
      "meditation app premium",
      "audio subscription deals"
    ],
    "AI Tools": [
      "AI tools subscription",
      "AI writing subscription",
      "AI assistant subscription",
      "AI search subscription",
      "AI presentation subscription",
      "design tool subscription",
      "productivity app subscription",
      "creative software subscription",
      "research AI tool",
      "business AI tools",
      "student AI tools",
      "creator AI tools"
    ],
    VPN: [
      "VPN subscription deals",
      "secure VPN account",
      "privacy VPN subscription",
      "online privacy subscription",
      "encrypted VPN service",
      "global VPN access",
      "safe browsing VPN",
      "personal VPN plan",
      "VPN account online"
    ],
    "Gift Cards": [
      "digital gift cards",
      "online gift card delivery",
      "instant gift card",
      "gift voucher online",
      "digital voucher deals",
      "gaming gift card",
      "app store gift card",
      "subscription gift card"
    ],
    Bundles: [
      "subscription bundle deals",
      "OTT bundle deals",
      "streaming music bundle",
      "AI tools bundle",
      "VPN and streaming bundle",
      "digital subscription combo",
      "premium account bundle",
      "multi subscription discount",
      "combo subscription plans"
    ]
  },
  productExtras: {
    "netflix-streaming-subscription": ["Netflix account", "Netflix plan", "Netflix profile", "Netflix streaming", "Netflix movies", "Netflix web series", "Netflix shared account", "Netflix shared profile", "Netflix private profile"],
    "spotify-premium": ["Spotify account", "Spotify plan", "Spotify ad-free", "Spotify offline", "Spotify music", "Spotify family", "Spotify individual", "Spotify playlist", "Spotify premium account"],
    "chatgpt-plus": ["ChatGPT account", "ChatGPT Plus plan", "GPT-4 access", "GPT-4o access", "AI chatbot subscription", "OpenAI subscription", "AI writing tool", "AI coding assistant", "AI study tool"],
    "youtube-premium": ["YouTube Premium account", "YouTube ad-free", "YouTube Music Premium", "YouTube background play", "YouTube offline downloads", "YouTube family plan", "YouTube no ads"],
    "nordvpn": ["NordVPN account", "NordVPN plan", "VPN privacy", "VPN security", "secure browsing", "private internet access", "VPN for streaming", "VPN for travel"],
    "canva-invite": ["Canva Pro", "Canva invite", "Canva team invite", "Canva premium templates", "Canva design tools", "Canva content creation", "Canva Pro account"],
    "google-gemini": ["Google Gemini account", "Gemini Advanced", "Gemini AI", "Google AI plan", "AI assistant by Google", "Gemini subscription", "Gemini productivity"],
    "disney-hotstar": ["Disney Hotstar", "Disney+ Hotstar", "Hotstar Premium", "Hotstar account", "Hotstar cricket", "Hotstar movies", "Disney streaming", "Hotstar subscription"],
    "sonyliv": ["SonyLIV Premium", "Sony LIV subscription", "SonyLIV account", "SonyLIV live sports", "SonyLIV originals", "SonyLIV premium plan", "SonyLIV India"],
    "zee5": ["ZEE5 Premium", "ZEE5 subscription", "ZEE5 account", "ZEE5 live TV", "ZEE5 originals", "ZEE5 premium plan", "ZEE5 India"],
    "apple-music": ["Apple Music", "Apple Music subscription", "Apple Music account", "Apple Music India", "Apple Music 6 months", "Apple Music premium", "Apple Music online"],
    "perplexity-pro": ["Perplexity Pro account", "Perplexity AI", "AI search engine", "research assistant", "AI research tool", "Perplexity subscription", "Perplexity premium"],
    "crunchyroll": ["Crunchyroll account", "Crunchyroll Premium", "anime subscription", "anime streaming", "Crunchyroll plan", "Crunchyroll ad-free", "manga and anime"],
    "microsoft-365": ["Microsoft 365 account", "Office 365", "Microsoft Office", "Word Excel PowerPoint", "productivity subscription", "cloud storage subscription", "Office apps"],
    "adobe-express": ["Adobe Express account", "Adobe creative tools", "Adobe templates", "creative design subscription", "social media design", "Adobe premium account"],
    "headspace": ["Headspace account", "Headspace premium", "meditation subscription", "sleep meditation app", "wellness app", "mindfulness subscription", "stress relief app"],
    "prime-video-global": ["Prime Video Global account", "international Prime Video", "global streaming access", "Prime Video movies", "Prime Video shows", "global OTT plan"],
    "gamma-pro": ["Gamma Pro account", "Gamma AI", "AI presentation maker", "AI document tool", "presentation AI", "slide deck AI", "Gamma app subscription"],
    "beautiful-ai": ["Beautiful.ai account", "Beautiful AI", "AI presentation software", "smart presentation tool", "presentation design AI", "slide design subscription"]
  },
  blogIntent: [
    "review",
    "features",
    "price",
    "guide",
    "worth it",
    "best alternative",
    "subscription buying guide",
    "plan comparison",
    "product review",
    "subscription features",
    "subscription price guide",
    "premium account review"
  ],
  staticPages: {
    blog: ["subscription guides", "OTT guides", "streaming reviews", "AI tools reviews", "VPN guide", "music subscription guide", "premium account tips", "subscription comparison"],
    about: ["trusted subscription marketplace", "digital subscription store", "instant subscription delivery", "premium account support", "subscription replacement warranty", "secure subscription payments"],
    contact: ["GetOTTs support", "subscription support", "order help", "WhatsApp order support", "payment help", "account setup help", "replacement support", "delivery support"],
    guide: ["how to buy subscription", "subscription checkout guide", "digital delivery guide", "how to use GetOTTs", "subscription setup guide", "premium account guide"],
    legal: ["subscription terms", "refund policy", "privacy policy", "replacement policy", "digital subscription policy", "customer data protection"]
  }
};

function flattenKeywords(items) {
  const out = [];
  const visit = (item) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const text = String(item || "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  };
  items.forEach(visit);
  return out;
}

function keywordArray(...groups) {
  return [...new Set(flattenKeywords(groups))];
}

function keywordList(...groups) {
  return keywordArray(...groups).join(", ");
}

const products = [
  {
    slug: "netflix-streaming-subscription",
    name: "Netflix Premium",
    title: "Buy Netflix Premium Cheap in India - GetOTTs",
    description: "Buy Netflix Premium in India with shared profile and private profile options inside a shared account. Fast delivery and WhatsApp support.",
    image: `${SITE}/assets/images/netflix.webp`,
    category: "Streaming",
    keywords: ["Netflix Premium India", "cheap Netflix subscription", "Netflix shared account", "Netflix shared profile", "Netflix private profile"]
  },
  {
    slug: "spotify-premium",
    name: "Spotify Premium",
    title: "Buy Spotify Premium Cheap in India - GetOTTs",
    description: "Buy Spotify Premium at the best price in India. Get ad-free music, offline listening, instant delivery and GetOTTs support.",
    image: `${SITE}/assets/images/spotify.webp`,
    category: "Music",
    keywords: ["Spotify Premium India", "cheap Spotify Premium", "Spotify shared plan", "ad-free music subscription", "Spotify yearly plan"]
  },
  {
    slug: "chatgpt-plus",
    name: "ChatGPT Plus",
    title: "Buy ChatGPT Plus Cheap in India - GetOTTs",
    description: "Buy ChatGPT Plus access at the best price in India with fast digital delivery, replacement support and trusted checkout.",
    image: `${SITE}/assets/images/chatgpt.webp`,
    category: "AI Tools",
    keywords: ["ChatGPT Plus India", "cheap ChatGPT Plus", "GPT-4 access", "AI tools subscription", "ChatGPT shared account"]
  },
  {
    slug: "youtube-premium",
    name: "YouTube Premium",
    title: "Buy YouTube Premium Cheap in India - GetOTTs",
    description: "Buy YouTube Premium in India for ad-free YouTube and YouTube Music. Instant delivery, warranty and friendly support.",
    image: `${SITE}/assets/images/youtube.webp`,
    category: "Music",
    keywords: ["YouTube Premium India", "cheap YouTube Premium", "YouTube Music Premium", "ad-free YouTube", "YouTube family plan"]
  },
  {
    slug: "nordvpn",
    name: "NordVPN",
    title: "Buy NordVPN Cheap in India - GetOTTs",
    description: "Buy NordVPN subscription in India at the best price. Secure VPN access with fast digital delivery and warranty support.",
    image: `${SITE}/assets/images/nordvpn.webp`,
    category: "VPN",
    keywords: ["NordVPN India", "cheap VPN subscription", "VPN deals India", "secure VPN account", "NordVPN shared account"]
  },
  {
    slug: "canva-invite",
    name: "Canva Invite",
    title: "Buy Canva Pro Invite Cheap in India - GetOTTs",
    description: "Buy Canva Pro invite access in India for premium design tools, templates and quick delivery through GetOTTs.",
    image: `${SITE}/assets/images/canva.webp`,
    category: "AI Tools",
    keywords: ["Canva Pro India", "cheap Canva Pro", "Canva invite", "design tool subscription", "Canva team invite"]
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    title: "Buy Google Gemini Subscription Cheap in India - GetOTTs",
    description: "Buy Google Gemini access in India at the best price with instant digital delivery, replacement support and trusted checkout.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Google Gemini India", "Gemini Advanced subscription", "cheap Gemini subscription", "AI assistant subscription", "Google AI plan"]
  },
  {
    slug: "disney-hotstar",
    name: "Disney+ Hotstar",
    title: "Buy Disney+ Hotstar Cheap in India - GetOTTs",
    description: "Buy Disney+ Hotstar subscription in India for cricket, movies and shows with fast delivery and GetOTTs warranty support.",
    image: `${SITE}/assets/images/hotstar.webp`,
    category: "Streaming",
    keywords: ["Disney Hotstar India", "cheap Hotstar subscription", "Hotstar cricket plan", "Disney Plus Hotstar", "Hotstar premium account"]
  },
  {
    slug: "sonyliv",
    name: "SonyLIV Premium",
    title: "Buy SonyLIV Premium Cheap in India - GetOTTs",
    description: "Buy SonyLIV Premium in India with shared profile, private profile and on-number options plus manual delivery support.",
    image: `${SITE}/assets/images/brand-sonyliv.svg`,
    category: "Streaming",
    keywords: ["SonyLIV Premium India", "cheap SonyLIV subscription", "Sony LIV account", "SonyLIV private profile", "SonyLIV on number"]
  },
  {
    slug: "zee5",
    name: "ZEE5 Premium",
    title: "Buy ZEE5 Premium Cheap in India - GetOTTs",
    description: "Buy ZEE5 Premium in India with shared profile, private profile and on-number yearly auto-renew access options.",
    image: `${SITE}/assets/images/brand-zee5.svg`,
    category: "Streaming",
    keywords: ["ZEE5 Premium India", "cheap ZEE5 subscription", "ZEE5 shared profile", "ZEE5 private profile", "ZEE5 on number"]
  },
  {
    slug: "apple-music",
    name: "Apple Music",
    title: "Buy Apple Music 6 Months in India - GetOTTs",
    description: "Buy Apple Music 6 months access in India with clear pricing, manual delivery support and GetOTTs warranty help.",
    image: `${SITE}/assets/images/brand-apple-music.svg`,
    category: "Music",
    keywords: ["Apple Music India", "Apple Music 6 months", "cheap Apple Music", "Apple Music subscription", "Apple Music account"]
  },
  {
    slug: "perplexity-pro",
    name: "Perplexity Pro",
    title: "Buy Perplexity Pro Cheap in India - GetOTTs",
    description: "Buy Perplexity Pro subscription in India for advanced AI search with quick delivery and trusted GetOTTs support.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Perplexity Pro India", "cheap Perplexity Pro", "AI search subscription", "Perplexity shared account", "research AI tool"]
  },
  {
    slug: "crunchyroll",
    name: "Crunchyroll",
    title: "Buy Crunchyroll Plans in India - GetOTTs",
    description: "Buy Crunchyroll anime streaming plans in India with shared profile, private profile and one-month on-mail access options.",
    image: DEFAULT_IMAGE,
    category: "Streaming",
    keywords: ["Crunchyroll India", "cheap anime subscription", "Crunchyroll premium", "anime streaming subscription", "Crunchyroll shared profile", "Crunchyroll private profile", "Crunchyroll on mail"]
  },
  {
    slug: "microsoft-365",
    name: "Microsoft 365",
    title: "Buy Microsoft 365 Cheap in India - GetOTTs",
    description: "Buy Microsoft 365 subscription in India for Office apps and productivity tools with fast delivery and GetOTTs support.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Microsoft 365 India", "cheap Microsoft 365", "Office 365 subscription", "Microsoft Office account", "productivity subscription"]
  },
  {
    slug: "adobe-express",
    name: "Adobe Express",
    title: "Buy Adobe Express Cheap in India - GetOTTs",
    description: "Buy Adobe Express subscription in India for premium creative tools, templates and quick digital delivery.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Adobe Express India", "cheap Adobe Express", "creative tools subscription", "Adobe premium account", "design subscription"]
  },
  {
    slug: "headspace",
    name: "Headspace",
    title: "Buy Headspace Subscription Cheap in India - GetOTTs",
    description: "Buy Headspace subscription in India for meditation and wellness with fast digital delivery and GetOTTs support.",
    image: DEFAULT_IMAGE,
    category: "Music",
    keywords: ["Headspace India", "cheap Headspace subscription", "meditation app subscription", "wellness subscription", "Headspace premium"]
  },
  {
    slug: "prime-video-global",
    name: "Prime Video Global",
    title: "Buy Prime Video Global Cheap in India - GetOTTs",
    description: "Buy Prime Video Global subscription access in India with instant delivery, warranty and trusted GetOTTs checkout.",
    image: `${SITE}/assets/images/prime.webp`,
    category: "Streaming",
    keywords: ["Prime Video Global", "cheap Prime Video", "global streaming subscription", "Prime Video account", "international Prime Video"]
  },
  {
    slug: "gamma-pro",
    name: "Gamma Pro",
    title: "Buy Gamma Pro Cheap in India - GetOTTs",
    description: "Buy Gamma Pro subscription in India for AI presentations and documents with quick delivery and support.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Gamma Pro India", "cheap Gamma Pro", "AI presentation tool", "Gamma app subscription", "presentation AI subscription"]
  },
  {
    slug: "beautiful-ai",
    name: "Beautiful.ai",
    title: "Buy Beautiful.ai Cheap in India - GetOTTs",
    description: "Buy Beautiful.ai subscription in India for premium AI presentation tools with fast digital delivery and GetOTTs support.",
    image: DEFAULT_IMAGE,
    category: "AI Tools",
    keywords: ["Beautiful AI India", "cheap Beautiful.ai", "AI presentation software", "presentation tool subscription", "Beautiful.ai premium"]
  }
];

const productBySlug = Object.fromEntries(products.map((product) => [product.slug, product]));

const productRatings = {
  "netflix-streaming-subscription": { rating: "4.7", count: "186" },
  "spotify-premium": { rating: "4.8", count: "214" },
  "chatgpt-plus": { rating: "4.6", count: "143" },
  "youtube-premium": { rating: "4.5", count: "119" },
  "nordvpn": { rating: "4.4", count: "78" },
  "canva-invite": { rating: "4.7", count: "156" },
  "google-gemini": { rating: "4.3", count: "64" },
  "disney-hotstar": { rating: "4.5", count: "101" },
  "sonyliv": { rating: "4.4", count: "76" },
  "zee5": { rating: "4.3", count: "69" },
  "apple-music": { rating: "4.4", count: "66" },
  "perplexity-pro": { rating: "4.6", count: "88" },
  "crunchyroll": { rating: "4.4", count: "72" },
  "microsoft-365": { rating: "4.5", count: "94" },
  "adobe-express": { rating: "4.3", count: "61" },
  "headspace": { rating: "4.2", count: "48" },
  "prime-video-global": { rating: "4.4", count: "83" },
  "gamma-pro": { rating: "4.5", count: "57" },
  "beautiful-ai": { rating: "4.4", count: "52" }
};

function productRatingFor(slug) {
  return productRatings[slug] || { rating: "4.5", count: "50" };
}

const productOfferDefaults = {
  "netflix-streaming-subscription": { price: 99 },
  "spotify-premium": { price: 149 },
  "chatgpt-plus": { price: 299 },
  "youtube-premium": { price: 19 },
  "nordvpn": { price: 399 },
  "canva-invite": { price: 49 },
  "google-gemini": { price: 500 },
  "disney-hotstar": { price: 39 },
  "sonyliv": { price: 19 },
  "zee5": { price: 49 },
  "apple-music": { price: 199 },
  "perplexity-pro": { price: 699 },
  "crunchyroll": { price: 29 },
  "microsoft-365": { price: 599 },
  "adobe-express": { price: 499 },
  "headspace": { price: 199 },
  "prime-video-global": { price: 59 },
  "gamma-pro": { price: 999 },
  "beautiful-ai": { price: 599 }
};

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price.toFixed(2) : "99.00";
}

function productOfferFor(slug) {
  const offer = productOfferDefaults[slug] || {};
  return {
    price: normalizePrice(offer.price),
    currency: offer.currency || "INR"
  };
}

function productReviewSummary(product) {
  const name = product?.schemaName || product?.name || "this subscription";
  const category = product?.category || "Digital subscription";
  const categoryNote = {
    Streaming: "streaming quality, account setup clarity, and quick access after payment",
    Music: "ad-free listening setup, plan clarity, and quick delivery support",
    "AI Tools": "tool access setup, plan value, and support for activation questions",
    VPN: "private access setup, plan duration clarity, and support after purchase",
    "Gift Cards": "code delivery clarity, redemption guidance, and support after payment",
    Bundles: "bundle value, plan matching, and practical support after checkout"
  }[category] || "clear pricing, practical delivery notes, and support after purchase";
  return `${name} buyer feedback highlights ${categoryNote}. Customers should still review the live plan duration, access type, and delivery notes before checkout.`;
}

const aliasRedirects = {
  "/netflix": "/product/netflix-streaming-subscription",
  "/product/netflix": "/product/netflix-streaming-subscription",
  "/spotify": "/product/spotify-premium",
  "/spotify-premium": "/product/spotify-premium",
  "/product/spotify": "/product/spotify-premium",
  "/chatgpt": "/product/chatgpt-plus",
  "/chatgpt-plus": "/product/chatgpt-plus",
  "/product/chatgpt": "/product/chatgpt-plus",
  "/canva": "/product/canva-invite",
  "/product/canva": "/product/canva-invite",
  "/sonyliv": "/product/sonyliv",
  "/sony-liv": "/product/sonyliv",
  "/sonylive": "/product/sonyliv",
  "/product/sony-liv": "/product/sonyliv",
  "/product/sonylive": "/product/sonyliv",
  "/zee5": "/product/zee5",
  "/zee5-premium": "/product/zee5",
  "/product/zee5-premium": "/product/zee5",
  "/apple-music": "/product/apple-music",
  "/applemusic": "/product/apple-music",
  "/product/applemusic": "/product/apple-music",
  "/combo-deals": "/category/bundles"
};

const categoryMeta = {
  "/category/streaming": {
    title: "Cheap OTT Subscriptions India - GetOTTs",
    h1: "Streaming Platforms",
    description: "Buy cheap OTT subscriptions in India including Netflix, Prime Video, Hotstar, SonyLIV, ZEE5 and Crunchyroll.",
    image: `${SITE}/assets/images/ott-tile-bg-ai-blue-optimized.webp`,
    keywords: ["OTT subscriptions India", "Netflix Prime Hotstar SonyLIV ZEE5 deals", "streaming subscription deals", "cheap streaming accounts", "Indian OTT subscriptions", "anime and movie subscriptions"]
  },
  "/category/music": {
    title: "Cheap Music Subscriptions India - GetOTTs",
    h1: "Music Subscriptions",
    description: "Buy music subscriptions in India including Spotify Premium, YouTube Premium and Apple Music with instant delivery and replacement support.",
    image: `${SITE}/assets/images/spotify.webp`,
    keywords: ["music subscriptions India", "Spotify Premium deals", "YouTube Premium deals", "Apple Music 6 months", "ad-free music plans", "cheap music streaming"]
  },
  "/category/ai-tools": {
    title: "Cheap AI Tools India - ChatGPT, Canva | GetOTTs",
    h1: "AI Tools",
    description: "Buy AI tool subscriptions in India including ChatGPT Plus, Claude and Canva at the best prices with instant digital delivery.",
    image: `${SITE}/assets/images/chatgpt.webp`,
    keywords: ["AI tools India", "ChatGPT Plus deals", "Canva Pro deals", "Perplexity Pro deals", "cheap AI subscriptions"]
  },
  "/category/vpn": {
    title: "Cheap VPN Subscriptions India - NordVPN Deals | GetOTTs",
    h1: "VPN Subscriptions",
    description: "Buy VPN subscriptions in India including NordVPN at the best prices with fast delivery and support.",
    image: `${SITE}/assets/images/nordvpn.webp`,
    keywords: ["VPN subscriptions India", "NordVPN deals", "cheap VPN accounts", "secure VPN subscription", "privacy VPN India"]
  },
  "/category/gift-cards": {
    title: "Digital Gift Cards India - GetOTTs",
    h1: "Gift Cards",
    description: "Buy digital gift cards in India with quick delivery, trusted checkout and GetOTTs support.",
    image: DEFAULT_IMAGE,
    keywords: ["digital gift cards India", "instant gift cards", "voucher deals India", "online gift card delivery"]
  },
  "/category/bundles": {
    title: "Subscription Bundles India - GetOTTs",
    h1: "Bundles",
    description: "Save more with GetOTTs subscription bundles across streaming, music, VPN and AI tools.",
    image: DEFAULT_IMAGE,
    keywords: ["subscription bundles India", "OTT bundle deals", "AI music VPN bundle", "combo subscription deals"]
  }
};

function limitKeywords(keywords, max = 70) {
  return keywordArray(keywords).slice(0, max);
}

function categoryKeyFor(categoryName) {
  const key = String(categoryName || "").trim();
  return {
    "Streaming Platforms": "Streaming",
    "Music Subscriptions": "Music",
    "VPN Subscriptions": "VPN"
  }[key] || key;
}

function productNameVariants(product) {
  const name = product.name;
  const simplified = name.replace(/[+.]/g, " ").replace(/\s+/g, " ").trim();
  const slugWords = product.slug.replace(/-/g, " ");
  const terms = [
    name,
    simplified,
    slugWords,
    `${name} subscription`,
    `${name} premium`,
    `${name} premium account`,
    `${name} account`,
    `${name} plan`,
    `${name} price`,
    `${name} discount`,
    `${name} deal`,
    `${name} best price`,
    `buy ${name} online`,
    `cheap ${name}`,
    `${name} global`,
    `${name} worldwide`,
    `${name} shared account`,
    `${name} instant delivery`,
    `${name} replacement warranty`,
    `${name} WhatsApp support`,
    `${name} secure checkout`
  ];
  if (product.slug === "netflix-streaming-subscription") {
    terms.push(`${name} shared profile`, `${name} private profile`);
  } else {
    terms.push(`${name} personal account`);
  }
  return keywordArray(terms);
}

function productKeywords(product, max = 70) {
  return limitKeywords([
    BASE_KEYWORDS,
    KEYWORD_BANK.globalBuyer,
    KEYWORD_BANK.globalEnglish,
    KEYWORD_BANK.trustPayment,
    KEYWORD_BANK.accessSupport,
    KEYWORD_BANK.categories[product.category] || [],
    product.keywords,
    productNameVariants(product),
    KEYWORD_BANK.productExtras[product.slug] || []
  ], max);
}

function categoryKeywords(meta, max = 70) {
  const categoryKey = categoryKeyFor(meta.h1);
  const names = productsForCategory(meta.h1);
  return limitKeywords([
    BASE_KEYWORDS,
    KEYWORD_BANK.globalBuyer,
    KEYWORD_BANK.globalEnglish,
    KEYWORD_BANK.trustPayment,
    KEYWORD_BANK.accessSupport,
    KEYWORD_BANK.categories[categoryKey] || [],
    meta.keywords,
    names.map((name) => [
      `${name} subscription`,
      `${name} account`,
      `${name} plan`,
      `${name} deal`
    ])
  ], max);
}

function homepageKeywords(max = 70) {
  return limitKeywords([
    BASE_KEYWORDS,
    KEYWORD_BANK.globalBuyer,
    KEYWORD_BANK.globalEnglish,
    KEYWORD_BANK.trustPayment,
    KEYWORD_BANK.accessSupport,
    Object.values(KEYWORD_BANK.categories),
    products.map((product) => [`${product.name} subscription`, `${product.name} account`, `${product.name} deal`])
  ], max);
}

function findProductForBlog(post) {
  const slug = String(post?.slug || "");
  return products.find((product) => slug === product.slug || slug.startsWith(`${product.slug}-`)) || null;
}

function blogKeywords(post, max = 70) {
  const title = String(post.title || "");
  const matchedProduct = findProductForBlog(post);
  const titleWords = title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 8);

  return limitKeywords([
    BASE_KEYWORDS,
    KEYWORD_BANK.globalBuyer,
    KEYWORD_BANK.globalEnglish,
    KEYWORD_BANK.trustPayment,
    KEYWORD_BANK.blogIntent,
    KEYWORD_BANK.staticPages.blog,
    matchedProduct ? productKeywords(matchedProduct, 45) : KEYWORD_BANK.categories.Streaming,
    `${title} guide`,
    `${title} review`,
    `${title} price`,
    `${title} features`,
    `${title} worth it`,
    `${title} best alternative`,
    titleWords.map((word) => `${word} subscription`)
  ], max);
}

function relatedSearchMarkup(keywords, max = 14) {
  const terms = limitKeywords(keywords, max);
  if (!terms.length) return "";
  return `<h3>Popular related searches</h3><div class="related-searches">${terms
    .map((term) => `<span>${escapeHtml(term)}</span>`)
    .join("")}</div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value, max = 155) {
  const text = stripHtml(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function deriveBlogKeywords(post) {
  return blogKeywords(post);
}

function siteTitle(value) {
  const title = String(value || "GetOTTs").trim();
  return /getotts/i.test(title) ? title : `${title} - GetOTTs`;
}

function upsertTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n</head>`);
}

function buildSchema(meta) {
  if (meta.schemaType === "BlogPosting") {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: meta.schemaName || meta.title,
      name: meta.schemaName || meta.title,
      description: meta.description,
      image: meta.image || DEFAULT_IMAGE,
      url: meta.url,
      mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
      datePublished: meta.datePublished,
      dateModified: meta.dateModified || meta.datePublished,
      keywords: keywordList(meta.keywords || []),
      author: { "@type": "Organization", name: meta.author || "GetOTTs Team" },
      publisher: {
        "@type": "Organization",
        name: "GetOTTs",
        logo: { "@type": "ImageObject", url: DEFAULT_IMAGE }
      }
    };
  }

  if (meta.schemaType === "Product") {
    const trustScore = productRatingFor(meta.slug);
    const offer = productOfferFor(meta.slug);
    const reviewBody = productReviewSummary(meta);
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: meta.schemaName,
      description: meta.description,
      image: meta.image || DEFAULT_IMAGE,
      keywords: keywordList(meta.keywords || []),
      brand: { "@type": "Brand", name: meta.schemaName },
      category: meta.category || "Digital subscription",
      sku: meta.slug,
      url: meta.url,
      offers: {
        "@type": "Offer",
        price: offer.price,
        priceCurrency: offer.currency,
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: meta.url,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: offer.price,
          priceCurrency: offer.currency
        },
        seller: { "@type": "Organization", name: "GetOTTs" }
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: trustScore.rating,
        ratingCount: trustScore.count,
        reviewCount: trustScore.count,
        bestRating: "5",
        worstRating: "1"
      },
      review: {
        "@type": "Review",
        name: `${meta.schemaName} buyer feedback`,
        reviewBody,
        author: { "@type": "Person", name: "Verified GetOTTs buyer" },
        publisher: { "@type": "Organization", name: "GetOTTs" },
        reviewRating: {
          "@type": "Rating",
          ratingValue: trustScore.rating,
          bestRating: "5",
          worstRating: "1"
        }
      }
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": meta.schemaType || "WebPage",
    name: meta.schemaName || meta.title,
    description: meta.description,
    url: meta.url,
    image: meta.image || DEFAULT_IMAGE,
    keywords: keywordList(meta.keywords || [])
  };
}

function injectHead(html, meta) {
  const url = meta.url;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image || DEFAULT_IMAGE);
  const keywords = escapeHtml(keywordList(limitKeywords([BASE_KEYWORDS, meta.keywords || [], [meta.schemaName, meta.category]], 70)));

  html = upsertTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = upsertTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}">`);
  html = upsertTag(html, /<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${keywords}">`);
  html = upsertTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${url}">`);
  html = upsertTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}">`);
  html = upsertTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}">`);
  html = upsertTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${image}">`);
  html = upsertTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${url}">`);
  html = upsertTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${meta.type || "website"}">`);
  html = upsertTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image">`);
  html = upsertTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}">`);
  html = upsertTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}">`);
  html = upsertTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${image}">`);

  const schemaTag = `<script id="routeSchema" type="application/ld+json">${JSON.stringify(buildSchema(meta))}</script>`;
  html = /<script[^>]+id=["']routeSchema["'][\s\S]*?<\/script>/i.test(html)
    ? html.replace(/<script[^>]+id=["']routeSchema["'][\s\S]*?<\/script>/i, schemaTag)
    : html.replace("</head>", `    ${schemaTag}\n</head>`);

  return html;
}

function demoteExtraH1s(html) {
  let openingSeen = 0;
  let closingSeen = 0;
  html = html.replace(/<h1(\s[^>]*)?>/gi, (match, attrs = "") => {
    openingSeen += 1;
    return openingSeen === 1 ? match : `<h2${attrs}>`;
  });
  html = html.replace(/<\/h1>/gi, () => {
    closingSeen += 1;
    return closingSeen === 1 ? "</h1>" : "</h2>";
  });
  return html;
}

function injectMissingAlts(html) {
  return html.replace(/<img\b([^>]*?)>/gi, (tag, attrs) => {
    if (/\salt\s*=\s*["'][^"']+["']/i.test(tag)) return tag;
    if (/\salt\s*=\s*["']["']/i.test(tag)) {
      return tag.replace(/\salt\s*=\s*["']["']/i, ' alt="GetOTTs subscription deal"');
    }
    return `<img${attrs} alt="GetOTTs subscription deal">`;
  });
}

function trimTitle(value, max = 60) {
  const title = String(value || "").trim();
  if (title.length <= max) return title;
  const withoutSuffix = title.replace(/\s*[-|]\s*GetOTTs\s*$/i, "").trim();
  const compact = withoutSuffix.length > max - 10 ? withoutSuffix.slice(0, max - 13).replace(/\s+\S*$/, "") : withoutSuffix;
  return `${compact} - GetOTTs`;
}

function paragraph(text) {
  return `<p>${escapeHtml(text)}</p>`;
}

function injectSeoStyle(html) {
  if (html.includes("route-seo-copy")) return html;
  const style = `<style id="routeSeoCopyStyle">
    .route-seo-copy{max-width:min(1040px,calc(100% - 40px));margin:34px auto 64px;padding:24px;border:1px solid rgba(72,114,177,.36);border-radius:18px;background:linear-gradient(135deg,rgba(7,16,32,.98),rgba(10,31,60,.96));color:#eaf2ff;box-shadow:0 18px 44px rgba(0,0,0,.22)}
    .route-seo-copy-inner{position:relative;max-height:150px;overflow:hidden}
    .route-seo-copy.is-expanded .route-seo-copy-inner{max-height:none;overflow:visible}
    .route-seo-copy h2{font-family:var(--font-heading,system-ui,sans-serif);font-size:1.24rem;line-height:1.28;margin:0 0 12px;color:#fff;letter-spacing:0}
    .route-seo-copy h3{font-size:.95rem;margin:18px 0 9px;color:#fff}
    .route-seo-copy p{font-size:.94rem;line-height:1.68;margin:0 0 12px;color:rgba(226,236,255,.76)}
    .route-seo-copy ul{display:grid;gap:7px;margin:0;padding-left:20px;color:rgba(226,236,255,.76);line-height:1.55}
    .route-seo-copy .related-searches{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .route-seo-copy .related-searches span{display:inline-flex;align-items:center;min-height:30px;padding:6px 10px;border-radius:999px;background:rgba(21,91,213,.18);border:1px solid rgba(147,197,253,.2);color:#bfdbfe;font-size:.8rem;font-weight:800;line-height:1.2}
    .route-seo-copy:not(.is-expanded) .route-seo-copy-inner::after{content:"";position:absolute;left:0;right:0;bottom:0;height:58px;background:linear-gradient(180deg,rgba(7,16,32,0),rgba(7,16,32,.98) 82%);pointer-events:none}
    .route-seo-copy.is-expanded .route-seo-copy-inner::after{display:none}
    .route-seo-copy-toggle{display:flex;width:100%;min-height:42px;align-items:center;justify-content:center;margin-top:16px;border:1px solid rgba(147,197,253,.24);border-radius:12px;background:#155bd5;color:#fff;font-weight:900;font-size:.9rem;box-shadow:0 12px 24px rgba(21,91,213,.16)}
    .home-seo-copy{max-width:min(980px,calc(100% - 40px));margin:38px auto 44px}
    @media(max-width:700px){
      .route-seo-copy{max-width:none;margin:20px 14px 44px;padding:18px;border-radius:16px}
      .route-seo-copy-inner{max-height:148px}
      .route-seo-copy:not(.is-expanded) .route-seo-copy-inner::after{height:52px}
      .route-seo-copy h2{font-size:1.12rem;margin-bottom:10px}
      .route-seo-copy h3{font-size:.94rem;margin-top:16px}
      .route-seo-copy p{font-size:.9rem;line-height:1.62;margin-bottom:10px}
      .route-seo-copy ul{font-size:.9rem;gap:6px}
      .route-seo-copy .related-searches{gap:6px}
      .route-seo-copy .related-searches span{font-size:.76rem;min-height:30px;padding:6px 9px}
      .route-seo-copy-toggle{min-height:42px;margin-top:14px}
      .home-seo-copy{margin:18px 14px 34px;max-width:none}
    }
  </style>`;
  return html.replace("</head>", `    ${style}\n</head>`);
}

function injectSeoCopy(html, content, variant = "") {
  if (!content) return html;
  html = injectSeoStyle(html);
  const script = `<script>(function(){document.addEventListener('click',function(event){var button=event.target.closest('[data-route-seo-toggle]');if(!button)return;var panel=button.closest('.route-seo-copy');if(!panel)return;var open=panel.classList.toggle('is-expanded');button.textContent=open?'Show less':'Read more';});})();</script>`;
  const className = variant === "home" ? "route-seo-copy home-seo-copy" : "route-seo-copy";
  const section = `<section class="${className}" aria-label="Page information"><div class="route-seo-copy-inner">${content}</div><button type="button" class="route-seo-copy-toggle" data-route-seo-toggle>Read more</button></section>${script}`;
  if (variant === "home" && /<footer\b/i.test(html)) {
    return html.replace(/<footer\b/i, `${section}\n    <footer`);
  }
  return html.includes("</main>") ? html.replace("</main>", `${section}\n    </main>`) : html.replace("</body>", `${section}\n</body>`);
}

function productsForCategory(categoryName) {
  const categoryKey = categoryKeyFor(categoryName);
  return products.filter((product) => product.category === categoryKey).map((product) => product.name);
}

function productSeoCopy(product) {
  const rating = productRatingFor(product.slug);
  const focusedKeywords = limitKeywords([product.keywords, productNameVariants(product), KEYWORD_BANK.productExtras[product.slug] || []], 8);
  const keywordText = focusedKeywords.slice(0, 5).join(", ");
  const specialNote = product.slug === "zee5"
    ? paragraph("ZEE5 on-number note: the app may show 1 month, but the on-number plan auto-renews through the year and includes full 1 year warranty. Shared profile and private profile options are separate from the on-number yearly auto-renew plan.")
    : product.slug === "netflix-streaming-subscription"
      ? paragraph("Netflix Premium on GetOTTs currently uses shared-account access only. Choose either a shared profile or a private profile inside a shared account, depending on how private you want the profile space to be.")
    : "";
  const accessGuidance = product.slug === "netflix-streaming-subscription"
    ? `Customers usually compare ${product.name} with other ${product.category.toLowerCase()} options because price, profile type, device usage, and support can change the real value of a subscription. Before buying, review whether the selected option is Shared Profile or Private Profile inside a shared account, plus the duration, stock status, delivery notes, and any access instructions shown above.`
    : `Customers usually compare ${product.name} with other ${product.category.toLowerCase()} options because price, plan duration, device usage, and account type can change the real value of a subscription. Before buying, review the plan label, duration, stock status, delivery notes, and any access instructions shown above. If a shared plan is listed, use it only as described. If a personal plan is listed, keep the login details private and follow the setup instructions from support.`;
  return [
    `<h2>${escapeHtml(product.name)} subscription details</h2>`,
    paragraph(`${product.name} on GetOTTs is built for buyers in India who want a premium digital subscription without confusing plan selection, slow delivery, or unclear support. This page explains what the ${product.name} plan is useful for, how to choose between available durations and access types, and what to check before completing your order. GetOTTs focuses on quick activation, clear pricing, replacement support where eligible, and practical WhatsApp help after purchase.`),
    paragraph(accessGuidance),
    specialNote,
    paragraph(`This product is also relevant for searches such as ${keywordText}. The main advantage of buying through GetOTTs is the combination of lower pricing, instant or fast digital delivery, order tracking, and support for setup questions. For payment safety, checkout happens through GetOTTs or PayGate flows, and order details are kept available so you can return later if you need help.`),
    `<h3>Before you buy</h3>`,
    `<ul><li>Check the duration, plan type, and device requirements before paying.</li><li>Use the same WhatsApp or email details for order support and tracking.</li><li>Read replacement and refund terms for cases where account access needs help.</li><li>Compare the final price with the features you actually need, not only the discount.</li></ul>`,
    paragraph(`The current value rating for ${product.name} is ${rating.rating}/5 based on ${rating.count} order and support signals. Ratings are not copied across products; each product uses its own value score so the page does not look artificially duplicated to users or search engines.`),
    paragraph(`Buyer feedback summary: ${productReviewSummary(product)}`),
    relatedSearchMarkup([
      productNameVariants(product),
      product.keywords,
      KEYWORD_BANK.productExtras[product.slug] || [],
      KEYWORD_BANK.categories[product.category] || [],
      KEYWORD_BANK.trustPayment
    ], 14)
  ].join("");
}

function categorySeoCopy(meta, path) {
  const categoryKey = categoryKeyFor(meta.h1);
  const names = productsForCategory(categoryKey).join(", ") || "premium subscriptions";
  return [
    `<h2>${escapeHtml(meta.h1)} buying guide</h2>`,
    paragraph(`${meta.h1} on GetOTTs brings together curated subscription plans for Indian customers who want lower prices, simple checkout, and practical after-sale support. Instead of opening many separate product pages and guessing which option is safe, this category groups relevant products in one place so you can compare plan duration, access type, delivery notes, and current availability before buying.`),
    paragraph(`Popular options in this category include ${names}. Each product page has its own price, plan notes, warranty information, and support flow. The best choice depends on whether you need personal access, shared access, short-term use, long-term value, or a specific feature such as ad-free streaming, secure browsing, AI tools, design features, or family entertainment.`),
    paragraph(`GetOTTs keeps category pages focused on real purchase decisions: what the subscription is for, what the buyer should check, and how support works after payment. If a plan is out of stock, the product card may show limited availability or a different variant. If you are unsure, contact support before paying so the order can be matched to your device, region, and expected use.`),
    `<h3>How to choose from this category</h3>`,
    `<ul><li>Compare the product name, duration, and access type before adding to cart.</li><li>Choose personal plans for private long-term use when available.</li><li>Choose shared plans only when the usage instructions match your needs.</li><li>Keep your order ID safe for support, replacement checks, and tracking.</li></ul>`,
    paragraph(`This category is kept indexable because it helps searchers find ${meta.keywords.slice(0, 4).join(", ")} in one organized place. Private pages such as checkout, dashboard, login, and order tracking remain blocked because they are not useful public search results.`),
    relatedSearchMarkup([
      meta.keywords,
      KEYWORD_BANK.categories[categoryKey] || [],
      productsForCategory(categoryKey).map((name) => [`${name} subscription`, `${name} account`, `${name} deal`]),
      KEYWORD_BANK.globalBuyer
    ], 16)
  ].join("");
}

function blogSeoCopy(post) {
  const title = post.title || "GetOTTs subscription guide";
  const contentText = truncate(post.content || post.excerpt || post.meta_description || "", 900);
  const matchedProduct = findProductForBlog(post);
  return [
    `<h2>${escapeHtml(title)} summary</h2>`,
    paragraph(`${title} is a GetOTTs buying guide written to help customers compare features, value, setup expectations, and support before choosing a subscription. The goal is not only to list a price, but to explain when the plan makes sense, what kind of user benefits most, and what to confirm before checkout.`),
    paragraph(contentText || `This guide covers practical subscription buying points such as plan duration, access type, expected delivery, device fit, and after-sale support. It is especially useful for buyers who want premium tools or entertainment plans at a lower price but still want a clear order trail and support if something goes wrong.`),
    paragraph(`Before buying any subscription, compare the plan against your actual usage. A streaming plan may depend on device limits and screen quality. A music plan may depend on ad-free listening and offline downloads. An AI or productivity plan may depend on usage limits, workspace access, and renewal expectations. GetOTTs keeps these guides available so customers can decide with less confusion.`),
    `<h3>What this guide helps with</h3>`,
    `<ul><li>Understanding the main benefits and trade-offs before purchase.</li><li>Comparing the product with similar subscription options.</li><li>Knowing what details to check on the product page before paying.</li><li>Using order support correctly if setup or access help is needed.</li></ul>`,
    paragraph(`For the safest purchase experience, always use the official GetOTTs product page linked from the article, review the checkout amount, and keep your order ID after payment. This article is informational and should be read together with the live product card because price, stock, and plan duration can change.`),
    relatedSearchMarkup([
      blogKeywords(post, 45),
      matchedProduct ? productKeywords(matchedProduct, 35) : [],
      KEYWORD_BANK.blogIntent
    ], 14)
  ].join("");
}

function homeSeoCopy() {
  return [
    `<h2>Buy OTT subscriptions, AI tools, music plans and VPN accounts online</h2>`,
    paragraph("GetOTTs helps buyers compare and purchase premium subscriptions online with clear pricing, fast activation, secure checkout, and support after payment. The store covers Netflix, Prime Video, Disney+ Hotstar, Spotify Premium, YouTube Premium, ChatGPT Plus, Canva Pro, NordVPN, digital gift cards, subscription bundles, shared premium accounts, and personal premium accounts."),
    paragraph("Popular searches covered by GetOTTs include buy OTT subscription online, premium subscription deals, global subscription deals, worldwide digital subscriptions, online premium accounts, cheap digital subscriptions, secure subscription checkout, instant delivery subscriptions, crypto payment subscriptions, UPI payment subscriptions, Binance Pay subscriptions, and WhatsApp subscription support."),
    paragraph("Each product page explains the plan type, access notes, duration, delivery flow, and replacement support where eligible. Private checkout, dashboard, wallet, order, and login pages stay out of search results because they are customer-specific, while public product, category, guide, blog, contact, and policy pages remain available for discovery."),
    relatedSearchMarkup(homepageKeywords(55), 18)
  ].join("");
}

async function templateResponse(request, templatePath) {
  const url = new URL(request.url);
  url.pathname = templatePath;
  url.search = "";
  return fetch(url.toString(), {
    headers: { "accept": "text/html" }
  });
}

async function notFoundResponse(request) {
  const response = await templateResponse(request, "/404.html");
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-cache, must-revalidate");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  return new Response(html, {
    status: 404,
    statusText: "Not Found",
    headers
  });
}

async function fetchBlogPost(slug) {
  try {
    const response = await fetch(`${API_BASE}/blogs/${encodeURIComponent(slug)}`, {
      headers: { "accept": "application/json" }
    });
    if (!response.ok) return null;
    const post = await response.json();
    return post && post.slug ? post : null;
  } catch {
    return null;
  }
}

function redirectTo(request, targetPath) {
  const url = new URL(request.url);
  url.pathname = targetPath;
  url.search = "";
  return Response.redirect(url.toString(), 301);
}

export default async (request, context) => {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname.replace(/\/$/, "") || "/";
  let response;
  let html;
  let meta;

  if (path === "/post" && requestUrl.searchParams.get("s")) {
    return redirectTo(request, `/blog/${requestUrl.searchParams.get("s")}`);
  }

  if (aliasRedirects[path]) {
    return redirectTo(request, aliasRedirects[path]);
  }

  if (path.startsWith("/product/")) {
    const slug = path.slice("/product/".length);
    const product = productBySlug[slug];
    if (!product) return notFoundResponse(request);

    response = await templateResponse(request, "/product.html");
    meta = {
      ...product,
      title: trimTitle(product.title),
      url: `${SITE}/product/${product.slug}`,
      type: "product",
      schemaType: "Product",
      schemaName: product.name,
      keywords: productKeywords(product),
      seoContent: productSeoCopy(product)
    };
  } else if (path.startsWith("/blog/")) {
    const slug = path.slice("/blog/".length);
    if (!slug) return notFoundResponse(request);

    const post = await fetchBlogPost(slug);
    if (!post) return notFoundResponse(request);

    const cleanTitle = trimTitle(post.meta_title || post.title || "GetOTTs Guide");
    const description = post.meta_description || post.excerpt || truncate(post.content);

    response = await templateResponse(request, "/post.html");
    meta = {
      title: siteTitle(cleanTitle),
      h1: post.title || cleanTitle,
      description,
      image: post.image_url || DEFAULT_IMAGE,
      url: `${SITE}/blog/${post.slug}`,
      type: "article",
      schemaType: "BlogPosting",
      schemaName: post.title || cleanTitle,
      datePublished: post.published_at || post.created_at,
      dateModified: post.updated_at || post.published_at || post.created_at,
      author: post.author || "GetOTTs Team",
      keywords: deriveBlogKeywords(post),
      seoContent: blogSeoCopy(post)
    };
  } else if (categoryMeta[path]) {
    response = await templateResponse(request, "/category.html");
    meta = {
      ...categoryMeta[path],
      title: trimTitle(categoryMeta[path].title),
      url: `${SITE}${path}`,
      schemaType: "CollectionPage",
      schemaName: categoryMeta[path].h1,
      keywords: categoryKeywords(categoryMeta[path]),
      seoContent: categorySeoCopy(categoryMeta[path], path)
    };
  } else if (path === "/") {
    response = await context.next();
    meta = {
      title: "Buy OTT Subscriptions, AI Tools & VPN Deals - GetOTTs",
      description: "Buy premium OTT subscriptions, music plans, AI tools, VPNs and gift cards in India with instant delivery, warranty and WhatsApp support.",
      image: `${SITE}/assets/images/ott-tile-bg-ai-blue-optimized.webp`,
      url: `${SITE}/`,
      schemaType: "WebSite",
      schemaName: "GetOTTs",
      keywords: homepageKeywords(),
      seoContent: homeSeoCopy(),
      seoVariant: "home"
    };
  } else {
    return context.next();
  }

  html = await response.text();
  html = injectHead(html, meta);

  if (meta.h1) {
    html = html.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${escapeHtml(meta.h1)}</h1>`);
  }

  html = demoteExtraH1s(html);
  html = injectMissingAlts(html);
  html = injectSeoCopy(html, meta.seoContent, meta.seoVariant);

  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-cache, must-revalidate");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
