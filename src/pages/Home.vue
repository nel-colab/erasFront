<script setup>
// ── Latest Set Banner ─────────────────────────────────────────────
// Replace image with the actual set image URL when available
const latestSet = {
  name: 'Era of Dragons',
  subtitle: 'The fourth expansion — 150 new cards available now',
  image: null,           // replace with real image URL
  route: '/Editions',
}

// ── Top Decks ─────────────────────────────────────────────────────
// Replace with data from your decks service
const topDecks = {
  eventName: 'Regional Buenos Aires 2025',
  eventUrl: '#',
  decks: [
    {
      rank: 1,
      name: 'Dragon Rush',
      description: 'Aggressive dragon synergy deck focusing on early game pressure and overwhelming the opponent.',
      cardImage: null,   // replace with representative card image URL
      decklistUrl: '#',
    },
    {
      rank: 2,
      name: 'Control Mage',
      description: 'Slow control strategy that wins through card advantage and late-game dominance.',
      cardImage: null,
      decklistUrl: '#',
    },
    {
      rank: 3,
      name: 'Midrange Beast',
      description: 'Flexible midrange deck with powerful beast synergies adaptable to any matchup.',
      cardImage: null,
      decklistUrl: '#',
    },
    {
      rank: 4,
      name: 'Combo Rogue',
      description: 'Combo-oriented deck that searches for the perfect hand setup to win in one turn.',
      cardImage: null,
      decklistUrl: '#',
    },
  ],
}

// ── Newsletter ────────────────────────────────────────────────────
// Replace with data from your newsletter service
const newsItems = [
  {
    date: 'Mar 5, 2026',
    title: 'Era of Dragons Launches Next Month',
    excerpt: 'The fourth expansion brings 150 new cards and introduces the Dragon archetype to competitive play.',
    url: '#',
  },
  {
    date: 'Feb 28, 2026',
    title: 'Regional Championship Results — Buenos Aires',
    excerpt: 'Dragon Rush dominates the Buenos Aires Regional with a 40% top 8 share. Full results inside.',
    url: '#',
  },
  {
    date: 'Feb 15, 2026',
    title: 'Balance Patch 1.4 Notes',
    excerpt: 'Several meta adjustments including nerfs to Control Mage and quality-of-life buffs to Combo Rogue.',
    url: '#',
  },
]
</script>

<template>
  <!-- ── Latest Set Banner ─────────────────────────────────── -->
  <section
    class="set-banner"
    :style="latestSet.image ? `background-image: url(${latestSet.image})` : ''"
  >
    <div class="set-banner__overlay">
      <p class="set-banner__eyebrow">Latest Set</p>
      <h2 class="set-banner__title">{{ latestSet.name }}</h2>
      <p class="set-banner__sub">{{ latestSet.subtitle }}</p>
      <router-link :to="latestSet.route" class="btn-nav-primary">Explore Cards</router-link>
    </div>
  </section>

  <!-- ── Top Decks ─────────────────────────────────────────── -->
  <section class="home-section">
    <div class="section-header">
      <h2 class="section-title">
        Top Decks:
        <span class="section-title__accent">{{ topDecks.eventName }}</span>
      </h2>
      <a :href="topDecks.eventUrl" class="section-link">See event results &rarr;</a>
    </div>

    <div class="deck-list">
      <a
        v-for="deck in topDecks.decks"
        :key="deck.rank"
        :href="deck.decklistUrl"
        class="deck-card"
      >
        <div class="deck-rank">#{{ deck.rank }}</div>

        <div class="deck-img">
          <img v-if="deck.cardImage" :src="deck.cardImage" :alt="deck.name" />
          <div v-else class="deck-img-placeholder">
            <i class="bi bi-card-image"></i>
          </div>
        </div>

        <div class="deck-info">
          <h3 class="deck-name">{{ deck.name }}</h3>
          <p class="deck-desc">{{ deck.description }}</p>
        </div>

        <span class="deck-link">View decklist &rarr;</span>
      </a>
    </div>
  </section>

  <!-- ── Newsletter ────────────────────────────────────────── -->
  <section class="home-section">
    <div class="section-header">
      <h2 class="section-title">Latest News</h2>
      <a href="#" class="section-link">View all &rarr;</a>
    </div>

    <div class="news-grid">
      <a v-for="item in newsItems" :key="item.title" :href="item.url" class="news-card">
        <span class="news-date">{{ item.date }}</span>
        <h3 class="news-title">{{ item.title }}</h3>
        <p class="news-excerpt">{{ item.excerpt }}</p>
        <span class="section-link">Read more &rarr;</span>
      </a>
    </div>
  </section>
</template>

<style scoped>
/* ─── Shared section layout ──────────────────────────────────── */
.home-section {
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--hr-color);
  padding-bottom: 0.6rem;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.section-title__accent {
  font-weight: 500;
  color: var(--text-secondary);
}

.section-link {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
}
.section-link:hover {
  color: var(--text-primary);
}

/* ─── Latest Set Banner ──────────────────────────────────────── */
.set-banner {
  width: 100%;
  min-height: 260px;
  border-radius: 10px;
  background-color: #1a1a1a;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  margin-bottom: 2.5rem;
  overflow: hidden;
  position: relative;
}

.set-banner__overlay {
  width: 100%;
  padding: 2.5rem 2.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.set-banner__eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.6);
  margin: 0;
}

.set-banner__title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  line-height: 1.1;
}

.set-banner__sub {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.75);
  margin: 0 0 0.5rem;
}

/* ─── Deck list ──────────────────────────────────────────────── */
.deck-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.deck-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
}
.deck-card:hover {
  border-color: var(--text-muted);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.deck-rank {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-muted);
  min-width: 2.5rem;
  text-align: center;
}

.deck-img {
  flex-shrink: 0;
  width: 56px;
  height: 78px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--input-bg);
  border: 1px solid var(--card-border);
}
.deck-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.deck-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 1.4rem;
}

.deck-info {
  flex: 1;
  min-width: 0;
}
.deck-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.3rem;
}
.deck-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.deck-link {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
.deck-card:hover .deck-link {
  color: var(--text-primary);
}

/* ─── News grid ──────────────────────────────────────────────── */
.news-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.news-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 1.25rem;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.news-card:hover {
  border-color: var(--text-muted);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.news-date {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.news-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}
.news-excerpt {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
  flex: 1;
  line-height: 1.5;
}

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 768px) {
  .news-grid {
    grid-template-columns: 1fr;
  }
  .set-banner {
    min-height: 200px;
  }
  .set-banner__title {
    font-size: 1.6rem;
  }
  .deck-desc {
    display: none;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .news-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
