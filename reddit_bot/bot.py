"""
MillionTCG Reddit Marketing Bot
================================
Monitors TCG subreddits for sell/buy intent keywords and replies with
value-first messages that link to MillionTCG. Also schedules weekly
promotional posts to permitted subreddits.

Usage:
  pip install -r requirements.txt
  cp .env.example .env       # fill in your Reddit API credentials
  python bot.py              # runs in DRY_RUN mode by default (config.py)
"""

import praw
import prawcore
import time
import json
import os
import random
import threading
import signal
import sys
import logging
import schedule
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

from config import (
    DRY_RUN,
    TARGET_SUBREDDITS,
    WEEKLY_POST_SUBREDDITS,
    SELL_KEYWORDS,
    BUY_KEYWORDS,
    GENERAL_KEYWORDS,
    SELL_REPLY_TEMPLATES,
    BUY_REPLY_TEMPLATES,
    GENERAL_REPLY_TEMPLATES,
    REPLY_COOLDOWN_PER_SUBREDDIT,
    WEEKLY_POST_DAY,
    WEEKLY_POST_HOUR,
    WEEKLY_POST_TEMPLATE,
)

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "bot.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("MillionTCGBot")

# ─────────────────────────────────────────────────────────────────────────────
# Reddit Client
# ─────────────────────────────────────────────────────────────────────────────

def create_reddit_client() -> praw.Reddit:
    client = praw.Reddit(
        client_id=os.getenv("REDDIT_CLIENT_ID"),
        client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
        username=os.getenv("REDDIT_USERNAME"),
        password=os.getenv("REDDIT_PASSWORD"),
        user_agent=os.getenv(
            "REDDIT_USER_AGENT",
            "MillionTCGBot/1.0 (by /u/milliontcg)"
        ),
    )
    try:
        me = client.user.me()
        log.info(f"✅ Authenticated as: u/{me.name}")
    except Exception as e:
        log.error(f"❌ Reddit auth failed: {e}")
        log.error("   Check your .env credentials and try again.")
        sys.exit(1)
    return client

reddit = create_reddit_client()

# ─────────────────────────────────────────────────────────────────────────────
# State Persistence  (data/ directory)
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

SEEN_FILE        = DATA_DIR / "seen_ids.json"
COOLDOWN_FILE    = DATA_DIR / "cooldowns.json"
WEEKLY_POST_FILE = DATA_DIR / "last_weekly_post.json"

