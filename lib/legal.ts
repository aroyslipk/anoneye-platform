import type { Locale } from "@/lib/i18n/dictionaries";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

const privacyEn: LegalSection[] = [
  {
    heading: "Who operates Anoneye",
    paragraphs: [
      "Anoneye is a self-hosted starter application. The person or organisation that deploys it (the operator) is responsible for the deployment, its configuration, and how the data described here is handled.",
      "This document is a starter template. It is not legal advice and has not been reviewed by a lawyer.",
    ],
  },
  {
    heading: "What the application stores",
    bullets: [
      "Account data: email address, an optional display name, a password hash (local backend only) or the authentication record handled by Supabase Auth.",
      "Connected-account data: Meta account and Page identifiers, granted permission names, and access tokens encrypted at rest with AES-256-GCM.",
      "Tracked-profile data: the normalised username, platform, canonical profile URL, optional label, monitoring status and the last sync status.",
      "Observations: timestamped follower/following/media counts and the data source, plus sync-job records (status, retry count, error code).",
      "Media metadata returned by the API: ids, captions, timestamps, public CDN URLs and engagement counts. Media files are not copied to Anoneye's servers.",
      "Report records and contact messages submitted through the contact form.",
      "Essential cookies: a session cookie (HttpOnly) and a short-lived OAuth state cookie.",
    ],
  },
  {
    heading: "How the data is used",
    paragraphs: [
      "The data is used to authenticate you, fetch public profile data from the official Meta APIs on your behalf, record observations for profiles you choose to track, render reports, export your own data, and protect the service against abuse.",
      "Anoneye does not run advertising trackers, does not sell personal data, and does not use the data to build shadow profiles of people who do not use the service.",
    ],
  },
  {
    heading: "Third parties",
    bullets: [
      "Meta Platforms (Instagram and Facebook): profile and media metadata are requested through the Graph API under the permissions you grant. Meta's own terms apply to that processing.",
      "Supabase, when configured: database, authentication and row-level security. The operator chooses the region and project.",
      "No analytics, advertising or data-broker services are integrated by default.",
    ],
  },
  {
    heading: "Retention and deletion",
    paragraphs: [
      "Tracked profiles, observations and media metadata remain until you delete them or delete your account. Deleting your account removes your Anoneye data and (where Supabase Auth is used) the authentication record.",
      "Connected-account credentials can be disconnected at any time from Settings; the encrypted token is then removed.",
    ],
  },
  {
    heading: "Your choices and rights",
    bullets: [
      "Export every record Anoneye stores about you as JSON from Settings → Privacy.",
      "Delete all Anoneye data while keeping your login, or delete the account entirely.",
      "Disconnect a Meta account at any time.",
      "Contact the operator to ask about access, correction or other rights available in your jurisdiction.",
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "Access tokens are encrypted at rest and never sent to the browser. Server routes validate input, enforce same-origin checks and rate limits, and authorise every record by owner id. Supabase deployments additionally rely on row-level security.",
      "No system is perfectly secure. Report suspected issues to the operator through the contact page.",
    ],
  },
  {
    heading: "What Anoneye does not do",
    paragraphs: [
      "Anoneye does not scrape pages, does not bypass private or age-gated accounts, does not use borrowed sessions, does not hide story views, and cannot reveal who visited a profile. Those capabilities are not offered by the official APIs and are not simulated here.",
    ],
  },
  { heading: "Changes", paragraphs: ["The operator may update this policy; the date at the top of the page shows the current version."] },
];

