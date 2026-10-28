import { describe, expect, it } from "vitest";
import { KnowledgeBase, tokenize } from "../src/rag.js";
import { KNOWLEDGE_DIR } from "../src/config.js";

const knowledgeBase = KnowledgeBase.load(KNOWLEDGE_DIR);

describe("rag", () => {
  it("中文二元组分词", () => {
    const tokens = tokenize("耳机怎么配对");
    expect(tokens).toContain("耳机");
    expect(tokens).toContain("怎么");
    expect(tokens).toContain("配对");
  });

  it("耳机 FAQ 命中", () => {
    const hits = knowledgeBase.search("耳机怎么配对，一直连不上", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source).toBe("产品使用-耳机.md");
    expect(hits[0]!.score).toBeGreaterThan(0);
  });

  it("退款政策命中", () => {
    const hits = knowledgeBase.search("退款多久到账", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source).toBe("售后与退款政策.md");
    expect(hits[0]!.content).toContain("到账");
  });

  it("发票 FAQ 命中", () => {
    const hits = knowledgeBase.search("发票怎么开", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source).toBe("发票与保修.md");
  });

  it("top_k 生效", () => {
    expect(knowledgeBase.search("耳机", 1)).toHaveLength(1);
    expect(knowledgeBase.search("耳机", 5).length).toBeLessThanOrEqual(5);
  });

  it("空查询与无关查询", () => {
    expect(knowledgeBase.search("")).toEqual([]);
    expect(knowledgeBase.search("量子力学入门")).toEqual([]);
  });

  it("知识库统计", () => {
    const stats = knowledgeBase.stats();
    expect(stats.documents).toBe(5);
    expect(stats.chunks).toBeGreaterThanOrEqual(stats.documents);
  });
});
