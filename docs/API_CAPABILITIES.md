# API capabilities — verified against Meta's documentation

Last verified: **2026-10-22**. Graph API version used by default: **v26.0**
(`META_GRAPH_VERSION`). Meta changes versions and permissions regularly —
re-check every source below before a production launch.

This document records what the official APIs actually allow, what Anoneye
therefore implements, and what it deliberately refuses to fake. Numbers in
brackets refer to the sources at the end.

---

## 1. Capability matrix

| Capability | Instagram | Facebook | Anoneye behaviour |
| --- | --- | --- | --- |
| Normalise a profile URL/username | Local | Local | Always available, no network call |
| Look up a public profile | Business Discovery | Pages API (Page Public Content Access or a Page role) | Implemented; requires Meta credentials + a connected account |
| Profile fields | username, name, biography, followers_count, media_count, website, profile picture | Page name, about, fan_count, followers_count, link, website, picture | Only fields the response actually contains are shown |
| Public media list | Business Discovery `media` edge | Page `/posts` | Implemented; no media files are stored |
| Media download | Not authorised for third-party content | Not authorised for third-party content | **Not implemented**; gallery links to the original post |
| Follower history | Not provided | Not provided | Built from Anoneye's own timestamped sync snapshots |
| Following count of the target | Not returned by Business Discovery | Not returned for Pages | Shown only when the API returns it |
| Other accounts' Stories | Not exposed | Not exposed | Unavailable; no workaround is attempted |
| Story viewers / profile visitors | Does not exist in any API | Does not exist in any API | Unavailable and stated as such |
| Private accounts | Not accessible | Not accessible | Rejected; no bypass |
| Hashtag search | Only with the separate hashtag-search product | — | Not implemented |

### Reasons for the "not implemented" rows

* **Media downloads.** Meta documents no authorised endpoint for downloading
  another account's photos or reels. The Instagram Platform Terms and the
  Automated Data Collection Terms restrict automated collection [6][7].
  Anoneye therefore shows a link to the original post and says so in the UI.
* **Stories and visitors.** These are not exposed by any official API. Tools
  that claim to provide them use scraping or steal sessions; Anoneye does
  neither.
* **Private accounts.** Business Discovery only returns Business/Creator
  accounts; no API grants access to consumer/private profiles [1][3].

---

## 2. Instagram — Business Discovery

**Endpoint used**

```
GET https://graph.facebook.com/v26.0/{IG_USER_ID}
    ?fields=business_discovery.username({TARGET_USERNAME}){
        id,username,name,biography,followers_count,media_count,
        profile_picture_url,website,
        media.limit(24){id,caption,media_type,media_url,thumbnail_url,
                        permalink,timestamp,like_count,comments_count}
      }
    &access_token={TOKEN}
```

* `IG_USER_ID` is **your own** Instagram professional account id — the account
  that owns the access token. The target is supplied as
  `business_discovery.username(...)` [1][2].
* Required permissions (Instagram API with Facebook Login):
  `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`.
  If the Page role is managed through Business Manager, `ads_read` or
  `ads_management` may also be required [1].
* Only **Business or Creator** target accounts are returned. Age-gated accounts
  are excluded. Consumer accounts are never available [1][3].
* `followers_count` and `media_count` are returned for the target; a following
  count is not part of the documented Business Discovery fields, so Anoneye
  leaves it blank instead of guessing.
* The nested `media` connection supports **cursor pagination only**
  (`before` / `after`). There are no `next`/`previous` links to follow; an
  integration must build them itself. Anoneye requests the first page (24
  items) and explicitly flags that older posts may exist [1].
* `media_url` may be omitted for videos/reels that contain licensed audio or
  have downloads disabled by the owner. Anoneye keeps the item, omits the
  image and explains why [1][2].
* Field expansion can return `profile_picture_url`, `name`, `website` and
  `biography`; these are also documented public `ig-user` fields [4].
* Caption is only returned through the Facebook-Login flavour of the API.
  Instagram-Login tokens do not get captions [2].

**Media semantics that the UI must not misrepresent** [2]

* `comments_count` excludes comments on album children and comments on the
  caption.
* `permalink` is not usable for album children.
* Repost/saved/share counters are top-level media only.
* Live media metadata is only readable while the account is broadcasting.
* Result ordering is not guaranteed; Anoneye sorts client-side by the
  timestamp that the API returned.

**Instagram public-content access** [5]
Meta's only credential-free-ish public-content product is hashtag search
(`/ig-hashtag-search`, `/ig-hashtag/{id}/recent_media`, `/top_media`) and it
requires App Review plus business verification. It does not expose arbitrary
profile data, so Anoneye does not use it.

---

## 3. Facebook — Pages API

**What Anoneye uses**

* Page identity and public metadata via the Page node (`id`, `name`, `about`,
  `fan_count`, `followers_count`, `link`, `website`, `picture`) [8].