state_lock = threading.Lock()


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _save_json(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# seen_ids — set of Reddit post/comment IDs we've already replied to
seen_ids: set = set(_load_json(SEEN_FILE, []))

# cooldowns — {subreddit: ISO timestamp of last reply sent}
cooldowns: dict = _load_json(COOLDOWN_FILE, {})

# last_weekly_post — {subreddit: ISO timestamp of last weekly post}
last_weekly_post: dict = _load_json(WEEKLY_POST_FILE, {})


def is_seen(item_id: str) -> bool:
    with state_lock:
        return item_id in seen_ids


def mark_seen(item_id: str):
    with state_lock:
        seen_ids.add(item_id)
        # Cap to 20 000 entries to prevent unbounded file growth
        if len(seen_ids) > 20_000:
            overflow = list(seen_ids)[:-18_000]
            for eid in overflow:
                seen_ids.discard(eid)
        _save_json(SEEN_FILE, list(seen_ids))


def is_on_cooldown(subreddit: str) -> bool:
    with state_lock:
        if subreddit not in cooldowns:
            return False
        last = datetime.fromisoformat(cooldowns[subreddit])
        return datetime.utcnow() - last < timedelta(seconds=REPLY_COOLDOWN_PER_SUBREDDIT)


def set_cooldown(subreddit: str):
    with state_lock:
        cooldowns[subreddit] = datetime.utcnow().isoformat()
        _save_json(COOLDOWN_FILE, cooldowns)


def save_all_state():
    """Persist all in-memory state to disk."""
    with state_lock:
        _save_json(SEEN_FILE, list(seen_ids))
        _save_json(COOLDOWN_FILE, cooldowns)
        _save_json(WEEKLY_POST_FILE, last_weekly_post)

# ─────────────────────────────────────────────────────────────────────────────
# Keyword Intent Classifier
# ─────────────────────────────────────────────────────────────────────────────

def classify_intent(text: str) -> str | None:
    """
    Returns 'sell', 'buy', 'general', or None if no keyword matches.
    Sell intent takes priority over buy intent.
    """
    t = text.lower()
    if any(kw in t for kw in SELL_KEYWORDS):
        return "sell"
    if any(kw in t for kw in BUY_KEYWORDS):
        return "buy"
    if any(kw in t for kw in GENERAL_KEYWORDS):
        return "general"
    return None


def pick_reply(intent: str) -> str:
    """Randomly pick a reply template for the given intent."""
    templates = {
        "sell":    SELL_REPLY_TEMPLATES,
        "buy":     BUY_REPLY_TEMPLATES,
        "general": GENERAL_REPLY_TEMPLATES,
    }
    return random.choice(templates.get(intent, GENERAL_REPLY_TEMPLATES))

# ─────────────────────────────────────────────────────────────────────────────
# Core Reply Logic
# ─────────────────────────────────────────────────────────────────────────────

def handle_item(item, subreddit_name: str, text: str):
    """
    Given a PRAW Submission or Comment, decide whether to reply and do so.
    """
    item_id = item.id

    # Skip already-handled items
    if is_seen(item_id):
        return

    # Skip if subreddit is on cooldown
    if is_on_cooldown(subreddit_name):
        log.debug(f"[COOLDOWN] r/{subreddit_name} — skipping {item_id}")
        return

    # Classify intent
    intent = classify_intent(text)
    if intent is None:
        return

    reply_body = pick_reply(intent)

    if DRY_RUN:
        log.info("━" * 60)
        log.info(f"[DRY RUN] Would reply to {item_id} in r/{subreddit_name}")
        log.info(f"[DRY RUN] Intent  : {intent}")
        log.info(f"[DRY RUN] Snippet : {text[:120].strip()!r}")
        log.info(f"[DRY RUN] Reply   :\n{reply_body}")
        mark_seen(item_id)
        return

    # Live mode: post the reply
    try:
        item.reply(reply_body)
        mark_seen(item_id)
        set_cooldown(subreddit_name)
        log.info(f"[REPLIED] {item_id} in r/{subreddit_name} (intent={intent})")
    except praw.exceptions.RedditAPIException as e:
        for sub_err in e.items:
            log.warning(f"[API ERR] {sub_err.error_type}: {sub_err.message}")
        mark_seen(item_id)  # mark as seen so we don't retry a banned post
    except Exception as e:
        log.error(f"[ERROR] Failed to reply to {item_id}: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Stream Monitors
# ─────────────────────────────────────────────────────────────────────────────

def monitor_submissions():
    """Stream new submissions from TARGET_SUBREDDITS and handle keyword matches."""
    subreddit_str = "+".join(TARGET_SUBREDDITS)
    log.info(f"[STREAM] Submission monitor started → r/{subreddit_str}")

    while True:
        try:
            multi = reddit.subreddit(subreddit_str)
            for submission in multi.stream.submissions(skip_existing=True, pause_after=None):
                if submission is None:
                    continue
                combined = f"{submission.title} {submission.selftext}"
                subreddit_name = submission.subreddit.display_name
                handle_item(submission, subreddit_name, combined)

        except prawcore.exceptions.ServerError as e:
            log.warning(f"[STREAM] Server error (submissions): {e} — retrying in 60s")
            time.sleep(60)
        except prawcore.exceptions.RequestException as e:
            log.warning(f"[STREAM] Request error (submissions): {e} — retrying in 30s")
            time.sleep(30)
        except Exception as e:
            log.error(f"[STREAM] Unexpected error (submissions): {e} — retrying in 30s")
            time.sleep(30)


def monitor_comments():
    """Stream new comments from TARGET_SUBREDDITS and handle keyword matches."""
    subreddit_str = "+".join(TARGET_SUBREDDITS)
    log.info(f"[STREAM] Comment monitor started → r/{subreddit_str}")

    while True:
        try:
            multi = reddit.subreddit(subreddit_str)
            for comment in multi.stream.comments(skip_existing=True, pause_after=None):
                if comment is None:
                    continue
                subreddit_name = comment.subreddit.display_name
                handle_item(comment, subreddit_name, comment.body)

        except prawcore.exceptions.ServerError as e:
            log.warning(f"[STREAM] Server error (comments): {e} — retrying in 60s")
            time.sleep(60)
        except prawcore.exceptions.RequestException as e:
            log.warning(f"[STREAM] Request error (comments): {e} — retrying in 30s")
            time.sleep(30)
        except Exception as e:
            log.error(f"[STREAM] Unexpected error (comments): {e} — retrying in 30s")
            time.sleep(30)

# ─────────────────────────────────────────────────────────────────────────────
# Weekly Post Scheduler
# ─────────────────────────────────────────────────────────────────────────────

def post_weekly_update():
    """Post a weekly marketplace update to WEEKLY_POST_SUBREDDITS."""
    now = datetime.utcnow()
    week_str = now.strftime("Week of %B %d, %Y")
    log.info(f"[WEEKLY] Running weekly post job — {week_str}")

    for sub_name in WEEKLY_POST_SUBREDDITS:
        # Guard: don't re-post if we already posted in the last 6 days
        with state_lock:
            last_ts = last_weekly_post.get(sub_name)
            if last_ts:
                last_dt = datetime.fromisoformat(last_ts)
                if now - last_dt < timedelta(days=6):
                    log.info(f"[WEEKLY] Already posted to r/{sub_name} this week — skipping")
                    continue

        title, body = WEEKLY_POST_TEMPLATE(week_str)

        if DRY_RUN:
            log.info(f"[DRY RUN] Would post weekly update to r/{sub_name}")
            log.info(f"[DRY RUN] Title: {title}")
            log.info(f"[DRY RUN] Body :\n{body}")
            with state_lock:
                last_weekly_post[sub_name] = now.isoformat()
                _save_json(WEEKLY_POST_FILE, last_weekly_post)
            continue

        try:
            sub = reddit.subreddit(sub_name)
            sub.submit(title=title, selftext=body)
            with state_lock:
                last_weekly_post[sub_name] = now.isoformat()
                _save_json(WEEKLY_POST_FILE, last_weekly_post)
            log.info(f"[WEEKLY] ✅ Posted to r/{sub_name}")
            time.sleep(10)  # pace between subreddit posts
        except praw.exceptions.RedditAPIException as e:
            for sub_err in e.items:
                log.warning(f"[WEEKLY] API error for r/{sub_name}: {sub_err.error_type}: {sub_err.message}")
        except Exception as e:
            log.error(f"[WEEKLY] Failed to post to r/{sub_name}: {e}")


def run_scheduler():
    """Background thread that runs the schedule loop."""
    # Schedule weekly posts — e.g. every Monday at 12:00 UTC
    getattr(schedule.every(), WEEKLY_POST_DAY).at(WEEKLY_POST_HOUR).do(post_weekly_update)
    log.info(f"[SCHEDULER] Weekly post scheduled: every {WEEKLY_POST_DAY} at {WEEKLY_POST_HOUR} UTC")

    while True:
        schedule.run_pending()
        time.sleep(60)

# ─────────────────────────────────────────────────────────────────────────────
# Graceful Shutdown
# ─────────────────────────────────────────────────────────────────────────────

def _shutdown(sig, frame):
    log.info("[SHUTDOWN] Signal received — saving state and exiting...")
    save_all_state()
    sys.exit(0)

signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)

# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("=" * 60)
    log.info("  MillionTCG Reddit Bot")
    log.info(f"  Mode    : {'🟡 DRY RUN (no posts sent)' if DRY_RUN else '🟢 LIVE'}")
    log.info(f"  Watching: {len(TARGET_SUBREDDITS)} subreddits")
    log.info(f"  Posting : {len(WEEKLY_POST_SUBREDDITS)} subreddits (weekly)")
    log.info("=" * 60)

    threads = [
        threading.Thread(
            target=monitor_submissions,
            daemon=True,
            name="SubmissionMonitor",
        ),
        threading.Thread(
            target=monitor_comments,
            daemon=True,
            name="CommentMonitor",
        ),
        threading.Thread(
            target=run_scheduler,
            daemon=True,
            name="Scheduler",
        ),
    ]

    for t in threads:
        t.start()
        log.info(f"[THREAD] Started → {t.name}")

    # Heartbeat — keeps main thread alive and logs status every 5 minutes
    while True:
        time.sleep(300)
        alive = sum(1 for t in threads if t.is_alive())
        log.info(
            f"[HEARTBEAT] Running | seen={len(seen_ids)} IDs tracked "
            f"| threads={alive}/{len(threads)} alive"
        )
