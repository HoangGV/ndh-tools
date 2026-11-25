export type TreeLineStyle = 'unicode' | 'ascii';

export interface TreeOptions {
  style: TreeLineStyle;
  trailingSlash: boolean;
  showIcons: boolean;
}

export interface TreeNode {
  name: string;
  explicitDir: boolean;
  children: TreeNode[];
}

export interface TreeStats {
  folders: number;
  files: number;
  maxDepth: number;
}

export const SAMPLE_VIETNAMESE_TREE = `du-an-thuong-mai-dien-tu/
  tài-liệu/
    Đặc tả yêu cầu hệ thống.docx
    Hướng dẫn triển khai máy chủ.md
    Báo cáo tiến độ quý 4.pdf
  public/
    hình-ảnh/
      logo-chính.svg
      ảnh-bìa-trang-chủ.webp
    favicon.ico
  src/
    components/
      ThanhĐiềuHướng.tsx
      GiỏHàngNhanh.tsx
      ThẻSảnPhẩm.tsx
    pages/
      TrangChủ.tsx
      ChiTiếtSảnPhẩm.tsx
      ThanhToán.tsx
    utils/
      định-dạng-tiền-tệ.ts
      xử-lý-ảnh.ts
    App.tsx
    index.css
    main.tsx
  .env.example
  package.json
  README.md`;

/**
 * Computes visual indentation width of a line while preserving full UTF-8/Vietnamese content.
 * Tabs expand to 2 spaces so mixing tabs and 2-space indentation behaves predictably.
 */
function measureIndent(line: string): { indent: number; trimmed: string } {
  let indent = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === ' ') {
      indent += 1;
      i += 1;
    } else if (ch === '\t') {
      indent += 2;
      i += 1;
    } else {
      break;
    }
  }
  return {
    indent,
    trimmed: line.slice(i).trimEnd(),
  };
}

/**
 * Parses an indented plain-text outline into a nested tree structure.
 * Handles arbitrary Vietnamese Unicode, spaces inside names, tabs/spaces mixing,
 * and multiple root nodes cleanly.
 */
export function parseIndentedTree(input: string): TreeNode[] {
  const rawLines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const roots: TreeNode[] = [];
  const stack: Array<{ indent: number; node: TreeNode }> = [];

  for (const rawLine of rawLines) {
    const { indent, trimmed } = measureIndent(rawLine);
    if (!trimmed) continue;

    const explicitDir = trimmed.endsWith('/') || trimmed.endsWith('\\');
    const cleanName = explicitDir ? trimmed.slice(0, -1).trimEnd() : trimmed;
    if (!cleanName) continue;

    const node: TreeNode = {
      name: cleanName,
      explicitDir,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ indent, node });
  }

  return roots;
}

export function generateDirectoryTree(
  input: string,
  options: TreeOptions
): { output: string; stats: TreeStats } {
  const roots = parseIndentedTree(input);
  if (roots.length === 0) {
    return {
      output: '',
      stats: { folders: 0, files: 0, maxDepth: 0 },
    };
  }

  const connectors =
    options.style === 'unicode'
      ? {
          branch: '├── ',
          last: '└── ',
          vertical: '│   ',
          empty: '    ',
        }
      : {
          branch: '+-- ',
          last: '\\-- ',
          vertical: '|   ',
          empty: '    ',
        };

  const lines: string[] = [];
  const stats: TreeStats = { folders: 0, files: 0, maxDepth: 0 };

  const formatLabel = (node: TreeNode, isDir: boolean): string => {
    const icon = options.showIcons ? (isDir ? '📁 ' : '📄 ') : '';
    const suffix = isDir && options.trailingSlash ? '/' : '';
    return `${icon}${node.name}${suffix}`;
  };

  const walk = (nodes: TreeNode[], prefix: string, depth: number, isTopLevelSingleRoot: boolean) => {
    nodes.forEach((node, idx) => {
      const isLast = idx === nodes.length - 1;
      const isDir = node.children.length > 0 || node.explicitDir;

      if (isDir) {
        stats.folders += 1;
      } else {
        stats.files += 1;
      }
      if (depth > stats.maxDepth) {
        stats.maxDepth = depth;
      }

      if (isTopLevelSingleRoot) {
        lines.push(formatLabel(node, isDir));
        if (node.children.length > 0) {
          walk(node.children, '', depth + 1, false);
        }
      } else {
        const connector = isLast ? connectors.last : connectors.branch;
        lines.push(`${prefix}${connector}${formatLabel(node, isDir)}`);
        if (node.children.length > 0) {
          const childPrefix = prefix + (isLast ? connectors.empty : connectors.vertical);
          walk(node.children, childPrefix, depth + 1, false);
        }
      }
    });
  };

  // If there is a single root folder/node, display it cleanly at the top without a leading branch connector.
  // If there are multiple top-level items, render them either as root entries or connected siblings.
  if (roots.length === 1) {
    walk(roots, '', 1, true);
  } else {
    walk(roots, '', 1, false);
  }

  return {
    output: lines.join('\n'),
    stats,
  };
}