* Page posts with `permalink_url`, `message`, `created_time`, reactions and
  comments summaries — this requires **Page Public Content Access (PPCA)** or
  a Page role [8][9].
* Page access tokens are obtained from `GET /me/accounts` (returns `id`,
  `name`, `access_token`, `tasks`). The token is a Page token, not the user's
  password [8][10].

**PPCA constraints** [9]

* PPCA must be requested through App Review and requires business
  verification. It permits reading Page feed/posts/comments **without**
  `pages_read_engagement`, for the allowed use “analyze and/or display posts
  and engagement on Pages”.
* Page Public Metadata Access is superseded by PPCA and cannot be requested at
  the same time.
* In development mode, an app can only read Pages whose admin holds a role in
  that app.
* All Page permissions/features are subject to App Review [8].

Anoneye requests `instagram_basic`, `instagram_manage_insights`,
`pages_read_engagement`, `pages_show_list`, `public_profile` during OAuth.
`pages_show_list` is required to enumerate `/me/accounts`; `public_profile`
is the minimum identity scope. A deployment that only reads Pages it manages
does not need Instagram scopes, but the single OAuth flow keeps the setup
simple and explicit.

---

## 4. Access tokens

| Token | How it is obtained | Use |
| --- | --- | --- |
| App access token | `GET /oauth/access_token?client_id=…&client_secret=…&grant_type=client_credentials` | Server-wide read-only calls when a user connection is not available |
| Long-lived user token | OAuth code exchange (`fb_exchange_token`) | Enumerating Pages, then obtaining Page tokens |
| Page access token | `GET /{user-id}/accounts` → `data[].access_token` | Reading a Page the user manages |

Tokens are **server-side only**. Anoneye encrypts them with AES-256-GCM
(`TOKEN_ENCRYPTION_KEY`) before writing to `connected_account_secrets`, and
never returns them to the browser or logs them. The encryption key must be a
32-byte base64 value and must not be committed [10].

---

## 5. Rate limits and error handling

* Graph API platform limits are per app: **200 × daily active users** calls per
  hour, plus per-user limits. `x-app-usage` reports `call_count`,
  `total_time` and `total_cputime` percentages; `x-business-use-case-usage`
  reports Business Use Case limits, which override platform limits [11].
* Throttling signals documented by Meta include error codes **4**, **17**,
  **32**, **613**, subcodes **2446079** and **1996**, and HTTP 429. When
  limited, stop calling instead of retrying immediately [11].
* OAuth/permission errors: code **190**/subcode 463 (expired/invalid token),
  code **10** (permission denied), codes **200–299** (missing permission),
  code **803** (object does not exist), code **100** (invalid parameter).
* Anoneye maps these to typed results (`unauthorized`, `rate-limited`,
  `not-found`, `unavailable`), never retries a 4xx automatically, uses bounded
  exponential backoff for retryable failures (max 3 retries), and shows a
  translated explanation instead of a raw Graph message.

---

## 6. Artificially unavailable features (documented decisions)

These are intentionally absent. Do not add them without new, explicit
authorisation from Meta:

1. Scraping web pages or private endpoints.
2. Using borrowed cookies/session tokens or asking for social passwords.
3. Reading private accounts or age-gated profiles.
4. Story viewing, story-viewer lists, or hiding who viewed a story.
5. Profile-visitor identity.
6. Downloading/rehosting third-party media or offering “HD” downloads.
7. Automated collection outside the terms of the platform [7].

---

## 7. Sources (all fetched 2026-10-22)

1. Instagram Platform — Business Discovery:
   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
2. Instagram Platform — IG Media reference:
   https://developers.facebook.com/docs/instagram-platform/reference/instagram-media
3. Instagram API with Facebook Login:
   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login
4. IG User reference:
   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user
5. Instagram public content access:
   https://developers.facebook.com/docs/features-reference/instagram-public-content-access
6. Instagram Platform Terms:
   https://developers.facebook.com/terms
7. Automated Data Collection Terms (effective 2024-10-07):
   https://developers.facebook.com/terms/dfc_platform_terms
8. Pages API overview:
   https://developers.facebook.com/docs/pages-api/overview
9. Page Public Content Access:
   https://developers.facebook.com/docs/features-reference/page-public-content-access
10. Access tokens:
    https://developers.facebook.com/docs/facebook-login/guides/access-tokens
11. Graph API rate limiting:
    https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
12. Supabase — server-side auth for Next.js:
    https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs

### What could not be verified here

No Meta app credentials were available in this environment. Therefore live
lookups, OAuth exchange, Business Discovery responses and PPCA behaviour are
**implemented against the documented contract but not verified end-to-end**.
The UI reports `not-configured` in that case and never substitutes demo data
for a real identifier.
