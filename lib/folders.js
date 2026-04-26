export function getFolderLabel(folderStructure = 'flat') {
  if (folderStructure === 'flat') return null;
  const now = new Date();
  const year = now.getFullYear();
  if (folderStructure === 'year') return String(year);
  const sem = now.getMonth() < 6 ? 'S1' : 'S2';
  return `${year}-${sem}`;
}
