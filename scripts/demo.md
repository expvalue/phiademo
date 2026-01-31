## phiademo demo flow

1. **Landing view:** Highlight the hero and explain the social + semantic blending powered by Voyage + Chroma.
2. **Default feed:** With no query, point out that the feed is driven by recent friend purchases/views.
3. **Query test:** Search for **"serum"** and show that "Eden Skin Serum" ranks first with a High confidence badge.
4. **Another query:** Search for **"headphones"** and highlight audio products ranked first.
5. **Explainability:** Open “Why this?” on a card to show distance, semantic score, and top matched friend events.
6. **Debug endpoint:** Visit `/api/debug/vector?q=lamp` to show raw nearest neighbors and distances.
7. **Wrap up:** Emphasize confidence derived from vector distance thresholds and social re-ranking.
