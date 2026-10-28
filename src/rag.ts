/** 轻量 RAG：Markdown 知识库 + 字符级 TF-IDF 检索（零额外依赖）。
 *
 * 中文没有分词依赖时，使用「汉字二元组 + 英文/数字词」作为 token，
 * 对客服 FAQ 这类短文本检索效果稳定且可解释。
 */

import fs from "node:fs";
import path from "node:path";

const CJK_RE = /[一-鿿]+/g;
const WORD_RE = /[a-z0-9][a-z0-9_.-]*/g;

export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const tokens: string[] = [];

  for (const run of lowered.match(CJK_RE) ?? []) {
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i += 1) {
        tokens.push(run.slice(i, i + 2));
      }
    }
  }

  for (const word of lowered.match(WORD_RE) ?? []) {
    tokens.push(word);
  }
  return tokens;
}

export interface KnowledgeChunk {
  source: string;
  section: string;
  content: string;
}

export interface SearchHit {
  source: string;
  section: string;
  score: number;
  content: string;
}

export function loadMarkdownChunks(root: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  const files = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".md"))
    .sort();

  for (const name of files) {
    const filePath = path.join(root, name);
    let heading = path.basename(name, ".md");
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (text) {
        chunks.push({ source: name, section: heading, content: `${heading}\n${text}` });
      }
    };

    for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
      const stripped = line.trim();
      if (stripped.startsWith("#")) {
        flush();
        heading = stripped.replace(/^#+\s*/, "").trim() || path.basename(name, ".md");
      } else if (!stripped) {
        flush();
      } else {
        buffer.push(stripped);
      }
    }
    flush();
  }

  return chunks;
}

type TermFreq = Map<string, number>;
type Vector = Map<string, number>;

export class TfidfIndex {
  readonly chunks: KnowledgeChunk[];
  private readonly idf: Map<string, number>;
  private readonly vectors: Vector[];
  private readonly norms: number[];

  constructor(chunks: KnowledgeChunk[]) {
    this.chunks = chunks;
    const termFreqs = chunks.map((chunk) => {
      const freq: TermFreq = new Map();
      for (const token of tokenize(chunk.content)) {
        freq.set(token, (freq.get(token) ?? 0) + 1);
      }
      return freq;
    });

    const documentFreq = new Map<string, number>();
    for (const freq of termFreqs) {
      for (const term of freq.keys()) {
        documentFreq.set(term, (documentFreq.get(term) ?? 0) + 1);
      }
    }

    const total = Math.max(chunks.length, 1);
    this.idf = new Map(
      [...documentFreq.entries()].map(([term, df]) => [term, Math.log((total + 1) / (df + 1)) + 1]),
    );
    this.vectors = termFreqs.map((freq) => this.documentVector(freq));
    this.norms = this.vectors.map((vector) => TfidfIndex.norm(vector));
  }

  private documentVector(freq: TermFreq): Vector {
    const vector: Vector = new Map();
    for (const [term, count] of freq) {
      vector.set(term, (1 + Math.log(count)) * (this.idf.get(term) ?? 0));
    }
    return vector;
  }

  private static norm(vector: Vector): number {
    let sum = 0;
    for (const weight of vector.values()) sum += weight * weight;
    return Math.sqrt(sum);
  }

  search(query: string, topK = 3, minScore = 0.05): SearchHit[] {
    const queryFreq: TermFreq = new Map();
    for (const token of tokenize(query)) {
      queryFreq.set(token, (queryFreq.get(token) ?? 0) + 1);
    }
    const queryVector = this.documentVector(queryFreq);
    const queryNorm = TfidfIndex.norm(queryVector);
    if (queryNorm === 0) return [];

    const scored: { score: number; index: number }[] = [];
    for (let index = 0; index < this.vectors.length; index += 1) {
      const denominator = (this.norms[index] ?? 0) * queryNorm;
      if (denominator === 0) continue;
      const vector = this.vectors[index]!;
      let dot = 0;
      for (const [term, weight] of queryVector) {
        dot += weight * (vector.get(term) ?? 0);
      }
      const score = dot / denominator;
      if (score >= minScore) scored.push({ score, index });
    }

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.slice(0, topK).map(({ score, index }) => {
      const chunk = this.chunks[index]!;
      return { source: chunk.source, section: chunk.section, score, content: chunk.content };
    });
  }
}

export class KnowledgeBase {
  constructor(
    readonly chunks: KnowledgeChunk[],
    readonly index: TfidfIndex,
  ) {}

  static load(root: string): KnowledgeBase {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new Error(`知识库目录不存在: ${root}`);
    }
    const chunks = loadMarkdownChunks(root);
    if (chunks.length === 0) {
      throw new Error(`知识库为空: ${root}`);
    }
    return new KnowledgeBase(chunks, new TfidfIndex(chunks));
  }

  search(question: string, topK = 3): SearchHit[] {
    return this.index.search(question, topK);
  }

  stats(): { documents: number; chunks: number } {
    return {
      documents: new Set(this.chunks.map((chunk) => chunk.source)).size,
      chunks: this.chunks.length,
    };
  }
}
