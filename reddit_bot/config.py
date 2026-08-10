# config.py — MillionTCG Reddit Bot Configuration
# ──────────────────────────────────────────────────────────────────────────────
# Toggle DRY_RUN = True to test without posting anything to Reddit.
# Set to False only when you're ready to go live.
# ──────────────────────────────────────────────────────────────────────────────

DRY_RUN = True  # ← flip to False when ready to go live

# ── Target Subreddits (monitored for keywords) ────────────────────────────────
TARGET_SUBREDDITS = [
    "pkmntcg",
    "pokemoncards",
    "PokemonTCG",
    "mtgfinance",
    "magicTCG",
    "yugioh",
    "tradingcardcommunity",
    "Flipping",
    "PokemonCardDeals",
    "CardMarket",
]

# ── Subreddits where we're allowed to post weekly updates ─────────────────────
# Verify each subreddit's rules before adding here.
# Start with permissive ones; do NOT add heavily-moderated ones like r/pokemoncards
WEEKLY_POST_SUBREDDITS = [
    "tradingcardcommunity",  # generally allows marketplace posts
]

# ── Sell-Intent Keywords ──────────────────────────────────────────────────────
SELL_KEYWORDS = [
    "where to sell",
    "want to sell",
    "selling my collection",
    "selling my cards",
    "how do i sell",
    "best place to sell",
    "lts",               # looking to sell
    "looking to sell",
    "need to sell",
    "getting rid of my cards",
    "offloading my",
    "where can i sell",
    "what site to sell",
    "ebay alternative",
    "tcgplayer alternative",
    "mercari alternative",
    "marketplace for cards",
    "sell my pokemon",
    "sell my mtg",
    "sell my yugioh",
    "selling singles",
    "selling sealed",
    "unloading collection",
]

# ── Buy-Intent Keywords ───────────────────────────────────────────────────────
BUY_KEYWORDS = [
    "lf seller",
    "looking for seller",
    "where to buy",
    "best place to buy",
    "where can i find",
    "buying cards online",
    "shopping for cards",
    "buy pokemon cards",
    "buy mtg cards",
    "buy yugioh cards",
    "buy sealed",
]

# ── General TCG Marketplace Keywords ─────────────────────────────────────────
GENERAL_KEYWORDS = [
    "tcg marketplace",
    "card marketplace",
    "sell cards online",
    "pokemon card market",
    "pokemon marketplace",
    "mtg marketplace",
    "yugioh marketplace",
    "trading card site",
    "trading card platform",
]

# ── Cooldown: minimum seconds between replies to the SAME subreddit ───────────
# 3600 = 1 hour. Prevents the bot from spamming a single subreddit.
REPLY_COOLDOWN_PER_SUBREDDIT = 3600

# ── Minimum post/comment score before we reply ────────────────────────────────
# Avoid replying to brand new spam posts with 0 engagement
MIN_POST_SCORE = 0  # 0 means reply to everything including brand-new posts

# ── Weekly Post Schedule ──────────────────────────────────────────────────────
WEEKLY_POST_DAY = "monday"
WEEKLY_POST_HOUR = "12:00"  # UTC time

# ── Reply Templates (randomly selected from each list) ───────────────────────

SELL_REPLY_TEMPLATES = [
    """\
Hey! If you're looking to sell your TCG cards, check out **[MillionTCG](https://milliontcg.com/sell.html)** — it's a marketplace built specifically for trading card sellers.

**Why it stands out:**
- 🪙 Only **10% platform fee** — you keep 90% of every sale
- 🔒 **Escrow protection** — payment is held until the buyer confirms delivery
- 💸 Payouts via PayPal, Venmo, Zelle, or bank transfer
- 📦 Works for singles, sealed product, bundles, and accessories

**→ List your cards here:** https://milliontcg.com/sell.html

Good luck with the sale! 🎴

*I'm a bot — [learn more](https://milliontcg.com/how-it-works.html) about how MillionTCG works.*\
""",
    """\
If you haven't tried **MillionTCG** yet, worth a look for selling:

🔗 https://milliontcg.com/sell.html

- No crazy fees — 10% cut, you keep **90%**
- Escrow system protects both you and the buyer
- List Pokémon, MTG, Yu-Gi-Oh, and more in minutes

Their [How It Works](https://milliontcg.com/how-it-works.html) page breaks down the full flow if you want to check it before diving in.

*I'm a bot promoting MillionTCG.*\
""",
    """\
Have you looked at **MillionTCG**? It's a TCG-focused marketplace with pretty seller-friendly terms:

✅ 10% fee (lower than most alternatives)
✅ Escrow holds payment until delivery confirmed
✅ PayPal / Venmo / Zelle / bank payouts
✅ Free to list

→ https://milliontcg.com/sell.html

*Bot disclosure: I promote MillionTCG.*\
""",
]

BUY_REPLY_TEMPLATES = [
    """\
You might find what you're looking for on **[MillionTCG](https://milliontcg.com/shop.html)**!

It's a TCG marketplace with singles, sealed product, and bundles. Orders are escrow-protected so you're covered if something goes wrong.

**→ Browse the shop:** https://milliontcg.com/shop.html

*I'm a bot — this is MillionTCG, a TCG marketplace.*\
""",
    """\
Worth checking out **MillionTCG's shop** → https://milliontcg.com/shop.html

They carry Pokémon, MTG, and Yu-Gi-Oh. Buyer protection through escrow, so payments are held until you confirm delivery.

*I'm a bot promoting MillionTCG.*\
""",
]

GENERAL_REPLY_TEMPLATES = [
    """\
Speaking of TCG marketplaces — **[MillionTCG](https://milliontcg.com)** is one worth knowing about.

- Buy & sell Pokémon, MTG, Yu-Gi-Oh cards
- 10% seller fee — 90% goes to you
- Escrow-protected transactions for buyers and sellers
- List in minutes: https://milliontcg.com/sell.html

*I'm a bot promoting MillionTCG.*\
""",
]


# ── Weekly Post Template ──────────────────────────────────────────────────────
def WEEKLY_POST_TEMPLATE(week_str: str) -> tuple:
    """Returns (title, body) for a weekly promotional post."""
    title = f"📊 MillionTCG Marketplace Update — {week_str}"
    body = f"""\
Hey everyone! 👋

Dropping in with this week's update from **[MillionTCG](https://milliontcg.com)** — a TCG marketplace built for the community.

---

## 🔥 Latest Listings
Browse the newest singles, sealed product, and bundles:
**→ [Shop Now](https://milliontcg.com/shop.html)**

---

## 💰 Sellers: List Your Cards for Free

If you've got cards sitting around, list them in minutes:

- **→ [Start Selling](https://milliontcg.com/sell.html)**
- Only 10% platform fee — you keep **90%** of every sale
- Escrow holds payment until buyer confirms delivery
- Payouts: PayPal · Venmo · Zelle · Bank Transfer

---

## ❓ New to MillionTCG?
→ [How It Works](https://milliontcg.com/how-it-works.html) — full breakdown of fees, escrow, and payouts

---

*Questions? Drop a comment below or reach us at the [Contact page](https://milliontcg.com/contact-us.html). Happy trading! 🎴*
"""
    return title, body
