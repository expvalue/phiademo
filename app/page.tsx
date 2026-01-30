"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CATEGORY_FILTERS = ["All", "Electronics", "Fashion", "Home", "Beauty", "Travel", "Fitness"];

type Recommendation = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: string;
  description: string;
  friendName: string;
  friendAvatar: string;
  eventType: "purchase" | "view";
  similarity: number | null;
  friendStrength: number;
  recency: number;
  eventWeight: number;
  score: number;
  reason: string;
  keywords: string[];
};

const FALLBACK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 1,
    name: "Nimbus Noise-Canceling Headphones",
    brand: "Aurora Audio",
    category: "Electronics",
    price: "249.00",
    description: "Cloud-soft ear cushions with adaptive noise canceling for deep focus.",
    friendName: "Ava Patel",
    friendAvatar: "https://i.pravatar.cc/100?img=1",
    eventType: "purchase",
    similarity: 0.84,
    friendStrength: 0.92,
    recency: 0.88,
    eventWeight: 1,
    score: 0.86,
    reason: "Because Ava Patel bought Nimbus Noise-Canceling Headphones",
    keywords: ["noise", "focus"]
  },
  {
    id: 2,
    name: "Atlas Carry-On",
    brand: "Atlas Travel",
    category: "Travel",
    price: "215.00",
    description: "Expandable carry-on with silent wheels and tech storage.",
    friendName: "Liam Ortega",
    friendAvatar: "https://i.pravatar.cc/100?img=4",
    eventType: "view",
    similarity: 0.72,
    friendStrength: 0.64,
    recency: 0.74,
    eventWeight: 0.6,
    score: 0.69,
    reason: "Because Liam Ortega viewed Atlas Carry-On",
    keywords: ["carry-on", "travel"]
  },
  {
    id: 3,
    name: "Eden Skin Serum",
    brand: "Velvet Labs",
    category: "Beauty",
    price: "62.00",
    description: "Hydrating serum with peptides and niacinamide for glow.",
    friendName: "Maya Chen",
    friendAvatar: "https://i.pravatar.cc/100?img=3",
    eventType: "purchase",
    similarity: 0.8,
    friendStrength: 0.88,
    recency: 0.9,
    eventWeight: 1,
    score: 0.83,
    reason: "Because Maya Chen bought Eden Skin Serum",
    keywords: ["serum", "glow"]
  },
  {
    id: 4,
    name: "Lumen Smart Desk Lamp",
    brand: "Lumen",
    category: "Home",
    price: "89.00",
    description: "Circadian lighting presets with wireless charging base.",
    friendName: "Sofia Rossi",
    friendAvatar: "https://i.pravatar.cc/100?img=5",
    eventType: "view",
    similarity: 0.67,
    friendStrength: 0.71,
    recency: 0.7,
    eventWeight: 0.6,
    score: 0.66,
    reason: "Because Sofia Rossi viewed Lumen Smart Desk Lamp",
    keywords: ["desk", "lamp"]
  }
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Recommended for you based on your friends");

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeCategory !== "All") params.set("category", activeCategory);
      params.set("limit", "12");

      setLoading(true);
      fetch(`/api/recommendations?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items ?? []);
          setStatus(
            query
              ? `Top matches for “${query}” among your friends' activity`
              : "Recommended for you based on your friends"
          );
        })
        .catch(() => {
          setItems(FALLBACK_RECOMMENDATIONS);
          setStatus("Recommended for you based on your friends");
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(handler);
  }, [query, activeCategory]);

  const friendsHighlight = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => item.friendName))).slice(0, 3);
    return names.join(", ");
  }, [items]);

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">phiademo</p>
            <h1 className="text-2xl font-semibold text-slate-900">Social semantic product recommendations</h1>
          </div>
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" /> Live Demo
          </Button>
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12">
          <div className="glass rounded-[32px] border border-white/60 p-8 shadow-soft">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold text-slate-900">Find the perfect pick through your friends.</h2>
                <p className="max-w-xl text-sm text-slate-500">
                  phiademo blends social proof with semantic search. Ask for what you want and see why your
                  friends' purchases or views are the best signal.
                </p>
              </div>
              <div className="min-w-[280px] rounded-3xl bg-white/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Signal blend</p>
                <p className="mt-2 text-sm text-slate-700">Similarity · Friend strength · Recency · Intent</p>
                <p className="mt-4 text-xs text-slate-400">Powered by pgvector + OpenAI embeddings</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search: cozy travel bag, sleek desk setup, glow serum..."
                  className="pl-11"
                />
              </div>
              <Button size="lg">Explore feed</Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full border px-4 py-1 text-xs font-medium transition ${
                    activeCategory === category
                      ? "border-primary bg-primary text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{status}</h3>
            <p className="text-sm text-slate-500">
              {friendsHighlight ? `Signals from ${friendsHighlight} and more.` : "Listening to your network."}
            </p>
          </div>
          <Badge variant="accent" className="w-fit">Live semantic ranking</Badge>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <Card key={`skeleton-${index}`} className="animate-pulse bg-white/70">
                <CardHeader>
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-48 rounded bg-slate-100" />
                </CardHeader>
                <CardContent>
                  <div className="h-16 rounded bg-slate-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{item.category}</Badge>
                    <span className="text-sm font-semibold text-slate-900">${item.price}</span>
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-slate-900">{item.name}</h4>
                  <p className="text-sm text-slate-500">{item.brand}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{item.description}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={item.friendAvatar} alt={item.friendName} />
                        <AvatarFallback>{item.friendName.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{item.reason}</p>
                        <p className="text-xs text-slate-400">
                          {item.eventType === "purchase" ? "Purchased" : "Viewed"} · Strong signal
                        </p>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">Why this?</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Why this made the cut</DialogTitle>
                          <DialogDescription>
                            We combine semantic similarity with social proof and recency to surface this pick.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                            <span>Semantic match score</span>
                            <span className="font-semibold text-slate-800">
                              {item.similarity ? item.similarity.toFixed(2) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                            <span>Friend signal</span>
                            <span className="font-semibold text-slate-800">{item.friendStrength.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                            <span>Recency contribution</span>
                            <span className="font-semibold text-slate-800">{item.recency.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                            <span>Event intent</span>
                            <span className="font-semibold text-slate-800">{item.eventWeight.toFixed(1)}x</span>
                          </div>
                          {item.keywords.length > 0 && (
                            <div>
                              <p className="text-xs uppercase text-slate-400">Matched keywords</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.keywords.map((keyword) => (
                                  <Badge key={keyword}>{keyword}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
