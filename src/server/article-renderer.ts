import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { readingStructure } from "@/lib/reading";
// Raw HTML is disabled by remark-rehype; also remove dangerous Markdown URL schemes.
function safeMarkdownUrls() {
  return (tree: import("hast").Root) => {
    function visit(node: import("hast").Root | import("hast").RootContent) {
      if (node.type === "element") {
        for (const attr of ["href", "src"]) {
          const raw = node.properties[attr];
          if (typeof raw === "string") {
            try {
              const url = new URL(raw, "https://blog.invalid");
              if (
                ![
                  "http:",
                  "https:",
                  ...(attr === "href" ? ["mailto:"] : []),
                ].includes(url.protocol)
              )
                delete node.properties[attr];
            } catch {
              delete node.properties[attr];
            }
          }
        }
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(tree);
  };
}
export async function renderArticleMarkdown(content: string) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(safeMarkdownUrls)
    .use(readingStructure)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(content);
}