const privacyBn: LegalSection[] = [
  {
    heading: "Anoneye কে পরিচালনা করে",
    paragraphs: [
      "Anoneye একটি স্ব-হোস্টেড স্টার্টার অ্যাপ্লিকেশন। যিনি বা যে প্রতিষ্ঠান এটি ডিপ্লয় করেন (অপারেটর) তিনিই ডিপ্লয়মেন্ট, কনফিগারেশন এবং এখানে বর্ণিত ডেটা পরিচালনার দায়িত্বে আছেন।",
      "এই নথিটি একটি প্রাথমিক টেমপ্লেট। এটি আইনি পরামর্শ নয় এবং কোনো আইনজীবী এটি পর্যালোচনা করেননি।",
    ],
  },
  {
    heading: "অ্যাপ্লিকেশন কী সংরক্ষণ করে",
    bullets: [
      "অ্যাকাউন্ট ডেটা: ইমেইল ঠিকানা, ঐচ্ছিক প্রদর্শিত নাম, পাসওয়ার্ড হ্যাশ (শুধু লোকাল ব্যাকএন্ডে) অথবা Supabase Auth-এর পরিচালিত authentication রেকর্ড।",
      "সংযুক্ত অ্যাকাউন্ট ডেটা: Meta অ্যাকাউন্ট ও পেজ আইডি, অনুমোদিত পারমিশনের নাম এবং AES-256-GCM দিয়ে এনক্রিপ্ট করা অ্যাক্সেস টোকেন।",
      "ট্র্যাক করা প্রোফাইলের ডেটা: স্বাভাবিক করা ইউজারনেম, প্ল্যাটফর্ম, ক্যানোনিকাল প্রোফাইল URL, ঐচ্ছিক লেবেল, মনিটরিং অবস্থা ও শেষ সিঙ্ক অবস্থা।",
      "পর্যবেক্ষণ: সময়-চিহ্নিত ফলোয়ার/ফলোয়িং/মিডিয়া সংখ্যা ও ডেটার উৎস, এবং সিঙ্ক জবের রেকর্ড (অবস্থা, পুনঃচেষ্টা সংখ্যা, ত্রুটি কোড)।",
      "API থেকে পাওয়া মিডিয়া মেটাডেটা: আইডি, ক্যাপশন, সময়, পাবলিক CDN URL ও এনগেজমেন্ট সংখ্যা। মিডিয়া ফাইল Anoneye-এর সার্ভারে কপি করা হয় না।",
      "রিপোর্ট রেকর্ড এবং যোগাযোগ ফর্মে পাঠানো বার্তা।",
      "প্রয়োজনীয় কুকি: একটি সেশন কুকি (HttpOnly) ও স্বল্পস্থায়ী OAuth state কুকি।",
    ],
  },
  {
    heading: "ডেটা কীভাবে ব্যবহৃত হয়",
    paragraphs: [
      "ডেটা ব্যবহৃত হয় আপনাকে authenticate করতে, আপনার পক্ষ থেকে অফিসিয়াল Meta API-তে পাবলিক প্রোফাইল ডেটা আনতে, আপনি যে প্রোফাইল ট্র্যাক করতে বেছে নেন তার পর্যবেক্ষণ সংরক্ষণ করতে, রিপোর্ট দেখাতে, আপনার নিজের ডেটা এক্সপোর্ট করতে এবং অপব্যবহার ঠেকাতে।",
      "Anoneye বিজ্ঞাপন ট্র্যাকার চালায় না, ব্যক্তিগত ডেটা বিক্রি করে না এবং সেবা ব্যবহার না করা মানুষের ছায়া-প্রোফাইল বানাতে ডেটা ব্যবহার করে না।",
    ],
  },
  {
    heading: "তৃতীয় পক্ষ",
    bullets: [
      "Meta Platforms (Instagram ও Facebook): আপনি যে পারমিশন দেন তার অধীনে Graph API দিয়ে প্রোফাইল ও মিডিয়া মেটাডেটা অনুরোধ করা হয়। সেই প্রক্রিয়ায় Meta-র নিজস্ব শর্ত প্রযোজ্য।",
      "Supabase, কনফিগার করা থাকলে: ডেটাবেস, authentication ও row-level security। অঞ্চল ও প্রজেক্ট অপারেটর বেছে নেন।",
      "ডিফল্টভাবে কোনো analytics, বিজ্ঞাপন বা data-broker সেবা সংযুক্ত নেই।",
    ],
  },
  {
    heading: "সংরক্ষণের সময় ও মুছে ফেলা",
    paragraphs: [
      "ট্র্যাক করা প্রোফাইল, পর্যবেক্ষণ ও মিডিয়া মেটাডেটা আপনি মুছুন বা অ্যাকাউন্ট মুছুন পর্যন্ত থাকে। অ্যাকাউন্ট মুছলে আপনার Anoneye ডেটা এবং (Supabase Auth ব্যবহৃত হলে) authentication রেকর্ড মুছে যায়।",
      "সেটিংস থেকে যেকোনো সময় সংযুক্ত অ্যাকাউন্ট বিচ্ছিন্ন করা যায়; তখন এনক্রিপ্ট করা টোকেন সরিয়ে ফেলা হয়।",
    ],
  },
  {
    heading: "আপনারchoice ও অধিকার",
    bullets: [
      "সেটিংস → গোপনীয়তা থেকে Anoneye-এর সংরক্ষিত সব রেকর্ড JSON হিসেবে এক্সপোর্ট করুন।",
      "লগইন রেখে সব Anoneye ডেটা মুছুন, অথবা পুরো অ্যাকাউন্ট মুছুন।",
      "যেকোনো সময় Meta অ্যাকাউন্ট বিচ্ছিন্ন করুন।",
      "আপনার এখতিয়ারে প্রযোজ্য অধিকার নিয়ে জানতে অপারেটরের সাথে যোগাযোগ করুন।",
    ],
  },
  {
    heading: "নিরাপত্তা",
    paragraphs: [
      "অ্যাক্সেস টোকেন এনক্রিপ্ট করে রাখা হয় এবং কখনো ব্রাউজারে পাঠানো হয় না। সার্ভার রুট ইনপুট যাচাই, same-origin পরীক্ষা ও rate limit প্রয়োগ করে এবং প্রতিটি রেকর্ড owner id দিয়ে অনুমোদন করে। Supabase ডিপ্লয়মেন্টে অতিরিক্তভাবে row-level security ব্যবহৃত হয়।",
      "কোনো সিস্টেমই সম্পূর্ণ নিরাপদ নয়। সন্দেহভাজন সমস্যা যোগাযোগ পেজের মাধ্যমে অপারেটরকে জানান।",
    ],
  },
  {
    heading: "Anoneye যা করে না",
    paragraphs: [
      "Anoneye পেজ স্ক্র্যাপ করে না, প্রাইভেট বা বয়স-সীমাবদ্ধ অ্যাকাউন্ট বাইপাস করে না, ধার করা সেশন ব্যবহার করে না, স্টোরি ভিউ লুকায় না এবং কে প্রোফাইল দেখেছে তা প্রকাশ করতে পারে না। অফিসিয়াল API এসব সুবিধা দেয় না এবং এখানে সেগুলো নকল করা হয় না।",
    ],
  },
  { heading: "পরিবর্তন", paragraphs: ["অপারেটর এই নীতি হালনাগাদ করতে পারেন; পেজের উপরের তারিখ বর্তমান সংস্করণ দেখায়।"] },
];

