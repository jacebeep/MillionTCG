# MillionTCG Reddit Bot

Automated Reddit marketing bot for [MillionTCG](https://milliontcg.com).  
Monitors TCG subreddits for sell/buy-intent keywords and replies with value-first messages. Also posts weekly marketplace updates to permitted subreddits.

---

## Features

- 🔍 **Keyword monitoring** — streams new posts + comments from 10 TCG subreddits
- 🎯 **Intent classifier** — detects sell intent, buy intent, or general TCG marketplace talk
- 💬 **Smart replies** — randomly picks from multiple templates to avoid repetition
- ⏱️ **Per-subreddit cooldown** — won't spam a single subreddit (default: 1 hour cooldown)
- 📅 **Weekly poster** — posts a formatted marketplace update every Monday at 12:00 UTC
- 💾 **Persistent state** — tracks replied IDs across restarts (stored in `data/`)
- 🟡 **Dry-run mode** — logs everything but never actually posts (safe for testing)
- 🔄 **Auto-reconnect** — handles Reddit API errors and reconnects automatically

---

## Setup

### Step 1 — Python

Make sure you have **Python 3.10+** installed.

```bash
python --version
```

### Step 2 — Install Dependencies

```bash
cd reddit_bot
pip install -r requirements.txt
```

### Step 3 — Get Reddit API Credentials

1. Go to https://www.reddit.com/prefs/apps
2. Click **"Create App"** (or "Create Another App")
3. Fill in:
   - **Name**: `MillionTCGBot`
   - **App type**: `script`
   - **Redirect URI**: `http://localhost:8080`
4. Click **Create app**
5. Copy:
   - **client_id** → the string under your app name (looks like `abc123xyz`)
   - **client_secret** → labeled "secret"

### Step 4 — Configure .env

```bash
copy .env.example .env
```

Open `.env` and fill in your Reddit credentials:

```env
REDDIT_CLIENT_ID=abc123xyz
REDDIT_CLIENT_SECRET=your_secret_here
REDDIT_USERNAME=YourRedditUsername
REDDIT_PASSWORD=YourRedditPassword
REDDIT_USER_AGENT=MillionTCGBot/1.0 (by /u/YourRedditUsername)
```

### Step 5 — Test in Dry Run Mode

`DRY_RUN = True` is set by default in `config.py` — the bot will log everything but **never actually post**.

```bash
python bot.py
```

You'll see output like:
```
2026-08-09 20:41:00 [INFO] ✅ Authenticated as: u/YourUsername
2026-08-09 20:41:00 [INFO] ===========================
2026-08-09 20:41:00 [INFO]   MillionTCG Reddit Bot
2026-08-09 20:41:00 [INFO]   Mode: 🟡 DRY RUN (no posts sent)
...
[DRY RUN] Would reply to abc123 in r/pokemoncards
[DRY RUN] Intent  : sell
[DRY RUN] Reply   : Hey! If you're looking to sell...
```

### Step 6 — Go Live

When you're satisfied with the dry-run output:

1. Open `config.py`
2. Change `DRY_RUN = True` → `DRY_RUN = False`
3. Re-run:

```bash
python bot.py
```

---

## Configuration (`config.py`)

| Setting | Default | Description |
|---|---|---|
| `DRY_RUN` | `True` | Set to `False` to enable live posting |
| `TARGET_SUBREDDITS` | 10 subreddits | Subreddits to monitor for keywords |
| `WEEKLY_POST_SUBREDDITS` | `["tradingcardcommunity"]` | Subreddits to post weekly updates in |
| `SELL_KEYWORDS` | 20 phrases | Triggers "sell" intent reply |
| `BUY_KEYWORDS` | 10 phrases | Triggers "buy" intent reply |
| `GENERAL_KEYWORDS` | 9 phrases | Triggers general reply |
| `REPLY_COOLDOWN_PER_SUBREDDIT` | `3600` seconds | Min time between replies to same subreddit |
| `WEEKLY_POST_DAY` | `"monday"` | Day of the week for weekly posts |
| `WEEKLY_POST_HOUR` | `"12:00"` | UTC time for weekly posts |

---

## File Structure

```
reddit_bot/
├── bot.py                 ← Main bot (run this)
├── config.py              ← All settings + templates
├── requirements.txt       ← Python dependencies
├── .env.example           ← Copy to .env, add your credentials
├── .env                   ← Your actual credentials (never commit this)
├── data/
│   ├── seen_ids.json      ← Replied post/comment IDs (auto-created)
│   ├── cooldowns.json     ← Subreddit cooldown timestamps (auto-created)
│   └── last_weekly_post.json ← Weekly post timestamps (auto-created)
└── logs/
    └── bot.log            ← Full activity log (auto-created)
```

---

## Running 24/7

### Option A — Keep a terminal open
```bash
python bot.py
```

### Option B — Background process (Windows)
```bash
start /B python bot.py > logs\output.log 2>&1
```

### Option C — Task Scheduler (Windows, recommended for 24/7)
1. Open **Task Scheduler**
2. Create a new task: `python C:\path\to\reddit_bot\bot.py`
3. Set trigger: **At startup** or **Daily**

### Option D — Deploy to a VPS / Cloud VM
Upload the `reddit_bot/` folder to any server (e.g. DigitalOcean $4/mo droplet) and run:
```bash
nohup python bot.py &
```

---

## ⚠️ Reddit Rules — Important

- **Always include bot disclosure** — every reply template already ends with *"I'm a bot promoting MillionTCG."*
- **Don't add subreddits to `WEEKLY_POST_SUBREDDITS`** without manually reading that subreddit's rules first.
- **Avoid r/pokemoncards and r/pkmntcg for direct promotional posts** — they have strict self-promo rules. Comments only.
- Reddit may shadowban bots that reply too aggressively. The cooldown system prevents this.

---

## Customizing Reply Templates

Edit `config.py` → `SELL_REPLY_TEMPLATES`, `BUY_REPLY_TEMPLATES`, `GENERAL_REPLY_TEMPLATES`.

You can add as many templates as you want — the bot randomly picks one per reply to avoid looking robotic.
