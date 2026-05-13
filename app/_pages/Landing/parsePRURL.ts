export interface ParsedPRURL {
  owner: string;
  repo: string;
  number: number;
}

export const parsePRURL = (input: string): ParsedPRURL | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const m = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/pull\/(\d+)(?:[/?#].*)?$/i,
  );
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };

  const m2 = trimmed.match(/^([^/\s?#]+)\/([^/\s?#]+)\/pull\/(\d+)(?:[/?#].*)?$/);
  if (m2) return { owner: m2[1], repo: m2[2], number: Number(m2[3]) };

  return null;
};