const termsEn: LegalSection[] = [
  {
    heading: "The service",
    paragraphs: [
      "Anoneye helps you validate public profile links, request public profile and media metadata through official social-platform APIs when the deployment is configured, store timestamped observations for profiles you track, and read or export reports.",
      "Anoneye is not affiliated with, endorsed by, or sponsored by Meta, Instagram or Facebook.",
    ],
  },
  {
    heading: "Accounts",
    bullets: [
      "You must provide a valid email address and keep your credentials secure.",
      "You are responsible for activity performed with your account.",
      "One person or team should not use another user's session or credentials.",
    ],
  },
  {
    heading: "Acceptable use",
    bullets: [
      "Do not use Anoneye to scrape, crawl, or bulk-collect platform content outside the official APIs.",
      "Do not attempt to access private, age-gated, or otherwise restricted content, or to bypass authentication.",
      "Do not upload or reuse stolen cookies, tokens or credentials.",
      "Do not use the service to harass, stalk, or build profiles of individuals for harmful purposes.",
      "Do not resell provider data in breach of the platform's terms.",
    ],
  },
  {
    heading: "Data accuracy",
    paragraphs: [
      "Metrics are observations returned by the platform at a point in time. They may be delayed, incomplete or unavailable. Charts show gaps where no observation exists; they do not estimate missing values.",
      "Where Anoneye states that a capability is unavailable, that is deliberate: the official API does not offer it.",
    ],
  },
  {
    heading: "Third-party platforms",
    paragraphs: [
      "Your use of Meta's APIs remains subject to Meta's terms, including its platform terms and automated data collection terms. Anoneye cannot grant rights that Meta does not grant.",
    ],
  },
  {
    heading: "Availability and changes",
    paragraphs: [
      "The operator may change, suspend or discontinue features. Provider APIs can change without notice; Anoneye will show an honest error rather than inventing data.",
    ],
  },
  {
    heading: "Liability",
    paragraphs: [
      "The application is provided as a starter project without warranties. To the extent permitted by law, the operator is not liable for indirect or consequential loss arising from its use. This section must be reviewed by a qualified lawyer before production use.",
    ],
  },
  {
    heading: "Termination",
    paragraphs: ["You may delete your account at any time from Settings. The operator may suspend accounts that breach these terms or the platform terms."],
  },
  { heading: "Contact", paragraphs: ["Use the contact page for questions about these terms."] },
];

