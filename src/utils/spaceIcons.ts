export const SPACE_EMOJI_OPTIONS = [
  '📝', '📒', '📓', '📔', '📕', '📗', '📘', '📙', '📚', '📖',
  '💡', '🎯', '🚀', '⭐', '🔥', '💎', '🌈', '🏠', '💼', '🎓',
  '🎵', '🎨', '🔬', '🌍', '❤️', '🧠', '🏗️', '📱', '☕', '🌟',
  '🗂️', '📁', '🗂', '📊', '📈', '🗓️', '✅', '🔒', '🧩', '💬',
];

export function pickRandomSpaceIcon(usedIcons?: Set<string>): string {
  const pool = usedIcons
    ? SPACE_EMOJI_OPTIONS.filter((emoji) => !usedIcons.has(emoji))
    : SPACE_EMOJI_OPTIONS;
  const choices = pool.length > 0 ? pool : SPACE_EMOJI_OPTIONS;
  return choices[Math.floor(Math.random() * choices.length)];
}