const termsBn: LegalSection[] = [
  {
    heading: "সেবা",
    paragraphs: [
      "Anoneye আপনাকে পাবলিক প্রোফাইল লিংক যাচাই করতে, ডিপ্লয়মেন্ট কনফিগার থাকলে অফিসিয়াল সোশ্যাল-প্ল্যাটফর্ম API দিয়ে পাবলিক প্রোফাইল ও মিডিয়া মেটাডেটা আনতে, আপনার ট্র্যাক করা প্রোফাইলের সময়-চিহ্নিত পর্যবেক্ষণ রাখতে এবং রিপোর্ট পড়তে বা এক্সপোর্ট করতে সাহায্য করে।",
      "Anoneye Meta, Instagram বা Facebook-এর সাথে সম্পর্কিত, অনুমোদিত বা স্পনসরকৃত নয়।",
    ],
  },
  {
    heading: "অ্যাকাউন্ট",
    bullets: [
      "আপনাকে একটি বৈধ ইমেইল দিতে হবে এবং নিজের ক্রেডেনশিয়াল নিরাপদ রাখতে হবে।",
      "আপনার অ্যাকাউন্ট দিয়ে করা কার্যকলাপের দায়িত্ব আপনার।",
      "অন্য ব্যবহারকারীর সেশন বা ক্রেডেনশিয়াল ব্যবহার করা যাবে না।",
    ],
  },
  {
    heading: "গ্রহণযোগ্য ব্যবহার",
    bullets: [
      "অফিসিয়াল API-এর বাইরে প্ল্যাটফর্মের কনটেন্ট স্ক্র্যাপ, ক্রল বা বাল্ক-সংগ্রহ করতে Anoneye ব্যবহার করবেন না।",
      "প্রাইভেট, বয়স-সীমাবদ্ধ বা অন্যভাবে নিষিদ্ধ কনটেন্টে প্রবেশের চেষ্টা বা authentication বাইপাস করবেন না।",
      "চুরি করা কুকি, টোকেন বা ক্রেডেনশিয়াল আপলোড বা পুনর্ব্যবহার করবেন না।",
      "হয়রানি, স্টকিং বা ক্ষতিকর উদ্দেশ্যে ব্যক্তির প্রোফাইল তৈরিতে সেবা ব্যবহার করবেন না।",
      "প্ল্যাটফর্মের শর্ত লঙ্ঘন করে প্রোভাইডার ডেটা পুনর্বিক্রি করবেন না।",
    ],
  },
  {
    heading: "ডেটার নির্ভুলতা",
    paragraphs: [
      "মেট্রিক হলো নির্দিষ্ট সময়ে প্ল্যাটফর্মের ফেরত দেওয়া পর্যবেক্ষণ। সেগুলো বিলম্বিত, অসম্পূর্ণ বা অনুপলব্ধ হতে পারে। যেখানে পর্যবেক্ষণ নেই চার্ট সেখানে ফাঁক দেখায়; অনুপস্থিত মান অনুমান করা হয় না।",
      "যেখানে Anoneye বলে কোনো সুবিধা পাওয়া যায় না, সেটি ইচ্ছাকৃত: অফিসিয়াল API তা দেয় না।",
    ],
  },
  {
    heading: "তৃতীয় পক্ষের প্ল্যাটফর্ম",
    paragraphs: [
      "Meta-র API ব্যবহারে Meta-র শর্ত, যার মধ্যে platform terms ও automated data collection terms রয়েছে, প্রযোজ্য থাকে। Meta যে অধিকার দেয় না, Anoneye তা দিতে পারে না।",
    ],
  },
  {
    heading: "উপলব্ধতা ও পরিবর্তন",
    paragraphs: [
      "অপারেটর ফিচার বদলাতে, স্থগিত করতে বা বন্ধ করতে পারেন। প্রোভাইডার API নোটিশ ছাড়াই বদলাতে পারে; Anoneye বানানো ডেটার বদলে সৎ ত্রুটি দেখাবে।",
    ],
  },
  {
    heading: "দায়",
    paragraphs: [
      "অ্যাপ্লিকেশনটি ওয়ারেন্টি ছাড়া স্টার্টার প্রকল্প হিসেবে প্রদান করা হয়। আইনে অনুমোদিত পরিসরে, ব্যবহার থেকে উদ্ভূত পরোক্ষ বা আনুষঙ্গিক ক্ষতির জন্য অপারেটর দায়ী নন। প্রোডাকশনে ব্যবহারের আগে যোগ্য আইনজীবীকে এই অংশ পর্যালোচনা করতে হবে।",
    ],
  },
  {
    heading: "সমাপ্তি",
    paragraphs: ["সেটিংস থেকে যেকোনো সময় অ্যাকাউন্ট মুছতে পারেন। এই শর্ত বা প্ল্যাটফর্মের শর্ত লঙ্ঘনকারী অ্যাকাউন্ট অপারেটর স্থগিত করতে পারেন।"],
  },
  { heading: "যোগাযোগ", paragraphs: ["এই শর্ত নিয়ে প্রশ্ন থাকলে যোগাযোগ পেজ ব্যবহার করুন।"] },
];

export const LEGAL_CONTENT = {
  privacy: { bn: privacyBn, en: privacyEn },
  terms: { bn: termsBn, en: termsEn },
} satisfies Record<"privacy" | "terms", Record<Locale, LegalSection[]>>;
